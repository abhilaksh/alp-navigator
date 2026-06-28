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
    _fields: 'id,title,slug,link,acf,_links',
  });

  let wpRes: Response;
  try {
    wpRes = await fetch(`${WP_API}/hotels?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `WP request failed: ${message}` }, { status: 502 });
  }

  if (!wpRes.ok) {
    return NextResponse.json({ error: `WP API error ${wpRes.status}` }, { status: 502 });
  }

  const posts: WpHotel[] = await wpRes.json();

  const results = posts.map(p => ({
    id: `wp-${p.id}`,
    name: p.title?.rendered ?? '',
    stars: parseInt(p.acf?.hotel_class ?? '0', 10) || 0,
    rating: parseFloat(p.acf?.rating ?? '0') || 0,
    reviews: 0,
    googleRateInr: null,
    thumbnail: p.acf?.thumbnail ?? null,
    foraId: p.acf?.fora_id ?? null,
    isForaPreferred: Boolean(p.acf?.is_fora_preferred),
    isVirtuoso: Boolean(p.acf?.is_virtuoso),
    lat: parseFloat(p.acf?.lat ?? '') || undefined,
    lng: parseFloat(p.acf?.lng ?? '') || undefined,
    hotelWebsite: p.acf?.hotel_website ?? null,
    wpId: p.id,
    wpSlug: p.slug,
    source: 'wp' as const,
  }));

  return NextResponse.json({ results, total: results.length });
}

interface WpHotel {
  id: number;
  slug: string;
  title?: { rendered: string };
  link?: string;
  acf?: {
    hotel_class?: string;
    rating?: string;
    thumbnail?: string;
    fora_id?: string;
    is_fora_preferred?: boolean;
    is_virtuoso?: boolean;
    lat?: string;
    lng?: string;
    hotel_website?: string;
  };
}
