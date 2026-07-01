import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

function isDuplicateColumnError(err: unknown): boolean {
  return err instanceof Error && /duplicate column name/i.test(err.message);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    try {
      await db.execute(sql`ALTER TABLE destinations ADD COLUMN hero_image TEXT NULL`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN hero_image TEXT NULL`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }

    return NextResponse.json({ ok: true, message: 'Migration 0017: hero_image columns added' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
