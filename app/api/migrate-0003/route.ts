import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

const TOKEN = process.env.MIGRATION_TOKEN ?? 'alp-migrate-2026';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`itinerary_days\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`trip_id\` int NOT NULL,
        \`destination_id\` int DEFAULT NULL,
        \`day_number\` int NOT NULL,
        \`date\` varchar(10) DEFAULT NULL,
        \`title\` varchar(255) DEFAULT NULL,
        \`summary\` text DEFAULT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`itinerary_days_trip_id_fk\` FOREIGN KEY (\`trip_id\`) REFERENCES \`trips\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`itinerary_days_dest_id_fk\` FOREIGN KEY (\`destination_id\`) REFERENCES \`destinations\`(\`id\`) ON DELETE SET NULL
      )
    `);
    results.push('itinerary_days: OK');
  } catch (e) {
    results.push(`itinerary_days: ${e}`);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`itinerary_blocks\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`day_id\` int NOT NULL,
        \`type\` varchar(30) NOT NULL,
        \`content\` text DEFAULT NULL,
        \`item_id\` int DEFAULT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`itinerary_blocks_day_id_fk\` FOREIGN KEY (\`day_id\`) REFERENCES \`itinerary_days\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`itinerary_blocks_item_id_fk\` FOREIGN KEY (\`item_id\`) REFERENCES \`trip_items\`(\`id\`) ON DELETE SET NULL
      )
    `);
    results.push('itinerary_blocks: OK');
  } catch (e) {
    results.push(`itinerary_blocks: ${e}`);
  }

  return NextResponse.json({ results });
}
