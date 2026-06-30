import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_stated_inr INT NULL`);
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_estimated_inr INT NULL`);
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS urgency_flag VARCHAR(20) NULL DEFAULT 'standard'`);
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS clarification_flags TEXT NULL`);
    return NextResponse.json({ ok: true, message: 'Migration 0013: budget and clarification_flags columns added' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
