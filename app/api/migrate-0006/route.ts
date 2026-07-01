import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { isDuplicateColumnError } from '@/lib/db/migrate-utils';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== (process.env.MIGRATION_TOKEN ?? 'alp-migrate-2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    try {
      await db.execute(
        sql`ALTER TABLE \`trips\` ADD COLUMN \`first_viewed_at\` bigint DEFAULT NULL`
      );
    } catch (e) {
      if (!isDuplicateColumnError(e)) throw e;
    }
    try {
      await db.execute(
        sql`ALTER TABLE \`trips\` ADD COLUMN \`view_count\` int NOT NULL DEFAULT 0`
      );
    } catch (e) {
      if (!isDuplicateColumnError(e)) throw e;
    }
    return NextResponse.json({ ok: true, migration: '0006_trip_view_tracking', message: 'Columns first_viewed_at + view_count added to trips' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
