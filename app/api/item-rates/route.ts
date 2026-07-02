import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { itemRates } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { itemId, source, sourceLabel } = body;

  if (!itemId || !source) {
    return NextResponse.json({ error: 'itemId and source are required' }, { status: 400 });
  }

  const [inserted] = await db
    .insert(itemRates)
    .values({
      itemId,
      source,
      sourceLabel: sourceLabel ?? null,
      status: 'idle',
    })
    .$returningId();

  const [rate] = await db
    .select()
    .from(itemRates)
    .where(eq(itemRates.id, inserted.id))
    .limit(1);

  return NextResponse.json(rate, { status: 201 });
}
