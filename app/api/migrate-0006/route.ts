import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== (process.env.MIGRATION_TOKEN ?? 'alp-migrate-2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await db.execute(
      sql`ALTER TABLE \`trips\` ADD COLUMN IF NOT EXISTS \`first_viewed_at\` bigint DEFAULT NULL`
    );
    await db.execute(
      sql`ALTER TABLE \`trips\` ADD COLUMN IF NOT EXISTS \`view_count\` int NOT NULL DEFAULT 0`
    );
    return NextResponse.json({ ok: true, migration: '0006_trip_view_tracking', message: 'Columns first_viewed_at + view_count added to trips' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
