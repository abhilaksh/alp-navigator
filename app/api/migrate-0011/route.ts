import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

const TOKEN = 'alp-migrate-2026';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== TOKEN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS personal_note TEXT NULL`);
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS journey_overview TEXT NULL`);
    return NextResponse.json({ ok: true, migration: '0011_proposal_narrative' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
