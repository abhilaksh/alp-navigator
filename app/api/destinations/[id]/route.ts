import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { destinations } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const destId = parseInt(id, 10);
  if (isNaN(destId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(eq(destinations.id, destId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, country, checkin, checkout, nights, sortOrder, narrative } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (country !== undefined) updates.country = country;
  if (checkin !== undefined) updates.checkin = checkin;
  if (checkout !== undefined) updates.checkout = checkout;
  if (nights !== undefined) updates.nights = nights;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (narrative !== undefined) updates.narrative = narrative;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(destinations).set(updates).where(eq(destinations.id, destId));

  const [updated] = await db
    .select()
    .from(destinations)
    .where(eq(destinations.id, destId))
    .limit(1);

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const destId = parseInt(id, 10);
  if (isNaN(destId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(eq(destinations.id, destId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(destinations).where(eq(destinations.id, destId));

  return NextResponse.json({ success: true });
}
