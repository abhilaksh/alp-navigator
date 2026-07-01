import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { itineraryDays, trips } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { extractNarrative } from '@/lib/ai/extract-narrative';

type Params = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `You write evocative, specific day-by-day travel narratives for a luxury travel advisor in India who works with high-net-worth clients.

Your prose is warm, precise, and confident — never generic, never promotional. You write as though you know these places personally. Short sentences. Active voice. No exclamation marks. No filler phrases like "explore" or "discover the wonders." Perks and inclusions are stated as facts, not selling points.

When given a day's context (destination, date, hotels, planned activities, notes), write 3–5 sentences that:
- Name the specific place and what makes it worth a full day
- Reference any hotels, restaurants, or experiences mentioned
- Include a specific, concrete detail that makes the day feel real
- End on an emotional note that carries into the next day

Return only the narrative paragraph — no headings, no bullet points, no markdown.`;

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dayId = Number(id);

  // Load day with blocks + trip ownership check
  const day = await db.query.itineraryDays.findFirst({
    where: eq(itineraryDays.id, dayId),
    with: {
      trip: { columns: { id: true, userId: true } },
      blocks: true,
    },
  });

  if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((day as { trip: { userId: number } }).trip?.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { destinationName, hotelNames, advisorNotes, existingSummary } = body as {
    destinationName?: string;
    hotelNames?: string[];
    advisorNotes?: string;
    existingSummary?: string;
  };

  // Build context prompt
  const contextParts: string[] = [];
  if (day.title) contextParts.push(`Day title: ${day.title}`);
  if (day.date) contextParts.push(`Date: ${day.date}`);
  if (day.dayNumber) contextParts.push(`Day number: ${day.dayNumber}`);
  if (destinationName) contextParts.push(`Destination: ${destinationName}`);
  if (hotelNames?.length) contextParts.push(`Hotels: ${hotelNames.join(', ')}`);

  // Include block content
  const textBlocks = (day.blocks as Array<{ type: string; content: string | null }>)
    .filter(b => b.content && b.type !== 'hotel_ref')
    .map(b => `[${b.type}] ${b.content}`)
    .join('\n');
  if (textBlocks) contextParts.push(`Day notes and blocks:\n${textBlocks}`);
  if (advisorNotes) contextParts.push(`Advisor notes: ${advisorNotes}`);
  if (existingSummary) contextParts.push(`Existing summary (improve on this): ${existingSummary}`);

  const userPrompt = contextParts.join('\n');

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
        temperature: 0.7,
        max_tokens: 1800,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: `AI API error: ${resp.status}`, detail: errText }, { status: 502 });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    const narrative = raw ? extractNarrative(raw) : '';
    if (!narrative) return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });

    return NextResponse.json({ narrative });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
