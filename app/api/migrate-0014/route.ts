import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { isDuplicateColumnError } from '@/lib/db/migrate-utils';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    try {
      await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN preferred_status VARCHAR(20) NULL DEFAULT 'none'`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN elimination_note TEXT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN familiarity_score INT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN familiarity_date VARCHAR(10) NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    return NextResponse.json({ ok: true, message: 'Migration 0014: preferred_status, elimination_note, familiarity fields added to hotel_details' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
