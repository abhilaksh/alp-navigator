import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  nationality: z.string().max(100).optional(),
  passportExpiry: z.string().max(10).optional(),
  preferences: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) {
    return NextResponse.json({ error: 'No team' }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.teamId, userWithTeam.teamId))
    .orderBy(clients.name);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) {
    return NextResponse.json({ error: 'No team' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [inserted] = await db
    .insert(clients)
    .values({
      teamId: userWithTeam.teamId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      nationality: parsed.data.nationality || null,
      passportExpiry: parsed.data.passportExpiry || null,
      preferences: parsed.data.preferences || null,
      notes: parsed.data.notes || null,
    })
    .$returningId();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, inserted.id))
    .limit(1);

  return NextResponse.json(client, { status: 201 });
}
