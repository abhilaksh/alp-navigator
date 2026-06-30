import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { changeRequests, trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ requestId: string }> };

async function verifyOwnership(requestId: number, userId: number) {
  const [cr] = await db.select({ tripId: changeRequests.tripId })
    .from(changeRequests)
    .where(eq(changeRequests.id, requestId))
    .limit(1);
  if (!cr) return false;

  const [trip] = await db.select({ id: trips.id })
    .from(trips)
    .where(eq(trips.id, cr.tripId))
    .limit(1);
  return trip?.id != null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  const id = parseInt(requestId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const ok = await verifyOwnership(id, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { status?: string; text?: string; category?: string };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const validStatuses = ['open', 'implemented', 'noted'];
  const validCategories = ['hotel_swap', 'date_change', 'activity_add', 'budget_adjust', 'other'];

  if (body.status && validStatuses.includes(body.status)) updates.status = body.status;
  if (body.text?.trim()) updates.text = body.text.trim();
  if (body.category && validCategories.includes(body.category)) updates.category = body.category;

  await db.update(changeRequests).set(updates).where(eq(changeRequests.id, id));
  const [updated] = await db.select().from(changeRequests).where(eq(changeRequests.id, id)).limit(1);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  const id = parseInt(requestId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const ok = await verifyOwnership(id, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(changeRequests).where(eq(changeRequests.id, id));
  return NextResponse.json({ ok: true });
}
