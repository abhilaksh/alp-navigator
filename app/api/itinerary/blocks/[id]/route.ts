import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryBlocks, itineraryDays, ITINERARY_BLOCK_TYPES } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

async function verifyBlockOwnership(blockId: number, userId: number) {
  const block = await db.query.itineraryBlocks.findFirst({
    where: eq(itineraryBlocks.id, blockId),
    with: {
      day: {
        with: { trip: { columns: { id: true, userId: true } } },
      },
    },
  });
  if (!block) return null;
  const tripUserId = (block as { day: { trip: { userId: number } } }).day?.trip?.userId;
  if (tripUserId !== userId) return null;
  return block;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const blockId = Number(id);
  const block = await verifyBlockOwnership(blockId, user.id);
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const patch: Partial<typeof itineraryBlocks.$inferInsert> = {};
  if ('content' in body)   patch.content = body.content ?? null;
  if ('sortOrder' in body) patch.sortOrder = body.sortOrder;
  if ('type' in body) {
    if (!ITINERARY_BLOCK_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `Invalid block type: ${body.type}` }, { status: 400 });
    }
    patch.type = body.type;
  }
  if ('itemId' in body)    patch.itemId = body.itemId ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db.update(itineraryBlocks).set(patch).where(eq(itineraryBlocks.id, blockId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const blockId = Number(id);
  const block = await verifyBlockOwnership(blockId, user.id);
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(itineraryBlocks).where(eq(itineraryBlocks.id, blockId));
  return NextResponse.json({ ok: true });
}
