import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems, hotelDetails } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const hotelDetailId = parseInt(id, 10);
  if (isNaN(hotelDetailId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [existing] = await db
    .select({ id: hotelDetails.id, itemId: hotelDetails.itemId })
    .from(hotelDetails)
    .where(eq(hotelDetails.id, hotelDetailId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, recommendation, locationScore, lat, lng, sortOrder, holdExpiresAt, preferredStatus, eliminationNote, familiarityScore, familiarityDate, commissionPct, commissionAmountInr, commissionPaidAt, googleRateInr, rating } = body;

  // Update tripItems fields
  const itemUpdates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) itemUpdates.title = name;
  if (sortOrder !== undefined) itemUpdates.sortOrder = sortOrder;
  if (name !== undefined || sortOrder !== undefined) {
    await db.update(tripItems).set(itemUpdates).where(eq(tripItems.id, existing.itemId));
  }

  // Update hotelDetails fields
  const detailUpdates: Record<string, unknown> = {};
  if (recommendation !== undefined) detailUpdates.recommendation = recommendation;
  if (locationScore !== undefined) detailUpdates.locationScore = locationScore;
  if (lat !== undefined) detailUpdates.lat = lat;
  if (lng !== undefined) detailUpdates.lng = lng;
  if (holdExpiresAt !== undefined) detailUpdates.holdExpiresAt = holdExpiresAt || null;
  if (preferredStatus !== undefined) detailUpdates.preferredStatus = preferredStatus;
  if (eliminationNote !== undefined) detailUpdates.eliminationNote = eliminationNote || null;
  if (familiarityScore !== undefined) detailUpdates.familiarityScore = familiarityScore || null;
  if (familiarityDate !== undefined) detailUpdates.familiarityDate = familiarityDate || null;
  if (commissionPct !== undefined) detailUpdates.commissionPct = commissionPct ?? null;
  if (commissionAmountInr !== undefined) detailUpdates.commissionAmountInr = commissionAmountInr ?? null;
  if (commissionPaidAt !== undefined) detailUpdates.commissionPaidAt = commissionPaidAt || null;
  if (googleRateInr !== undefined) detailUpdates.googleRateInr = googleRateInr ?? null;
  if (rating !== undefined) detailUpdates.rating = rating ?? null;

  if (Object.keys(detailUpdates).length > 0) {
    await db.update(hotelDetails).set(detailUpdates).where(eq(hotelDetails.id, hotelDetailId));
  }

  const [updatedDetail] = await db
    .select()
    .from(hotelDetails)
    .where(eq(hotelDetails.id, hotelDetailId))
    .limit(1);

  const [updatedItem] = await db
    .select()
    .from(tripItems)
    .where(eq(tripItems.id, existing.itemId))
    .limit(1);

  return NextResponse.json({ item: updatedItem, hotelDetail: updatedDetail });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const hotelDetailId = parseInt(id, 10);
  if (isNaN(hotelDetailId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Get the itemId so we can delete the tripItems row (cascades to hotelDetails + rates)
  const [existing] = await db
    .select({ itemId: hotelDetails.itemId })
    .from(hotelDetails)
    .where(eq(hotelDetails.id, hotelDetailId))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(tripItems).where(eq(tripItems.id, existing.itemId));

  return NextResponse.json({ success: true });
}
