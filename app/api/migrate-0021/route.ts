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
      CREATE TABLE IF NOT EXISTS integration_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL UNIQUE,
        serpapi_key TEXT,
        pexels_api_key TEXT,
        hapuppy_api_key TEXT,
        cloudflare_account_id TEXT,
        cloudflare_images_api_token TEXT,
        r2_account_id TEXT,
        r2_access_key_id TEXT,
        r2_secret_access_key TEXT,
        r2_bucket_name TEXT,
        r2_public_url_base TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT integration_settings_team_id_fk FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);
    return NextResponse.json({ ok: true, message: 'migrate-0021: created integration_settings table' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
