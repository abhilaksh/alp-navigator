import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

interface IgnavAirport {
  code: string;
  name: string;
  city: string;
  country: string;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q');
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'ignavApiKey');

  const searchParams = new URLSearchParams({ q, limit: '10' });
  const url = `https://ignav.com/api/airports?${searchParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: apiKey ? { 'X-Api-Key': apiKey } : {},
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ignav request failed: ${message}` }, { status: 502 });
  }

  if (!response.ok) {
    const errText = await response.text();
    const passthroughStatus = response.status === 401 || response.status === 402 ? response.status : 502;
    return NextResponse.json({ error: `Ignav error ${response.status}: ${errText}`, requiresApiKey: response.status === 401 }, { status: passthroughStatus });
  }

  const airports: IgnavAirport[] = await response.json();
  return NextResponse.json({ results: airports });
}
