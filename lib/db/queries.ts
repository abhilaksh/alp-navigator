import { desc, and, eq, isNull, count, min, isNotNull, ne } from 'drizzle-orm';
import { db } from './drizzle';
import {
  activityLogs,
  teamMembers,
  teams,
  users,
  trips,
  destinations,
  tripItems,
  hotelDetails,
  rates,
  clients,
  advisorProfiles,
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie?.value) return null;

  const sessionData = await verifyToken(sessionCookie.value);
  if (!sessionData?.user || typeof sessionData.user.id !== 'number') return null;
  if (new Date(sessionData.expires) < new Date()) return null;

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  return user[0] ?? null;
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({ user: users, teamId: teamMembers.teamId })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) return null;

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: { columns: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  return result?.team ?? null;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export async function getTeamByRazorpayCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.razorpayCustomerId, customerId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateTeamSubscription(
  teamId: number,
  data: {
    razorpaySubscriptionId: string | null;
    razorpayPlanId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db.update(teams).set({ ...data, updatedAt: new Date() }).where(eq(teams.id, teamId));
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTripsForUser() {
  const user = await getUser();
  if (!user) return [];

  return db
    .select()
    .from(trips)
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.updatedAt));
}

export async function getTripsWithDetailsForUser(includeArchived = false) {
  const user = await getUser();
  if (!user) return [];

  const destCountSq = db
    .select({
      tripId: destinations.tripId,
      cnt: count(destinations.id).as('cnt'),
    })
    .from(destinations)
    .groupBy(destinations.tripId)
    .as('dest_cnt');

  return db
    .select({
      id: trips.id,
      label: trips.label,
      status: trips.status,
      adults: trips.adults,
      clientId: trips.clientId,
      clientName: clients.name,
      totalFromInr: trips.totalFromInr,
      updatedAt: trips.updatedAt,
      createdAt: trips.createdAt,
      destinationCount: destCountSq.cnt,
      firstViewedAt: trips.firstViewedAt,
    })
    .from(trips)
    .leftJoin(clients, eq(trips.clientId, clients.id))
    .leftJoin(destCountSq, eq(trips.id, destCountSq.tripId))
    .where(and(
      eq(trips.userId, user.id),
      includeArchived ? undefined : ne(trips.status, 'archived'),
    ))
    .orderBy(desc(trips.updatedAt));
}

export async function getCommissionSummaryForUser(): Promise<{
  expected: number; received: number; pending: number; count: number;
}> {
  const user = await getUser();
  if (!user) return { expected: 0, received: 0, pending: 0, count: 0 };

  const rows = await db
    .select({
      commissionAmountInr: hotelDetails.commissionAmountInr,
      commissionPaidAt: hotelDetails.commissionPaidAt,
    })
    .from(hotelDetails)
    .innerJoin(tripItems, eq(tripItems.id, hotelDetails.itemId))
    .innerJoin(trips, eq(trips.id, tripItems.tripId))
    .where(and(eq(trips.userId, user.id), isNotNull(hotelDetails.commissionAmountInr)));

  let expected = 0, received = 0, count = 0;
  for (const r of rows) {
    const amt = r.commissionAmountInr ?? 0;
    if (amt > 0) {
      expected += amt;
      count++;
      if (r.commissionPaidAt) received += amt;
    }
  }
  return { expected, received, pending: expected - received, count };
}

export async function getHoldExpiryByTrip(userId: number): Promise<Map<number, string>> {
  const rows = await db
    .select({
      tripId: trips.id,
      minHoldExpiry: min(hotelDetails.holdExpiresAt).as('min_hold'),
    })
    .from(trips)
    .innerJoin(tripItems, eq(tripItems.tripId, trips.id))
    .innerJoin(hotelDetails, eq(hotelDetails.itemId, tripItems.id))
    .where(and(eq(trips.userId, userId), isNotNull(hotelDetails.holdExpiresAt)))
    .groupBy(trips.id);

  const map = new Map<number, string>();
  for (const r of rows) {
    if (r.tripId && r.minHoldExpiry) map.set(r.tripId, String(r.minHoldExpiry));
  }
  return map;
}

export async function getTripById(id: number) {
  const user = await getUser();
  if (!user) return null;

  // Full trip with destinations → items (type='hotel') → hotelDetails → rates
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, id), eq(trips.userId, user.id)),
    with: {
      client: true,
      destinations: {
        orderBy: (d, { asc }) => [asc(d.sortOrder)],
        with: {
          items: {
            orderBy: (i, { asc }) => [asc(i.sortOrder)],
            with: {
              hotelDetails: {
                with: {
                  rates: {
                    orderBy: (r, { asc }) => [asc(r.sortOrder)],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return trip ?? null;
}

export async function getTripByPreviewKey(key: string) {
  const result = await db
    .select()
    .from(trips)
    .where(eq(trips.previewKey, key))
    .limit(1);

  return result[0] ?? null;
}

export async function getTripWithDetailsByPreviewKey(key: string) {
  const now = Date.now();

  const trip = await db.query.trips.findFirst({
    where: eq(trips.previewKey, key),
    with: {
      client: true,
      destinations: {
        orderBy: (d, { asc }) => [asc(d.sortOrder)],
        with: {
          items: {
            orderBy: (i, { asc }) => [asc(i.sortOrder)],
            with: {
              hotelDetails: {
                with: {
                  rates: {
                    orderBy: (r, { asc }) => [asc(r.sortOrder)],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!trip) return null;
  if (trip.previewExpiresAt && trip.previewExpiresAt < now) return 'expired';

  return trip;
}

// ─── Advisor Profile ──────────────────────────────────────────────────────────

export async function getAdvisorProfileByTeamId(teamId: number) {
  const [profile] = await db
    .select()
    .from(advisorProfiles)
    .where(eq(advisorProfiles.teamId, teamId))
    .limit(1);
  return profile ?? null;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getClientsForUser() {
  const user = await getUser();
  if (!user) return [];

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return [];

  return db
    .select()
    .from(clients)
    .where(eq(clients.teamId, userWithTeam.teamId))
    .orderBy(clients.name);
}
