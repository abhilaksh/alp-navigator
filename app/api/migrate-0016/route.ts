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
      CREATE TABLE IF NOT EXISTS advisor_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL UNIQUE,
        display_name VARCHAR(100),
        agency_name VARCHAR(150),
        tagline VARCHAR(255),
        email VARCHAR(255),
        whatsapp_number VARCHAR(30),
        fora_advisor_id VARCHAR(100),
        virtuoso_membership VARCHAR(100),
        iata_number VARCHAR(30),
        quote_footer TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);
    return NextResponse.json({ ok: true, message: 'Migration 0016: advisor_profiles table created' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
