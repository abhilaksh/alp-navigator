import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { extractNarrative } from '@/lib/ai/extract-narrative';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [trip] = await db.select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { tripLabel, clientName, destinations, totalFromInr, previewUrl, personalNote } = body as {
    tripLabel: string;
    clientName: string | null;
    destinations: Array<{ name: string; checkin?: string | null; checkout?: string | null; nights?: number | null; hotels: string[] }>;
    totalFromInr: number | null;
    previewUrl: string | null;
    personalNote?: string | null;
  };

  const apiKey = await getIntegrationKey((await getUserWithTeam(user.id))?.teamId ?? null, 'hapuppyApiKey');
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const firstName = clientName?.split(' ')[0] ?? 'there';
  const destList = destinations.map(d => {
    const hotels = d.hotels.join(', ') || 'TBC';
    const dates = d.checkin ? `${d.checkin}${d.checkout ? ` – ${d.checkout}` : ''}` : '';
    return `${d.name}${dates ? ` (${dates})` : ''}: ${hotels}`;
  }).join('\n');

  const systemPrompt = `You are a luxury travel advisor. Write a WhatsApp message to a client about their travel proposal. Keep it concise: 5-8 lines maximum. No bullet points. Use natural conversational language. One or two light emoji maximum. Never use exclamation marks. Start with "Hi ${firstName}".`;
  const userPrompt = `Write a WhatsApp message summarising this travel proposal.

Trip: ${tripLabel}
Client: ${clientName ?? 'valued client'}
${personalNote ? `Your personal note to them: "${personalNote}"` : ''}
Destinations:
${destList}
${totalFromInr ? `Total from: ₹${totalFromInr.toLocaleString('en-IN')}` : ''}
${previewUrl ? `Preview link: ${previewUrl}` : ''}

Write 5-8 lines. Mention the preview link at the end. Be warm but concise. No exclamation marks.`;

  try {
    const resp = await fetch('https://beta.hapuppy.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1800,
        temperature: 0.75,
      }),
    });

    if (!resp.ok) return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const text = extractNarrative(raw);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
