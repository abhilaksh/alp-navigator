import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { isDuplicateColumnError } from '@/lib/db/migrate-utils';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN blueprint_country VARCHAR(100) NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN blueprint_tags TEXT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    return NextResponse.json({ ok: true, message: 'migrate-0020: added blueprint_country, blueprint_tags to trips' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
