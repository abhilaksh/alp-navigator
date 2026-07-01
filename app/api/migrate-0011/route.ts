import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { isDuplicateColumnError } from '@/lib/db/migrate-utils';

const TOKEN = 'alp-migrate-2026';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== TOKEN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN personal_note TEXT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN journey_overview TEXT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    return NextResponse.json({ ok: true, migration: '0011_proposal_narrative' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
