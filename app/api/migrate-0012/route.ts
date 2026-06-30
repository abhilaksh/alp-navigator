import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS change_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trip_id INT NOT NULL,
        snapshot_version INT DEFAULT NULL,
        category VARCHAR(30) NOT NULL DEFAULT 'other',
        text TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      )
    `);
    return NextResponse.json({ ok: true, message: 'Migration 0012: change_requests table created' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
