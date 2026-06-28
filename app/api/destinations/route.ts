import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { destinations, trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, name, checkin, checkout, nights } = body;

  if (!tripId || !name) {
    return NextResponse.json({ error: 'tripId and name are required' }, { status: 400 });
  }

  // Verify trip belongs to user
  const [trip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const [inserted] = await db
    .insert(destinations)
    .values({
      tripId,
      name,
      checkin: checkin ?? null,
      checkout: checkout ?? null,
      nights: nights ?? null,
    })
    .$returningId();

  const [destination] = await db
    .select()
    .from(destinations)
    .where(eq(destinations.id, inserted.id))
    .limit(1);

  return NextResponse.json(destination, { status: 201 });
}
