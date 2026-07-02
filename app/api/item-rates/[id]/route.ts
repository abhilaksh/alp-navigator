import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { itemRates } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: itemRates.id })
    .from(itemRates)
    .where(eq(itemRates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { status, rawText, parsedData, proposals, isConfirmed, sortOrder, expiresAt, errorMessage } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (rawText !== undefined) updates.rawText = rawText;
  if (parsedData !== undefined) updates.parsedData = JSON.stringify(parsedData);
  if (proposals !== undefined) updates.proposals = JSON.stringify(proposals);
  if (isConfirmed !== undefined) updates.isConfirmed = isConfirmed ? 1 : 0;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (expiresAt !== undefined) updates.expiresAt = expiresAt || null;
  if (errorMessage !== undefined) updates.errorMessage = errorMessage || null;

  await db.update(itemRates).set(updates).where(eq(itemRates.id, rateId));

  const [updated] = await db
    .select()
    .from(itemRates)
    .where(eq(itemRates.id, rateId))
    .limit(1);

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: itemRates.id })
    .from(itemRates)
    .where(eq(itemRates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(itemRates).where(eq(itemRates.id, rateId));

  return NextResponse.json({ success: true });
}
