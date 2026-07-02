import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // itinerary_blocks.item_id -> trip_items had NO ACTION on delete, so deleting
    // a hotel/flight/transfer/activity that's referenced in the itinerary threw an
    // uncaught FK violation (500) instead of just unlinking the stale reference.
    // item_id is nullable and content is stored independently on the block, so
    // SET NULL (not CASCADE) is correct -- the block keeps its content, just loses
    // the live link to the deleted item.
    await db.execute(sql`ALTER TABLE itinerary_blocks DROP FOREIGN KEY itinerary_blocks_ibfk_2`);
    await db.execute(sql`ALTER TABLE itinerary_blocks ADD CONSTRAINT itinerary_blocks_item_id_fk FOREIGN KEY (item_id) REFERENCES trip_items(id) ON DELETE SET NULL`);
    return NextResponse.json({ ok: true, message: 'migrate-0025: itinerary_blocks.item_id FK now ON DELETE SET NULL' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
