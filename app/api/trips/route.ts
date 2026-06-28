import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips, clients, teams, teamMembers } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db
    .select({
      id: trips.id,
      teamId: trips.teamId,
      userId: trips.userId,
      clientId: trips.clientId,
      label: trips.label,
      adults: trips.adults,
      children: trips.children,
      status: trips.status,
      previewKey: trips.previewKey,
      previewExpiresAt: trips.previewExpiresAt,
      totalFromInr: trips.totalFromInr,
      notes: trips.notes,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
      clientName: clients.name,
    })
    .from(trips)
    .leftJoin(clients, eq(trips.clientId, clients.id))
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.updatedAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  // clientName: create a new client record on the fly (from the new trip form)
  // clientId: directly attach an existing client (from other callers)
  const { label, adults, clientId: rawClientId, clientName } = body;

  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  // Get or auto-create team for user
  const userWithTeam = await getUserWithTeam(user.id);
  let teamId = userWithTeam?.teamId ?? null;

  if (!teamId) {
    const [newTeam] = await db
      .insert(teams)
      .values({ name: `${user.name ?? user.email}'s Team` })
      .$returningId();
    teamId = newTeam.id;
    await db.insert(teamMembers).values({
      userId: user.id,
      teamId: teamId,
      role: 'owner',
    });
  }

  // Resolve clientId: use provided, or create from clientName
  let resolvedClientId: number | null = rawClientId ?? null;
  if (!resolvedClientId && clientName && typeof clientName === 'string' && clientName.trim()) {
    const [newClient] = await db
      .insert(clients)
      .values({ teamId, name: clientName.trim() })
      .$returningId();
    resolvedClientId = newClient.id;
  }

  const [inserted] = await db
    .insert(trips)
    .values({
      teamId,
      userId: user.id,
      clientId: resolvedClientId,
      label: label.trim(),
      adults: typeof adults === 'number' && adults >= 1 ? adults : 2,
      status: 'draft',
    })
    .$returningId();

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
