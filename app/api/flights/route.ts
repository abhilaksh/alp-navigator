import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems, itemRates, type ParsedItemRate } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

interface LegInput {
  airline?: string | null;
  flight_number?: string | null;
  from?: string | null;
  to?: string | null;
  departure_datetime?: string | null;
  arrival_datetime?: string | null;
  duration?: string | null;
}

async function fetchBookingUrl(ignavId: string, apiKey: string | undefined): Promise<string | null> {
  try {
    const res = await fetch('https://ignav.com/api/fares/booking-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({ ignav_id: ignavId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url = data?.booking_options?.[0]?.links?.[0]?.url;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, destinationId, leg, ignavId, cabinClass, priceAmount, currency, passengerCount } = body as {
    tripId: number; destinationId: number; leg: LegInput;
    ignavId?: string; cabinClass?: string; priceAmount?: number; currency?: string; passengerCount?: number;
  };

  if (!tripId || !destinationId || !leg) {
    return NextResponse.json({ error: 'tripId, destinationId, and leg are required' }, { status: 400 });
  }

  const title = [leg.flight_number, leg.from && leg.to ? `${leg.from} → ${leg.to}` : null]
    .filter(Boolean)
    .join(' · ') || 'Flight';

  const totalInr = currency === 'INR' ? priceAmount ?? undefined : undefined;
  const pax = passengerCount && passengerCount > 0 ? passengerCount : 1;
  const farePerPersonInr = totalInr != null ? Math.round(totalInr / pax) : undefined;

  const detailsJson = {
    ...(leg.airline && { airline: leg.airline }),
    ...(leg.from && { from: leg.from }),
    ...(leg.to && { to: leg.to }),
    ...(leg.flight_number && { flightNumber: leg.flight_number }),
    cabinClass: cabinClass ?? 'economy',
    ...(leg.departure_datetime && { departureDateTime: leg.departure_datetime }),
    ...(leg.arrival_datetime && { arrivalDateTime: leg.arrival_datetime }),
    ...(farePerPersonInr != null && { farePerPersonInr }),
    passengers: pax,
    isEstimated: true,
  };

  const [insertedItem] = await db
    .insert(tripItems)
    .values({
      destinationId,
      tripId,
      type: 'flight',
      title,
      bookingStatus: 'researching',
      detailsJson: JSON.stringify(detailsJson),
    })
    .$returningId();

  const itemId = insertedItem.id;

  let bookingUrl: string | null = null;
  if (ignavId) {
    const teamId = (await getUserWithTeam(user.id))?.teamId ?? null;
    const apiKey = await getIntegrationKey(teamId, 'ignavApiKey');
    bookingUrl = await fetchBookingUrl(ignavId, apiKey);
  }

  const parsedData: ParsedItemRate = {
    airline: leg.airline ?? undefined,
    flight_number: leg.flight_number ?? undefined,
    cabin_class: cabinClass ?? undefined,
    from: leg.from ?? undefined,
    to: leg.to ?? undefined,
    departure_datetime: leg.departure_datetime ?? undefined,
    arrival_datetime: leg.arrival_datetime ?? undefined,
    duration: leg.duration ?? undefined,
    total_inr: totalInr,
    ignav_id: ignavId ?? undefined,
    booking_url: bookingUrl ?? undefined,
  };

  const [insertedRate] = await db
    .insert(itemRates)
    .values({
      itemId,
      source: 'ignav',
      sourceLabel: 'Ignav search',
      status: 'done',
      parsedData: JSON.stringify(parsedData),
    })
    .$returningId();

  const [item] = await db.select().from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
  const [itemRate] = await db.select().from(itemRates).where(eq(itemRates.id, insertedRate.id)).limit(1);

  return NextResponse.json({ item, itemRate }, { status: 201 });
}
