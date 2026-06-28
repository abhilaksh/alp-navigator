import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { rates } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rateId = parseInt(id, 10);
  if (isNaN(rateId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: rates.id })
    .from(rates)
    .where(eq(rates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { status, rawText, parsedData, proposals, isConfirmed, sortOrder } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (rawText !== undefined) updates.rawText = rawText;
  if (parsedData !== undefined) updates.parsedData = JSON.stringify(parsedData);
  if (proposals !== undefined) updates.proposals = JSON.stringify(proposals);
  if (isConfirmed !== undefined) updates.isConfirmed = isConfirmed ? 1 : 0;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  await db.update(rates).set(updates).where(eq(rates.id, rateId));

  const [updated] = await db
    .select()
    .from(rates)
    .where(eq(rates.id, rateId))
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
    .select({ id: rates.id })
    .from(rates)
    .where(eq(rates.id, rateId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(rates).where(eq(rates.id, rateId));

  return NextResponse.json({ success: true });
}
