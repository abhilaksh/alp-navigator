import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

interface SerpHotelResult {
  name?: string;
  overall_rating?: number;
  reviews?: number;
  description?: string;
  link?: string;
  website?: string;
  hotel_class?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  images?: { thumbnail?: string }[];
  rate_per_night?: { lowest?: string; extracted_lowest?: number };
  serpIdx?: number;
}

function parseInrRate(rateStr: string | undefined): number | null {
  if (!rateStr) return null;
  // Rate strings like "₹12,345" or "INR 12,345"
  const cleaned = rateStr.replace(/[^\d]/g, '');
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? null : val;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { query, checkin, checkout, adults, filters } = body;

  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'serpapiKey');
  if (!apiKey) return NextResponse.json({ error: 'SERPAPI_KEY not configured' }, { status: 500 });

  const searchParams = new URLSearchParams({
    engine: 'google_hotels',
    api_key: apiKey,
    q: query,
    ...(checkin && { check_in_date: checkin }),
    ...(checkout && { check_out_date: checkout }),
    ...(adults && { adults: String(adults) }),
    ...(filters?.hotel_class && { hotel_class: String(filters.hotel_class) }),
    ...(filters?.rating && { rating: String(filters.rating) }),
    ...(filters?.sort_by && { sort_by: String(filters.sort_by) }),
    ...(filters?.min_price && { min_price: String(filters.min_price) }),
    ...(filters?.max_price && { max_price: String(filters.max_price) }),
    ...(filters?.free_cancellation !== undefined && {
      free_cancellation: String(filters.free_cancellation),
    }),
    currency: 'INR',
    gl: 'in',
    hl: 'en',
  });

  const serpUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;

  let serpResponse: Response;
  try {
    serpResponse = await fetch(serpUrl, { signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `SerpAPI request failed: ${message}` }, { status: 502 });
  }

  if (!serpResponse.ok) {
    const errText = await serpResponse.text();
    return NextResponse.json(
      { error: `SerpAPI error ${serpResponse.status}: ${errText}` },
      { status: 502 },
    );
  }

  const serpData = await serpResponse.json();
  const hotelResults: SerpHotelResult[] = serpData?.properties ?? [];

  const mapped = hotelResults.map((h: SerpHotelResult, idx: number) => ({
    name: h.name ?? null,
    stars: h.hotel_class ? parseInt(h.hotel_class, 10) || null : null,
    rating: h.overall_rating ?? null,
    reviews: h.reviews ?? null,
    thumbnail: h.images?.[0]?.thumbnail ?? null,
    description: h.description ?? null,
    link: h.link ?? null,
    website: h.website ?? null,
    gps_coordinates: h.gps_coordinates ?? null,
    serpIdx: idx,
    rate_inr:
      h.rate_per_night?.extracted_lowest ??
      parseInrRate(h.rate_per_night?.lowest) ??
      null,
  }));

  return NextResponse.json({ results: mapped, total: mapped.length });
}
