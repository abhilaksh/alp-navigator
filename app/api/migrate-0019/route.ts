import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { isDuplicateColumnError } from '@/lib/db/migrate-utils';

function isAlreadyExistsError(err: unknown): boolean {
  return err instanceof Error && /duplicate (column name|key name)|already exists/i.test(err.message);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN is_blueprint INT NOT NULL DEFAULT 0`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN source_blueprint_id INT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE trips ADD CONSTRAINT trips_source_blueprint_id_fk FOREIGN KEY (source_blueprint_id) REFERENCES trips(id) ON DELETE SET NULL`);
    } catch (err) { if (!isAlreadyExistsError(err)) throw err; }
    try {
      await db.execute(sql`ALTER TABLE destinations ADD COLUMN day_offset INT NULL`);
    } catch (err) { if (!isDuplicateColumnError(err)) throw err; }
    return NextResponse.json({ ok: true, message: 'migrate-0019: added is_blueprint, source_blueprint_id to trips; day_offset to destinations' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
