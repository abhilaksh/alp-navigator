import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, changeRequests } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [trip] = await db.select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const requests = await db.select()
    .from(changeRequests)
    .where(eq(changeRequests.tripId, tripId))
    .orderBy(desc(changeRequests.createdAt));

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [trip] = await db.select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as {
    category?: string;
    text?: string;
    snapshotVersion?: number | null;
  };

  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const validCategories = ['hotel_swap', 'date_change', 'activity_add', 'budget_adjust', 'other'];
  const category = validCategories.includes(body.category ?? '') ? (body.category ?? 'other') : 'other';

  const [inserted] = await db.insert(changeRequests).values({
    tripId,
    category,
    text: body.text.trim(),
    status: 'open',
    snapshotVersion: body.snapshotVersion ?? null,
  });

  const newId = (inserted as { insertId?: number }).insertId;
  if (!newId) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });

  const [created] = await db.select().from(changeRequests).where(eq(changeRequests.id, newId)).limit(1);
  return NextResponse.json(created, { status: 201 });
}
