import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryDays, trips } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `You write concise WhatsApp itinerary summaries for a luxury travel advisor sharing a trip overview with their client.

Format: Plain text, no markdown, no asterisks, no emojis. Each day on its own line with a day number prefix (Day 1:, Day 2:, etc.). Maximum 2 sentences per day. The whole summary should be 5–10 lines total. Include hotel name where relevant. Readable in a WhatsApp preview.

Tone: Warm, personal, specific. As if the advisor is narrating the trip to their client in a voice note.`;

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tripId = Number(id);

  // Ownership check
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, user.id)),
    columns: { id: true, label: true },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const days = await db.query.itineraryDays.findMany({
    where: eq(itineraryDays.tripId, tripId),
    orderBy: [asc(itineraryDays.sortOrder), asc(itineraryDays.dayNumber)],
    with: { blocks: true },
  });

  if (days.length === 0) {
    return NextResponse.json({ error: 'No itinerary days to summarize' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { clientName } = body as { clientName?: string };

  // Build context
  const dayLines = days.map(d => {
    const hotels = (d.blocks as Array<{ type: string; content: string | null }>)
      .filter(b => b.type === 'hotel_ref' && b.content)
      .map(b => b.content)
      .join(', ');
    const notes = (d.blocks as Array<{ type: string; content: string | null }>)
      .filter(b => b.type !== 'hotel_ref' && b.content)
      .slice(0, 2)
      .map(b => b.content)
      .join('; ');
    return `Day ${d.dayNumber}${d.date ? ` (${d.date})` : ''}: ${d.title ?? ''}${hotels ? ` — ${hotels}` : ''}${notes ? `. ${notes}` : ''}${d.summary ? `. ${d.summary}` : ''}`;
  }).join('\n');

  const userPrompt = `Trip: ${trip.label}${clientName ? ` for ${clientName}` : ''}\n\n${dayLines}`;

  const apiKey = process.env.HAPUPPY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });

  try {
    const resp = await fetch('https://beta.hapuppy.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: `AI API error: ${resp.status}`, detail: errText }, { status: 502 });
    }

    const data = await resp.json();
    const summary = data?.choices?.[0]?.message?.content?.trim();
    if (!summary) return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });

    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
