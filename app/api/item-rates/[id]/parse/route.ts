import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { itemRates, tripItems, destinations, type ParsedItemRate } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

type Params = { params: Promise<{ id: string }> };

const FLIGHT_PROMPT = `Parse the flight fare confirmation text into structured JSON with these fields:
airline, flight_number, cabin_class, fare_class ("refundable" or "non_refundable"),
from, to, departure_datetime, arrival_datetime, duration,
baggage_checked, baggage_cabin, change_fee_inr, pnr,
fare_adult_inr, fare_teen_inr, fare_child_inr, fare_infant_inr,
adult_count, teen_count, child_count, infant_count,
taxes_inr, total_inr,
cancellation_free (boolean), cancellation_deadline, cancellation_note.
Age brackets: Adult is 12+, Teenager is 12-15 (only include if the fare rules explicitly distinguish a teen fare), Child is 2-12, Infant is under 2. Omit any fare_*_inr / *_count field for a bracket not mentioned in the text -- do not guess or default to zero.
All INR amounts must be integers.
departure_datetime and arrival_datetime MUST be in strict ISO 8601 format (YYYY-MM-DDTHH:MM, e.g. 2026-09-12T07:25) and represent LOCAL time at each respective airport (do not convert to UTC or any other timezone). duration is the total flight/journey time as stated in the text (e.g. "8h 45m") -- extract it directly rather than computing it from the timestamps, since departure and arrival can be in different timezones. cancellation_deadline MUST be in YYYY-MM-DD format. Never use a human-readable date format for departure_datetime/arrival_datetime/cancellation_deadline.
If the text contains multiple fare options, return a JSON object with a "rates" key containing an array of rate objects, each having all the above fields.
Otherwise return a single JSON object with those fields directly.
Output only valid JSON with no markdown or code fences.`;

const TRANSFER_PROMPT = `Parse the transfer/transport quote text into structured JSON with these fields:
mode ("car", "train", "ferry", "bus", or "other"), vehicle_or_class, operator,
pickup, dropoff, transfer_datetime, is_per_vehicle (boolean),
total_inr,
cancellation_free (boolean), cancellation_deadline, cancellation_note.
All INR amounts must be integers.
transfer_datetime MUST be in strict ISO 8601 format (YYYY-MM-DDTHH:MM, e.g. 2026-09-12T07:25). cancellation_deadline MUST be in YYYY-MM-DD format. Never use a human-readable date format for these fields.
If the text contains multiple options, return a JSON object with a "rates" key containing an array of rate objects, each having all the above fields.
Otherwise return a single JSON object with those fields directly.
Output only valid JSON with no markdown or code fences.`;

const ACTIVITY_PROMPT = `Parse the activity/experience quote text into structured JSON with these fields:
option_name, operator, activity_datetime, duration,
inclusions (array of strings), pax_count, is_per_person (boolean),
total_inr, payment_due_date,
cancellation_free (boolean), cancellation_deadline, cancellation_note.
All INR amounts must be integers.
activity_datetime MUST be in strict ISO 8601 format (YYYY-MM-DDTHH:MM, e.g. 2026-09-12T07:25). payment_due_date and cancellation_deadline MUST be in YYYY-MM-DD format. Never use a human-readable date format for these fields.
If the text contains multiple options (e.g. private vs group), return a JSON object with a "rates" key containing an array of rate objects, each having all the above fields.
Otherwise return a single JSON object with those fields directly.
Output only valid JSON with no markdown or code fences.`;

function promptForType(type: string): string {
  if (type === 'flight') return FLIGHT_PROMPT;
  if (type === 'transfer') return TRANSFER_PROMPT;
  return ACTIVITY_PROMPT;
}

function dateFieldForType(type: string): keyof ParsedItemRate | null {
  if (type === 'flight') return 'departure_datetime';
  if (type === 'transfer') return 'transfer_datetime';
  if (type === 'activity' || type === 'experience') return 'activity_datetime';
  return null;
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return d; }
}

function toIsoDate(raw: string): string | null {
  // Defensive normalization -- the model is instructed to return ISO 8601, but
  // fall back to parsing whatever it actually returned rather than silently
  // comparing garbage strings lexicographically.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function checkDateMismatch(rate: ParsedItemRate, type: string, destCheckin: string | null, destCheckout: string | null): ParsedItemRate {
  const field = dateFieldForType(type);
  if (!field || !destCheckin || !destCheckout) return rate;
  const raw = rate[field] as string | undefined;
  if (!raw) return rate;
  const day = toIsoDate(raw);
  if (!day) return rate;
  const outOfRange = day < destCheckin || day > destCheckout;
  if (!outOfRange) return rate;
  return {
    ...rate,
    date_mismatch: true,
    date_mismatch_note: `This date (${fmtDate(raw)}) falls outside the destination's dates (${fmtDate(destCheckin)} → ${fmtDate(destCheckout)}).`,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: itemRates.id, itemId: itemRates.itemId })
    .from(itemRates)
    .where(eq(itemRates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [itemInfo] = await db
    .select({ type: tripItems.type, checkin: destinations.checkin, checkout: destinations.checkout })
    .from(tripItems)
    .leftJoin(destinations, eq(destinations.id, tripItems.destinationId))
    .where(eq(tripItems.id, existing.itemId))
    .limit(1);
  if (!itemInfo) return NextResponse.json({ error: 'Parent item not found' }, { status: 404 });

  const body = await req.json();
  const { rawText } = body;
  if (!rawText) return NextResponse.json({ error: 'rawText is required' }, { status: 400 });

  await db
    .update(itemRates)
    .set({ status: 'parsing', rawText, updatedAt: new Date() })
    .where(eq(itemRates.id, rateId));

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'hapuppyApiKey');
  if (!apiKey) {
    await db
      .update(itemRates)
      .set({ status: 'error', errorMessage: 'HAPUPPY_API_KEY not configured', updatedAt: new Date() })
      .where(eq(itemRates.id, rateId));
    return NextResponse.json({ error: 'Parse service not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://beta.hapuppy.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: promptForType(itemInfo.type) },
          { role: 'user', content: rawText },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hapuppy API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from parse API');

    const parsed = JSON.parse(content);
    const destCheckin = itemInfo.checkin ?? null;
    const destCheckout = itemInfo.checkout ?? null;

    if (Array.isArray(parsed.rates) && parsed.rates.length > 0) {
      const checkedRates = (parsed.rates as ParsedItemRate[]).map(r => checkDateMismatch(r, itemInfo.type, destCheckin, destCheckout));
      await db
        .update(itemRates)
        .set({
          status: 'proposals',
          proposals: JSON.stringify(checkedRates),
          rawText,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(itemRates.id, rateId));
    } else {
      const checked = checkDateMismatch(parsed as ParsedItemRate, itemInfo.type, destCheckin, destCheckout);
      await db
        .update(itemRates)
        .set({
          status: 'done',
          parsedData: JSON.stringify(checked),
          rawText,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(itemRates.id, rateId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(itemRates)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(itemRates.id, rateId));
  }

  const [updated] = await db
    .select()
    .from(itemRates)
    .where(eq(itemRates.id, rateId))
    .limit(1);

  return NextResponse.json(updated);
}
