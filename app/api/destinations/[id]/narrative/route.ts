import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { destinations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const destId = parseInt(id, 10);
  if (isNaN(destId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Load destination for context
  const [dest] = await db.select().from(destinations).where(eq(destinations.id, destId)).limit(1);
  if (!dest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { hotelNames, nights, clientContext } = await req.json().catch(() => ({})) as {
    hotelNames?: string[];
    nights?: number;
    clientContext?: string;
  };

  const name = dest.name;
  const country = dest.country ?? '';
  const nightsStr = nights || dest.nights ? `${nights ?? dest.nights} nights` : '';
  const hotelLine = hotelNames?.length ? `The selected hotels are: ${hotelNames.join(', ')}.` : '';
  const clientLine = clientContext ? `This is for ${clientContext}.` : '';

  const systemPrompt = `You are a luxury travel writer for Alp Travel Co., an independent Fora Pro travel advisor.
Write concise, editorial destination introductions. Voice: confident, warm, specific.
Short sentences. No exclamation marks. No superlatives without evidence.
Never use phrases like "unveil", "discover the wonders", "stunning".
Write like a knowledgeable friend who has been there, not a travel brochure.`;

  const userPrompt = `Write a 2–3 sentence editorial introduction for ${name}${country ? `, ${country}` : ''} in a luxury travel quote.
${nightsStr ? `The client will spend ${nightsStr} there.` : ''} ${hotelLine} ${clientLine}
Focus on what makes this destination worth the trip — a specific quality, the right season detail, or the mood of the place.
Keep it under 60 words. No heading, no bullet points. Plain prose only.`.trim();

  try {
    const aiRes = await fetch('https://beta.hapuppy.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HAPUPPY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 });
    }

    const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const narrative = aiData.choices?.[0]?.message?.content?.trim() ?? '';

    if (!narrative) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    // Save to DB
    await db.update(destinations)
      .set({ narrative })
      .where(eq(destinations.id, destId));

    return NextResponse.json({ narrative });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
