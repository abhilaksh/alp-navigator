import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { rates, hotelDetails, tripItems, destinations, type ParsedRate } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `Parse the hotel rate confirmation text into structured JSON with these fields:
room_type, checkin, checkout, nights, adults, rooms,
cancellation_free (boolean), cancellation_deadline, cancellation_note,
nightly_rates (array of {date, rate_inr}),
subtotal_inr, taxes_inr, total_inr,
native_currency_code, native_currency_total,
due_at_booking_inr, due_later_inr,
board_basis, breakfast_included (boolean),
inclusions (array of strings), perks (array of strings), key_amenities (array of strings),
vet_notes.
All INR amounts must be integers.
If the text contains multiple room options, return a JSON object with a "rates" key containing an array of rate objects, each having all the above fields.
Otherwise return a single JSON object with those fields directly.
Output only valid JSON with no markdown or code fences.`;

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return d; }
}

function checkDateMismatch(rate: ParsedRate, destCheckin: string | null, destCheckout: string | null): ParsedRate {
  if (!destCheckin || !destCheckout || !rate.checkin || !rate.checkout) return rate;
  const outOfRange = rate.checkin < destCheckin || rate.checkout > destCheckout;
  if (!outOfRange) return rate;
  return {
    ...rate,
    date_mismatch: true,
    date_mismatch_note: `Rate dates (${fmtDate(rate.checkin)} → ${fmtDate(rate.checkout)}) fall outside the destination's dates (${fmtDate(destCheckin)} → ${fmtDate(destCheckout)}).`,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: rates.id, hotelDetailId: rates.hotelDetailId })
    .from(rates)
    .where(eq(rates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Destination dates for this hotel, to sanity-check the parsed rate against.
  const [destInfo] = await db
    .select({ checkin: destinations.checkin, checkout: destinations.checkout })
    .from(hotelDetails)
    .innerJoin(tripItems, eq(tripItems.id, hotelDetails.itemId))
    .innerJoin(destinations, eq(destinations.id, tripItems.destinationId))
    .where(eq(hotelDetails.id, existing.hotelDetailId))
    .limit(1);

  const body = await req.json();
  const { rawText } = body;
  if (!rawText) return NextResponse.json({ error: 'rawText is required' }, { status: 400 });

  // Mark as parsing and save rawText immediately
  await db
    .update(rates)
    .set({ status: 'parsing', rawText, updatedAt: new Date() })
    .where(eq(rates.id, rateId));

  const apiKey = process.env.HAPUPPY_API_KEY;
  if (!apiKey) {
    await db
      .update(rates)
      .set({ status: 'error', errorMessage: 'HAPUPPY_API_KEY not configured', updatedAt: new Date() })
      .where(eq(rates.id, rateId));
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
          { role: 'system', content: SYSTEM_PROMPT },
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
    const destCheckin = destInfo?.checkin ?? null;
    const destCheckout = destInfo?.checkout ?? null;

    if (Array.isArray(parsed.rates) && parsed.rates.length > 0) {
      // Multiple options → proposals
      const checkedRates = (parsed.rates as ParsedRate[]).map(r => checkDateMismatch(r, destCheckin, destCheckout));
      await db
        .update(rates)
        .set({
          status: 'proposals',
          proposals: JSON.stringify(checkedRates),
          rawText,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(rates.id, rateId));
    } else {
      // Single option → done
      const checked = checkDateMismatch(parsed as ParsedRate, destCheckin, destCheckout);
      await db
        .update(rates)
        .set({
          status: 'done',
          parsedData: JSON.stringify(checked),
          rawText,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(rates.id, rateId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(rates)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(rates.id, rateId));
  }

  const [updated] = await db
    .select()
    .from(rates)
    .where(eq(rates.id, rateId))
    .limit(1);

  return NextResponse.json(updated);
}
