import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, tripSnapshots } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string; snapshotId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, snapshotId } = await params;
  const tripId = parseInt(id, 10);
  const snapId = parseInt(snapshotId, 10);
  if (isNaN(tripId) || isNaN(snapId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [snapshot] = await db
    .select()
    .from(tripSnapshots)
    .where(and(eq(tripSnapshots.id, snapId), eq(tripSnapshots.tripId, tripId)))
    .limit(1);

  if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(snapshot);
}
