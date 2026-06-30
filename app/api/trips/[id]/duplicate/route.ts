import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, destinations, tripItems, hotelDetails, rates } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { randomBytes } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Fetch original trip with full nesting
  const [original] = await db.select().from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const originalDests = await db.select().from(destinations).where(eq(destinations.tripId, tripId));
  const originalItems = await db.select().from(tripItems).where(eq(tripItems.tripId, tripId));
  const originalItemIds = originalItems.map(i => i.id);

  // Only fetch hotel details if there are hotel items
  const originalDetails = originalItemIds.length > 0
    ? await db.select().from(hotelDetails)
        .where(eq(hotelDetails.itemId, originalItems.find(i => i.type === 'hotel')?.id ?? -1))
        .then(() =>
          Promise.all(
            originalItems.filter(i => i.type === 'hotel').map(i =>
              db.select().from(hotelDetails).where(eq(hotelDetails.itemId, i.id)).limit(1)
                .then(rows => rows[0] ?? null)
            )
          )
        )
    : [];

  const detailByItemId = new Map<number, typeof originalDetails[0]>();
  for (const d of originalDetails) {
    if (d) detailByItemId.set(d.itemId, d);
  }

  // Fetch rates for each hotel detail
  const detailIds = originalDetails.filter(Boolean).map(d => d!.id);
  const allRates = detailIds.length > 0
    ? await Promise.all(detailIds.map(dId =>
        db.select().from(rates).where(eq(rates.hotelDetailId, dId))
      ))
    : [];
  const ratesByDetailId = new Map<number, typeof allRates[0]>();
  for (let i = 0; i < detailIds.length; i++) {
    ratesByDetailId.set(detailIds[i], allRates[i] ?? []);
  }

  // ── Create new trip ──────────────────────────────────────────────────────────
  const newPreviewKey = randomBytes(12).toString('hex');
  const [newTrip] = await db.insert(trips).values({
    teamId: original.teamId,
    userId: original.userId,
    clientId: original.clientId,
    label: `${original.label} (copy)`,
    adults: original.adults,
    children: original.children,
    status: 'draft',
    previewKey: newPreviewKey,
    previewExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    notes: original.notes,
    fxDate: original.fxDate,
    fxSource: original.fxSource,
    fxBufferPct: original.fxBufferPct,
    fxUsdToInr: original.fxUsdToInr,
    budgetStatedInr: original.budgetStatedInr,
    budgetEstimatedInr: original.budgetEstimatedInr,
    urgencyFlag: original.urgencyFlag,
  }).then(() =>
    db.select().from(trips).where(eq(trips.previewKey, newPreviewKey)).limit(1)
  );

  const newTripId = newTrip.id;

  // ── Copy destinations ────────────────────────────────────────────────────────
  const destIdMap = new Map<number, number>(); // old id → new id
  for (const dest of originalDests) {
    await db.insert(destinations).values({
      tripId: newTripId,
      name: dest.name,
      country: dest.country,
      checkin: dest.checkin,
      checkout: dest.checkout,
      nights: dest.nights,
      narrative: dest.narrative,
      sortOrder: dest.sortOrder,
    });
    const [newDest] = await db.select().from(destinations)
      .where(and(eq(destinations.tripId, newTripId), eq(destinations.sortOrder, dest.sortOrder)))
      .limit(1);
    destIdMap.set(dest.id, newDest.id);
  }

  // ── Copy trip items, hotel details, and rates ────────────────────────────────
  for (const item of originalItems) {
    const newDestId = item.destinationId ? destIdMap.get(item.destinationId) : null;

    await db.insert(tripItems).values({
      destinationId: newDestId ?? null,
      tripId: newTripId,
      type: item.type,
      title: item.title,
      bookingStatus: 'researching',  // reset booking status on copy
      bookingRef: null,
      confirmedTotalInr: null,
      startDate: item.startDate,
      endDate: item.endDate,
      startTime: item.startTime,
      detailsJson: item.detailsJson,
      sortOrder: item.sortOrder,
    });

    // Find the new item by tripId + sortOrder + type + title
    const [newItem] = await db.select().from(tripItems)
      .where(and(
        eq(tripItems.tripId, newTripId),
        eq(tripItems.sortOrder, item.sortOrder),
        eq(tripItems.type, item.type),
      ))
      .limit(1);

    if (item.type === 'hotel') {
      const detail = detailByItemId.get(item.id);
      if (detail) {
        await db.insert(hotelDetails).values({
          itemId: newItem.id,
          stars: detail.stars,
          rating: detail.rating,
          reviews: detail.reviews,
          locationScore: detail.locationScore,
          recommendation: detail.recommendation,
          source: detail.source,
          foraId: detail.foraId,
          hotelWebsite: detail.hotelWebsite,
          googleRateInr: detail.googleRateInr,
          thumbnail: detail.thumbnail,
          lat: detail.lat,
          lng: detail.lng,
          preferredStatus: detail.preferredStatus,
          eliminationNote: detail.eliminationNote,
          familiarityScore: detail.familiarityScore,
          familiarityDate: detail.familiarityDate,
          // Don't copy commission — these are per-booking
        });

        const [newDetail] = await db.select().from(hotelDetails)
          .where(eq(hotelDetails.itemId, newItem.id))
          .limit(1);

        const itemRates = ratesByDetailId.get(detail.id) ?? [];
        for (const rate of itemRates) {
          await db.insert(rates).values({
            hotelDetailId: newDetail.id,
            source: rate.source,
            sourceLabel: rate.sourceLabel,
            rawText: rate.rawText,
            status: rate.status === 'done' ? 'done' : 'idle',
            isConfirmed: 0,
            parsedData: rate.parsedData,
            sortOrder: rate.sortOrder,
          });
        }
      }
    }
  }

  return NextResponse.json({ tripId: newTripId });
}
