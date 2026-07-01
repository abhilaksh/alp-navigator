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
      await db.execute(sql`ALTER TABLE trips ADD COLUMN budget_stated_inr INT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN budget_estimated_inr INT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN urgency_flag VARCHAR(20) NULL DEFAULT 'standard'`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN clarification_flags TEXT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    return NextResponse.json({ ok: true, message: 'Migration 0013: budget and clarification_flags columns added' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
