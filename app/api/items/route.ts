import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems, trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, destinationId, type, title, detailsJson, confirmedTotalInr, startDate, endDate } = body;

  if (!tripId || !type || !title) {
    return NextResponse.json({ error: 'tripId, type, and title are required' }, { status: 400 });
  }

  const [trip] = await db.select({ id: trips.id }).from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id))).limit(1);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [inserted] = await db.insert(tripItems).values({
    tripId,
    destinationId: destinationId ?? null,
    type,
    title,
    bookingStatus: 'researching',
    confirmedTotalInr: confirmedTotalInr ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    detailsJson: detailsJson ? JSON.stringify(detailsJson) : null,
  }).$returningId();

  const [item] = await db.select().from(tripItems)
    .where(eq(tripItems.id, inserted.id)).limit(1);
  return NextResponse.json(item, { status: 201 });
}
