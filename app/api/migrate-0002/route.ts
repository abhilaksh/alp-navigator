import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

const TOKEN = process.env.MIGRATE_TOKEN;

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('token');
  if (!TOKEN || t !== TOKEN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const results: string[] = [];

  const migrations = [
    { name: 'trip_items.cancellation_free_until', check: "SHOW COLUMNS FROM trip_items LIKE 'cancellation_free_until'", run: "ALTER TABLE trip_items ADD COLUMN cancellation_free_until DATE NULL" },
    { name: 'trip_items.visa_required',           check: "SHOW COLUMNS FROM trip_items LIKE 'visa_required'",           run: "ALTER TABLE trip_items ADD COLUMN visa_required TINYINT(1) NOT NULL DEFAULT 0" },
    { name: 'trips.fx_date',                      check: "SHOW COLUMNS FROM trips LIKE 'fx_date'",                      run: "ALTER TABLE trips ADD COLUMN fx_date VARCHAR(10) NULL" },
    { name: 'trips.fx_source',                    check: "SHOW COLUMNS FROM trips LIKE 'fx_source'",                    run: "ALTER TABLE trips ADD COLUMN fx_source VARCHAR(50) NULL" },
    { name: 'trips.fx_buffer_pct',                check: "SHOW COLUMNS FROM trips LIKE 'fx_buffer_pct'",                run: "ALTER TABLE trips ADD COLUMN fx_buffer_pct FLOAT NULL" },
    { name: 'trips.fx_usd_to_inr',                check: "SHOW COLUMNS FROM trips LIKE 'fx_usd_to_inr'",                run: "ALTER TABLE trips ADD COLUMN fx_usd_to_inr FLOAT NULL" },
  ];

  for (const m of migrations) {
    try {
      const rows = await db.execute(sql.raw(m.check));
      if ((rows as unknown[]).length > 0) {
        results.push(`SKIP ${m.name} (already exists)`);
        continue;
      }
      await db.execute(sql.raw(m.run));
      results.push(`OK   ${m.name}`);
    } catch (e) {
      results.push(`ERR  ${m.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ results });
}
