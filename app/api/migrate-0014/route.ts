import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS preferred_status VARCHAR(20) NULL DEFAULT 'none'`);
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS elimination_note TEXT NULL`);
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS familiarity_score INT NULL`);
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS familiarity_date VARCHAR(10) NULL`);
    return NextResponse.json({ ok: true, message: 'Migration 0014: preferred_status, elimination_note, familiarity fields added to hotel_details' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
