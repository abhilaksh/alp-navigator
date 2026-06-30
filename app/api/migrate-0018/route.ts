import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_accepted_at BIGINT NULL`);
    await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_acceptance_note TEXT NULL`);
    return NextResponse.json({ ok: true, message: 'migrate-0018: added client_accepted_at, client_acceptance_note to trips' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
