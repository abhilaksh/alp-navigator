import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

interface PexelsPhoto {
  id: number;
  src: { large: string; medium: string; small: string; landscape: string };
  alt: string;
  photographer: string;
  url: string;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ photos: [] });

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Pexels API key not configured' }, { status: 500 });

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ error: 'Pexels API error' }, { status: 502 });
  const data: PexelsResponse = await res.json();

  return NextResponse.json({
    photos: data.photos.map(p => ({
      id: p.id,
      url: p.src.large,
      thumb: p.src.medium,
      alt: p.alt,
      photographer: p.photographer,
      pexelsUrl: p.url,
    })),
  });
}
