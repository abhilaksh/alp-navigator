import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { trips } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const body = await req.json().catch(() => ({})) as { note?: string };

  const trip = await db
    .select({
      id: trips.id,
      status: trips.status,
      previewExpiresAt: trips.previewExpiresAt,
      clientAcceptedAt: trips.clientAcceptedAt,
    })
    .from(trips)
    .where(eq(trips.previewKey, key))
    .limit(1)
    .then(r => r[0] ?? null);

  if (!trip) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (trip.previewExpiresAt && trip.previewExpiresAt < Date.now()) {
    return NextResponse.json({ error: 'Proposal has expired' }, { status: 410 });
  }

  if (trip.clientAcceptedAt) {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  await db
    .update(trips)
    .set({
      status: 'accepted',
      clientAcceptedAt: Date.now(),
      clientAcceptanceNote: body.note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, trip.id));

  return NextResponse.json({ ok: true });
}
