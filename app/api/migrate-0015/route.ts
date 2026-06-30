import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_pct FLOAT NULL`);
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_amount_inr INT NULL`);
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_paid_at VARCHAR(10) NULL`);
    return NextResponse.json({ ok: true, message: 'Migration 0015: commission fields added to hotel_details' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
