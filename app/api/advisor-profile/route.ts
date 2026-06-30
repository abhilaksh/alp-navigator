import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { advisorProfiles, teamMembers } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

async function getTeamId(userId: number): Promise<number | null> {
  const [row] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return row?.teamId ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = await getTeamId(user.id);
  if (!teamId) return NextResponse.json({ error: 'No team found' }, { status: 400 });

  const [profile] = await db
    .select()
    .from(advisorProfiles)
    .where(eq(advisorProfiles.teamId, teamId))
    .limit(1);

  return NextResponse.json(profile ?? null);
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = await getTeamId(user.id);
  if (!teamId) return NextResponse.json({ error: 'No team found' }, { status: 400 });

  const body = await req.json();
  const {
    displayName, agencyName, tagline, email,
    whatsappNumber, foraAdvisorId, virtuosoMembership, iataNumber, quoteFooter,
  } = body;

  const [existing] = await db
    .select({ id: advisorProfiles.id })
    .from(advisorProfiles)
    .where(eq(advisorProfiles.teamId, teamId))
    .limit(1);

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (displayName !== undefined) data.displayName = displayName || null;
  if (agencyName !== undefined) data.agencyName = agencyName || null;
  if (tagline !== undefined) data.tagline = tagline || null;
  if (email !== undefined) data.email = email || null;
  if (whatsappNumber !== undefined) data.whatsappNumber = whatsappNumber || null;
  if (foraAdvisorId !== undefined) data.foraAdvisorId = foraAdvisorId || null;
  if (virtuosoMembership !== undefined) data.virtuosoMembership = virtuosoMembership || null;
  if (iataNumber !== undefined) data.iataNumber = iataNumber || null;
  if (quoteFooter !== undefined) data.quoteFooter = quoteFooter || null;

  if (existing) {
    await db.update(advisorProfiles).set(data).where(eq(advisorProfiles.teamId, teamId));
  } else {
    await db.insert(advisorProfiles).values({ teamId, ...data });
  }

  const [updated] = await db
    .select()
    .from(advisorProfiles)
    .where(eq(advisorProfiles.teamId, teamId))
    .limit(1);

  return NextResponse.json(updated);
}
