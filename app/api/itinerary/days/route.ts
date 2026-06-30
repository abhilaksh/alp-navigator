import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryDays, itineraryBlocks, trips } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tripId = Number(req.nextUrl.searchParams.get('tripId'));
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  // Verify ownership
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, user.id)),
    columns: { id: true },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const days = await db.query.itineraryDays.findMany({
    where: eq(itineraryDays.tripId, tripId),
    orderBy: [asc(itineraryDays.sortOrder), asc(itineraryDays.dayNumber)],
    with: {
      blocks: {
        orderBy: [asc(itineraryBlocks.sortOrder)],
      },
    },
  });

  return NextResponse.json(days);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, destinationId, dayNumber, date, title, summary, sortOrder } = body;

  if (!tripId || dayNumber == null) {
    return NextResponse.json({ error: 'tripId and dayNumber required' }, { status: 400 });
  }

  // Verify ownership
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, user.id)),
    columns: { id: true },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [row] = await db.insert(itineraryDays).values({
    tripId,
    destinationId: destinationId ?? null,
    dayNumber,
    date: date ?? null,
    title: title ?? null,
    summary: summary ?? null,
    sortOrder: sortOrder ?? 0,
  });

  const newDay = await db.query.itineraryDays.findFirst({
    where: eq(itineraryDays.id, (row as { insertId: number }).insertId),
    with: { blocks: true },
  });

  return NextResponse.json(newDay, { status: 201 });
}
