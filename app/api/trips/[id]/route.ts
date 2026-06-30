import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, teamMembers } from '@/lib/db/schema';
import { getUser, getTripById } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(trip);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Verify ownership
  const [existing] = await db
    .select({ id: trips.id, userId: trips.userId })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { label, adults, status, clientId, notes, totalFromInr, fxDate, fxSource, fxBufferPct, fxUsdToInr, paymentData, intakeStatus } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (label !== undefined) updates.label = label;
  if (adults !== undefined) updates.adults = adults;
  if (status !== undefined) updates.status = status;
  if (clientId !== undefined) updates.clientId = clientId;
  if (notes !== undefined) updates.notes = notes;
  if (totalFromInr !== undefined) updates.totalFromInr = totalFromInr;
  if (fxDate !== undefined) updates.fxDate = fxDate;
  if (fxSource !== undefined) updates.fxSource = fxSource;
  if (fxBufferPct !== undefined) updates.fxBufferPct = fxBufferPct;
  if (fxUsdToInr !== undefined) updates.fxUsdToInr = fxUsdToInr;
  if (paymentData !== undefined) updates.paymentData = paymentData;
  if (intakeStatus !== undefined) {
    updates.intakeStatus = intakeStatus;
    // Auto-stamp acknowledged_at on first acknowledgement
    if (intakeStatus === 'acknowledged') updates.acknowledgedAt = Date.now();
    if (intakeStatus === 'brief_complete') updates.briefCompleteAt = Date.now();
  }

  await db.update(trips).set(updates).where(eq(trips.id, tripId));

  const [updated] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Resolve user's team and verify the trip belongs to it
  const membership = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!membership[0]) return NextResponse.json({ error: 'No team' }, { status: 403 });
  const teamId = membership[0].teamId;

  const [existing] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.teamId, teamId)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(trips).where(eq(trips.id, tripId));

  return NextResponse.json({ success: true });
}
