import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

const WP_API = 'https://alptravel.co/wp-json/wp/v2';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { query } = body;
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const params = new URLSearchParams({
    search: query,
    per_page: '20',
    _fields: 'id,title,slug,link,acf,featured_media,_links,_embedded',
    _embed: 'wp:featuredmedia',
  });

  let wpRes: Response;
  try {
    wpRes = await fetch(`${WP_API}/hotel?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `WP request failed: ${message}` }, { status: 502 });
  }

  if (!wpRes.ok) {
    return NextResponse.json({ error: `WP API error ${wpRes.status}` }, { status: 502 });
  }

  const posts: WpHotel[] = await wpRes.json();

  const results = posts.map(p => {
    const thumbnail = p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null;
    return {
      id: `wp-${p.id}`,
      name: p.title?.rendered ?? '',
      stars: p.acf?.hotel_class ?? 0,
      rating: p.acf?.average_review_rating ?? 0,
      reviews: p.acf?.total_review_count ?? 0,
      googleRateInr: null,
      thumbnail,
      foraId: null,
      isForaPreferred: false,
      isForaReserve: false,
      foraPrograms: [] as string[],
      foraPerks: null,
      commissionRange: null,
      awards: [] as string[],
      isVirtuoso: false,
      lat: p.acf?.lat ?? undefined,
      lng: p.acf?.lon ?? undefined,
      hotelWebsite: null,
      locationLabel: p.acf?.location_label ?? null,
      editorialTake: p.acf?.editorial_take ?? null,
      featured: Boolean(p.acf?.featured),
      wpId: p.id,
      wpSlug: p.slug,
      source: 'wp' as const,
    };
  });

  return NextResponse.json({ results, total: results.length });
}

interface WpHotel {
  id: number;
  slug: string;
  title?: { rendered: string };
  link?: string;
  featured_media?: number;
  acf?: {
    tier?: string;
    location_label?: string;
    editorial_take?: string;
    featured?: boolean;
    hotel_class?: number;
    average_review_rating?: number;
    total_review_count?: number;
    all_time_booking_count?: number;
    lat?: number;
    lon?: number;
  };
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
  };
}
