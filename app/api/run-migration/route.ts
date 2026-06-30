import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

// One-shot migration endpoint — remove this file after running once.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await db.execute(sql`ALTER TABLE hotel_details ADD COLUMN hold_expires_at DATE NULL`);
    return NextResponse.json({ ok: true, message: 'Migration applied: hold_expires_at added.' });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'ER_DUP_FIELDNAME') {
      return NextResponse.json({ ok: true, message: 'Column already exists — skipped.' });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
