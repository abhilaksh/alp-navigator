import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS item_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        source VARCHAR(30),
        source_label VARCHAR(100),
        raw_text TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'idle',
        is_confirmed INT NOT NULL DEFAULT 0,
        parsed_data TEXT,
        proposals TEXT,
        error_message TEXT,
        history TEXT,
        expires_at DATE,
        sort_order INT NOT NULL DEFAULT 0,
        added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT item_rates_item_id_fk FOREIGN KEY (item_id) REFERENCES trip_items(id) ON DELETE CASCADE
      )
    `);
    return NextResponse.json({ ok: true, message: 'migrate-0022: created item_rates table' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
