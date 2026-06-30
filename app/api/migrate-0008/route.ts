import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== (process.env.MIGRATION_TOKEN ?? 'alp-migrate-2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN IF NOT EXISTS \`intake_status\` varchar(30) DEFAULT 'new_inquiry'`);
    await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN IF NOT EXISTS \`acknowledged_at\` bigint DEFAULT NULL`);
    await db.execute(sql`ALTER TABLE \`trips\` ADD COLUMN IF NOT EXISTS \`brief_complete_at\` bigint DEFAULT NULL`);
    return NextResponse.json({ ok: true, migration: '0008_intake_status', message: 'intake_status, acknowledged_at, brief_complete_at added to trips' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
