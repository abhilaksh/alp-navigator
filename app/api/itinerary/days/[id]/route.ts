import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryDays, trips } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

async function verifyOwnership(dayId: number, userId: number) {
  const day = await db.query.itineraryDays.findFirst({
    where: eq(itineraryDays.id, dayId),
    with: { trip: { columns: { id: true, userId: true } } },
  });
  if (!day) return null;
  if ((day as { trip: { userId: number } }).trip?.userId !== userId) return null;
  return day;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dayId = Number(id);
  const day = await verifyOwnership(dayId, user.id);
  if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const patch: Partial<typeof itineraryDays.$inferInsert> = {};
  if ('title' in body)       patch.title = body.title ?? null;
  if ('date' in body)        patch.date = body.date ?? null;
  if ('summary' in body)     patch.summary = body.summary ?? null;
  if ('sortOrder' in body)   patch.sortOrder = body.sortOrder;
  if ('dayNumber' in body)   patch.dayNumber = body.dayNumber;
  if ('destinationId' in body) patch.destinationId = body.destinationId ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db.update(itineraryDays).set(patch).where(eq(itineraryDays.id, dayId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dayId = Number(id);
  const day = await verifyOwnership(dayId, user.id);
  if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(itineraryDays).where(eq(itineraryDays.id, dayId));
  return NextResponse.json({ ok: true });
}
