import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { rates } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { hotelDetailId, source, sourceLabel } = body;

  if (!hotelDetailId || !source) {
    return NextResponse.json({ error: 'hotelDetailId and source are required' }, { status: 400 });
  }

  const [inserted] = await db
    .insert(rates)
    .values({
      hotelDetailId,
      source,
      sourceLabel: sourceLabel ?? null,
      status: 'idle',
    })
    .$returningId();

  const [rate] = await db
    .select()
    .from(rates)
    .where(eq(rates.id, inserted.id))
    .limit(1);

  return NextResponse.json(rate, { status: 201 });
}
