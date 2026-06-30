import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems, trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

async function resolveItem(itemId: number, userId: number) {
  const rows = await db
    .select({ itemId: tripItems.id, userId: trips.userId })
    .from(tripItems)
    .innerJoin(trips, eq(tripItems.tripId, trips.id))
    .where(eq(tripItems.id, itemId))
    .limit(1);
  return rows[0]?.userId === userId ? rows[0] : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (!await resolveItem(itemId, user.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, detailsJson, confirmedTotalInr, startDate, endDate, bookingStatus, bookingRef, sortOrder } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (detailsJson !== undefined) updates.detailsJson = detailsJson !== null ? JSON.stringify(detailsJson) : null;
  if (confirmedTotalInr !== undefined) updates.confirmedTotalInr = confirmedTotalInr;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (bookingStatus !== undefined) updates.bookingStatus = bookingStatus;
  if (bookingRef !== undefined) updates.bookingRef = bookingRef;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  await db.update(tripItems).set(updates).where(eq(tripItems.id, itemId));
  const [updated] = await db.select().from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (!await resolveItem(itemId, user.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(tripItems).where(eq(tripItems.id, itemId));
  return NextResponse.json({ success: true });
}
