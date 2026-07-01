import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, destinations } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

// Seeds the launch set of Journeys from the marketing site (alp-website-starter
// docs/copy/journeys-samples.md + docs/destinations/*) as reusable Navigator
// blueprints — reusable starting points an advisor can instantiate per client.
// Idempotent: skips any label that already exists as a blueprint for this user.

interface SeedDestination {
  name: string;
  country: string;
  nights: number;
}

interface SeedBlueprint {
  label: string;
  blueprintCountry: string;
  blueprintTags: string[];
  destinations: SeedDestination[];
}

const SEED_BLUEPRINTS: SeedBlueprint[] = [
  {
    label: 'Switzerland: The Rail Itinerary',
    blueprintCountry: 'Switzerland',
    blueprintTags: ['Rail', 'Alps', 'Scenic trains'],
    destinations: [
      { name: 'Lucerne', country: 'Switzerland', nights: 3 },
      { name: 'Zermatt', country: 'Switzerland', nights: 3 },
      { name: 'Jungfrau (Wengen)', country: 'Switzerland', nights: 3 },
    ],
  },
  {
    label: 'Morocco: A Honeymoon in Three Acts',
    blueprintCountry: 'Morocco',
    blueprintTags: ['Honeymoon', 'Desert', 'Riads'],
    destinations: [
      { name: 'Marrakech', country: 'Morocco', nights: 3 },
      { name: 'Atlas / Agafay', country: 'Morocco', nights: 2 },
      { name: 'Essaouira', country: 'Morocco', nights: 3 },
    ],
  },
  {
    label: 'Greece: The October Itinerary',
    blueprintCountry: 'Greece',
    blueprintTags: ['Islands', 'Ferries', 'October'],
    destinations: [
      { name: 'Athens', country: 'Greece', nights: 3 },
      { name: 'Santorini', country: 'Greece', nights: 3 },
      { name: 'Milos', country: 'Greece', nights: 2 },
      { name: 'Mykonos', country: 'Greece', nights: 2 },
    ],
  },
  {
    label: 'Singapore, With the Family',
    blueprintCountry: 'Singapore',
    blueprintTags: ['Family', 'City'],
    destinations: [
      { name: 'Singapore', country: 'Singapore', nights: 5 },
    ],
  },
  {
    label: 'Bali, For a Crowd',
    blueprintCountry: 'Indonesia',
    blueprintTags: ['Group trip', 'Islands', 'Villas'],
    destinations: [
      { name: 'Ubud', country: 'Indonesia', nights: 4 },
      { name: 'Gili Trawangan', country: 'Indonesia', nights: 3 },
      { name: 'Seminyak', country: 'Indonesia', nights: 3 },
    ],
  },
  {
    label: 'Uzbekistan: The Silk Road',
    blueprintCountry: 'Uzbekistan',
    blueprintTags: ['Silk Road', 'Visa-free', 'Rail'],
    destinations: [
      { name: 'Tashkent', country: 'Uzbekistan', nights: 1 },
      { name: 'Samarkand', country: 'Uzbekistan', nights: 2 },
      { name: 'Bukhara', country: 'Uzbekistan', nights: 2 },
      { name: 'Khiva', country: 'Uzbekistan', nights: 2 },
    ],
  },
];

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Must be logged in to seed blueprints' }, { status: 401 });

  const userWithTeam = await getUserWithTeam(user.id);
  const teamId = userWithTeam?.teamId;
  if (!teamId) return NextResponse.json({ error: 'No team found for user' }, { status: 400 });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const bp of SEED_BLUEPRINTS) {
    const [existing] = await db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.userId, user.id), eq(trips.label, bp.label), eq(trips.isBlueprint, 1)))
      .limit(1);

    if (existing) {
      skipped.push(bp.label);
      continue;
    }

    await db.insert(trips).values({
      teamId,
      userId: user.id,
      clientId: null,
      label: bp.label,
      adults: 2,
      status: 'draft',
      isBlueprint: 1,
      blueprintCountry: bp.blueprintCountry,
      blueprintTags: JSON.stringify(bp.blueprintTags),
    });

    const [newTrip] = await db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.userId, user.id), eq(trips.label, bp.label), eq(trips.isBlueprint, 1)))
      .limit(1);

    let dayOffset = 0;
    for (let i = 0; i < bp.destinations.length; i++) {
      const dest = bp.destinations[i];
      await db.insert(destinations).values({
        tripId: newTrip.id,
        name: dest.name,
        country: dest.country,
        nights: dest.nights,
        dayOffset,
        sortOrder: i,
      });
      dayOffset += dest.nights;
    }

    created.push(bp.label);
  }

  return NextResponse.json({ ok: true, created, skipped });
}
