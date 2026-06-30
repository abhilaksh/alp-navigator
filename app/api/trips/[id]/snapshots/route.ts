import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, tripSnapshots, teamMembers } from '@/lib/db/schema';
import { getUser, getTripById } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Verify ownership
  const [existing] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snapshots = await db
    .select({
      id: tripSnapshots.id,
      version: tripSnapshots.version,
      label: tripSnapshots.label,
      createdAt: tripSnapshots.createdAt,
    })
    .from(tripSnapshots)
    .where(eq(tripSnapshots.tripId, tripId))
    .orderBy(desc(tripSnapshots.version))
    .limit(20);

  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Verify ownership
  const [existing] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { label } = body as { label?: string };

  // Get current trip state as snapshot
  const tripFull = await getTripById(tripId);
  if (!tripFull) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get next version number
  const [lastSnapshot] = await db
    .select({ version: tripSnapshots.version })
    .from(tripSnapshots)
    .where(eq(tripSnapshots.tripId, tripId))
    .orderBy(desc(tripSnapshots.version))
    .limit(1);
  const nextVersion = (lastSnapshot?.version ?? 0) + 1;

  const [created] = await db
    .insert(tripSnapshots)
    .values({
      tripId,
      version: nextVersion,
      label: label ?? `Version ${nextVersion}`,
      snapshotJson: JSON.stringify(tripFull),
    })
    .$returningId();

  return NextResponse.json({ id: created.id, version: nextVersion });
}
