import { NextRequest, NextResponse } from 'next/server';
import { getForaPartner } from '@/lib/fora/lookup';

export async function GET(req: NextRequest) {
  const foraId = req.nextUrl.searchParams.get('id');
  if (!foraId) return NextResponse.json(null);
  const partner = getForaPartner(foraId);
  return NextResponse.json(partner);
}
