import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryBlocks, itineraryDays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

async function verifyDayOwnership(dayId: number, userId: number) {
  const day = await db.query.itineraryDays.findFirst({
    where: eq(itineraryDays.id, dayId),
    with: { trip: { columns: { id: true, userId: true } } },
  });
  if (!day) return null;
  if ((day as { trip: { userId: number } }).trip?.userId !== userId) return null;
  return day;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { dayId, type, content, itemId, sortOrder } = body;

  if (!dayId || !type) return NextResponse.json({ error: 'dayId and type required' }, { status: 400 });

  const day = await verifyDayOwnership(dayId, user.id);
  if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [row] = await db.insert(itineraryBlocks).values({
    dayId,
    type,
    content: content ?? null,
    itemId: itemId ?? null,
    sortOrder: sortOrder ?? 0,
  });

  const newBlock = await db.query.itineraryBlocks.findFirst({
    where: eq(itineraryBlocks.id, (row as { insertId: number }).insertId),
  });

  return NextResponse.json(newBlock, { status: 201 });
}
