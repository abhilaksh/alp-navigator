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
      await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN \`intake_status\` varchar(30) DEFAULT 'new_inquiry'`);
    } catch (e) { if (!isDuplicateColumnError(e)) throw e; }
    try {
      await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN \`acknowledged_at\` bigint DEFAULT NULL`);
    } catch (e) { if (!isDuplicateColumnError(e)) throw e; }
    try {
      await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN \`brief_complete_at\` bigint DEFAULT NULL`);
    } catch (e) { if (!isDuplicateColumnError(e)) throw e; }
    return NextResponse.json({ ok: true, migration: '0008_intake_status', message: 'intake_status, acknowledged_at, brief_complete_at added to trips' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
