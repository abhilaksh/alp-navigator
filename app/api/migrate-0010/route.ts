import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== (process.env.MIGRATION_TOKEN ?? 'alp-migrate-2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`trip_snapshots\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`trip_id\` int NOT NULL,
        \`version\` int NOT NULL DEFAULT 1,
        \`label\` varchar(100) DEFAULT NULL,
        \`snapshot_json\` text NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`trip_snapshots_trip_id_fk\` FOREIGN KEY (\`trip_id\`) REFERENCES \`trips\`(\`id\`) ON DELETE CASCADE
      )
    `);
    return NextResponse.json({ ok: true, migration: '0010_trip_snapshots', message: 'trip_snapshots table created' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
