import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await db.execute(sql`
      ALTER TABLE destinations
        ADD COLUMN IF NOT EXISTS hero_image TEXT NULL
    `);
    await db.execute(sql`
      ALTER TABLE trips
        ADD COLUMN IF NOT EXISTS hero_image TEXT NULL
    `);

    return NextResponse.json({ ok: true, message: 'Migration 0017: hero_image columns added' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
