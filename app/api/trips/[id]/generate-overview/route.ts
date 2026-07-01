import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { trips } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { extractNarrative } from '@/lib/ai/extract-narrative';

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
  const { destinations, hotels, clientName } = body as {
    destinations?: string;
    hotels?: string;
    clientName?: string | null;
  };

  const apiKey = process.env.HAPUPPY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const systemPrompt = `You are a luxury travel advisor writing a personal proposal. Write warmly but concisely. No exclamation marks. No filler phrases like "discover" or "unveil". Facts over superlatives.`;
  const userPrompt = `Write a 2-3 sentence journey overview paragraph for a luxury proposal.
Destinations: ${destinations ?? 'not specified'}
Hotels: ${hotels || 'to be confirmed'}
Client: ${clientName ?? 'a discerning traveller'}

Write in first-person plural (we/your) from the advisor's voice. Focus on the emotional arc: why this sequence, why now. Do not list logistics. No exclamation marks.`;

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
        temperature: 0.7,
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
