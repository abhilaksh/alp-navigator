import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { itemRates, type ParsedItemRate } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db.select().from(itemRates).where(eq(itemRates.id, rateId)).limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed: ParsedItemRate = existing.parsedData ? JSON.parse(existing.parsedData) : {};
  if (!parsed.ignav_id) return NextResponse.json({ error: 'No Ignav itinerary on this rate' }, { status: 400 });

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'ignavApiKey');

  try {
    const res = await fetch('https://ignav.com/api/fares/booking-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({ ignav_id: parsed.ignav_id }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Ignav error ${res.status}: ${errText}` }, { status: res.status === 402 ? 402 : 502 });
    }
    const data = await res.json();
    const url = data?.booking_options?.[0]?.links?.[0]?.url;
    if (typeof url !== 'string') {
      return NextResponse.json({ error: 'No booking link available for this itinerary' }, { status: 404 });
    }
    const updatedParsed = { ...parsed, booking_url: url };
    await db.update(itemRates).set({ parsedData: JSON.stringify(updatedParsed), updatedAt: new Date() }).where(eq(itemRates.id, rateId));
    const [updated] = await db.select().from(itemRates).where(eq(itemRates.id, rateId)).limit(1);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ignav request failed: ${message}` }, { status: 502 });
  }
}
