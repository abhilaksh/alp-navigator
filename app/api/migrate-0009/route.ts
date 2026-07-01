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
      await db.execute(sql`ALTER TABLE \`rates\` ADD COLUMN \`expires_at\` date DEFAULT NULL`);
    } catch (e) { if (!isDuplicateColumnError(e)) throw e; }
    return NextResponse.json({ ok: true, migration: '0009_rate_expires_at', message: 'expires_at added to rates' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
