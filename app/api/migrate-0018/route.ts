import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

function isDuplicateColumnError(err: unknown): boolean {
  return err instanceof Error && /duplicate column name/i.test(err.message);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'alp-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN client_accepted_at BIGINT NULL`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
    try {
      await db.execute(sql`ALTER TABLE trips ADD COLUMN client_acceptance_note TEXT NULL`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
    return NextResponse.json({ ok: true, message: 'migrate-0018: added client_accepted_at, client_acceptance_note to trips' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
