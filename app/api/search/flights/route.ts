import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

interface IgnavSegment {
  marketing_carrier_code?: string;
  flight_number?: string;
  operating_carrier_name?: string;
  departure_airport?: string;
  departure_time_local?: string;
  arrival_airport?: string;
  arrival_time_local?: string;
  duration_minutes?: number;
  aircraft?: string;
}

interface IgnavLeg {
  carrier?: string;
  duration_minutes?: number;
  segments?: IgnavSegment[];
}

interface IgnavItinerary {
  price?: { amount?: number; currency?: string; status?: string };
  outbound?: IgnavLeg;
  inbound?: IgnavLeg;
  cabin_class?: string;
  ignav_id?: string;
}

function formatDuration(minutes: number | undefined): string | null {
  if (!minutes && minutes !== 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function mapLeg(leg: IgnavLeg | undefined) {
  if (!leg || !leg.segments || leg.segments.length === 0) return null;
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  return {
    airline: first.operating_carrier_name ?? leg.carrier ?? null,
    flight_number: leg.segments.map(s => `${s.marketing_carrier_code ?? ''}${s.flight_number ?? ''}`).join('/'),
    from: first.departure_airport ?? null,
    to: last.arrival_airport ?? null,
    departure_datetime: first.departure_time_local ?? null,
    arrival_datetime: last.arrival_time_local ?? null,
    duration: formatDuration(leg.duration_minutes),
    stops: leg.segments.length - 1,
    segments: leg.segments,
  };
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { origin, destination, departureDate, returnDate, adults, children, infants, cabinClass, maxStops } = body;

  if (!origin || !destination || !departureDate) {
    return NextResponse.json({ error: 'origin, destination, and departureDate are required' }, { status: 400 });
  }

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'ignavApiKey');

  const isRoundTrip = !!returnDate;
  const endpoint = isRoundTrip ? 'round-trip' : 'one-way';

  const payload: Record<string, unknown> = {
    origin: String(origin).toUpperCase(),
    destination: String(destination).toUpperCase(),
    departure_date: departureDate,
    adults: adults ?? 1,
    ...(children && { children }),
    ...(infants && { infants_in_seat: infants }),
    ...(cabinClass && { cabin_class: cabinClass }),
    ...(maxStops !== undefined && maxStops !== null && { max_stops: maxStops }),
    market: 'IN',
  };
  if (isRoundTrip) payload.return_date = returnDate;

  let response: Response;
  try {
    response = await fetch(`https://ignav.com/api/fares/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ignav request failed: ${message}` }, { status: 502 });
  }

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `Ignav error ${response.status}: ${errText}` },
      { status: response.status === 402 ? 402 : 502 },
    );
  }

  const data = await response.json();
  const itineraries: IgnavItinerary[] = data?.itineraries ?? [];

  const mapped = itineraries.map(it => ({
    ignavId: it.ignav_id ?? null,
    cabinClass: it.cabin_class ?? null,
    priceAmount: it.price?.amount ?? null,
    currency: it.price?.currency ?? null,
    outbound: mapLeg(it.outbound),
    inbound: isRoundTrip ? mapLeg(it.inbound) : null,
  })).filter(it => it.outbound);

  return NextResponse.json({ results: mapped, isRoundTrip });
}
