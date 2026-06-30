import { NextRequest, NextResponse } from 'next/server';
import { getVisaInfo } from '@/lib/visa/lookup';

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country');
  if (!country) return NextResponse.json(null);
  return NextResponse.json(getVisaInfo(country));
}
