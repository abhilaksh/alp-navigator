import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { clients, trips } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  nationality: z.string().max(100).optional(),
  passportExpiry: z.string().max(10).optional(),
  preferences: z.string().optional(),
  notes: z.string().optional(),
});

async function getClientOwnership(clientId: number, userId: number) {
  const userWithTeam = await getUserWithTeam(userId);
  if (!userWithTeam?.teamId) return null;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.teamId, userWithTeam.teamId)))
    .limit(1);

  return client ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = await getClientOwnership(parseInt(id), user.id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Also load their trips
  const clientTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.clientId, client.id))
    .orderBy(desc(trips.updatedAt));

  return NextResponse.json({ ...client, trips: clientTrips });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = await getClientOwnership(parseInt(id), user.id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updates: Partial<typeof clients.$inferInsert> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.email !== undefined) updates.email = d.email || null;
  if (d.phone !== undefined) updates.phone = d.phone || null;
  if (d.whatsapp !== undefined) updates.whatsapp = d.whatsapp || null;
  if (d.nationality !== undefined) updates.nationality = d.nationality || null;
  if (d.passportExpiry !== undefined) updates.passportExpiry = d.passportExpiry || null;
  if (d.preferences !== undefined) updates.preferences = d.preferences || null;
  if (d.notes !== undefined) updates.notes = d.notes || null;

  await db
    .update(clients)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(clients.id, client.id));

  const [updated] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, client.id))
    .limit(1);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = await getClientOwnership(parseInt(id), user.id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(clients).where(eq(clients.id, client.id));

  return NextResponse.json({ deleted: true });
}
