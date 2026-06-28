import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems, hotelDetails } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    destinationId,
    tripId,
    name,
    stars,
    rating,
    serpData,
    thumbnail,
    lat,
    lng,
    googleRateInr,
    source,
    foraId,
    hotelWebsite,
  } = body;

  if (!destinationId || !tripId || !name) {
    return NextResponse.json(
      { error: 'destinationId, tripId, and name are required' },
      { status: 400 },
    );
  }

  // Create the tripItems row
  const [insertedItem] = await db
    .insert(tripItems)
    .values({
      destinationId,
      tripId,
      type: 'hotel',
      title: name,
      bookingStatus: 'researching',
    })
    .$returningId();

  const itemId = insertedItem.id;

  // Create the hotelDetails row
  const [insertedDetail] = await db
    .insert(hotelDetails)
    .values({
      itemId,
      stars: stars ?? null,
      rating: rating ?? null,
      source: source ?? 'manual',
      foraId: foraId ?? null,
      hotelWebsite: hotelWebsite ?? null,
      googleRateInr: googleRateInr ?? null,
      thumbnail: thumbnail ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      serpData: serpData ? JSON.stringify(serpData) : null,
    })
    .$returningId();

  const [item] = await db
    .select()
    .from(tripItems)
    .where(eq(tripItems.id, itemId))
    .limit(1);

  const [hotelDetail] = await db
    .select()
    .from(hotelDetails)
    .where(eq(hotelDetails.id, insertedDetail.id))
    .limit(1);

  return NextResponse.json({ item, hotelDetail }, { status: 201 });
}
