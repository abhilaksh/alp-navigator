import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Verify trip ownership
  const [existing] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const previewKey = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now

  await db
    .update(trips)
    .set({ previewKey, previewExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(trips.id, tripId));

  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  return NextResponse.json({
    url: `${baseUrl}/preview/${previewKey}`,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}
