import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { integrationSettings, teamMembers } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { getAllIntegrationKeys, type IntegrationField } from '@/lib/settings/integration-keys';

const FIELDS: IntegrationField[] = [
  'serpapiKey', 'ignavApiKey', 'pexelsApiKey', 'hapuppyApiKey',
  'cloudflareAccountId', 'cloudflareImagesApiToken',
  'r2AccountId', 'r2AccessKeyId', 'r2SecretAccessKey', 'r2BucketName', 'r2PublicUrlBase',
];

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

  const effective = await getAllIntegrationKeys(teamId);
  return NextResponse.json(effective);
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = await getTeamId(user.id);
  if (!teamId) return NextResponse.json({ error: 'No team found' }, { status: 400 });

  const body = await req.json();

  const [existing] = await db
    .select({ id: integrationSettings.id })
    .from(integrationSettings)
    .where(eq(integrationSettings.teamId, teamId))
    .limit(1);

  const data: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of FIELDS) {
    if (body[field] !== undefined) data[field] = body[field] || null;
  }

  if (existing) {
    await db.update(integrationSettings).set(data).where(eq(integrationSettings.teamId, teamId));
  } else {
    await db.insert(integrationSettings).values({ teamId, ...data });
  }

  const effective = await getAllIntegrationKeys(teamId);
  return NextResponse.json(effective);
}
