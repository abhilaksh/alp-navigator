import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { tripItems } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

const HAPUPPY_URL = 'https://beta.hapuppy.com/v1/chat/completions';
const HAPUPPY_KEY = process.env.HAPUPPY_API_KEY ?? '';

const SYSTEM_PROMPT = `You are an expert travel booking data extractor. Given a hotel booking confirmation email or text, extract the key booking details into structured JSON. Be precise and literal — only extract what is explicitly stated, never infer. Return ONLY the JSON object, no explanation.`;

function userPrompt(text: string): string {
  return `Extract booking confirmation data from this text. Return a JSON object with ONLY these fields (omit any field you cannot find):
{
  "booking_ref": string,           // hotel or portal booking reference/confirmation number
  "portal_ref": string,            // Fora/Expedia TAAP/portal reference if separate from hotel ref
  "hotel_name": string,            // confirmed hotel name
  "room_type": string,             // confirmed room category
  "checkin": string,               // ISO date YYYY-MM-DD
  "checkout": string,              // ISO date YYYY-MM-DD
  "nights": number,
  "adults": number,
  "board_basis": string,           // e.g. "Bed and Breakfast", "Room Only"
  "total_inr": number,             // total in INR if stated
  "total_usd": number,             // total in USD if stated
  "cancellation_free_until": string, // ISO date — last date for free cancellation
  "cancellation_deadline": string,   // ISO date — last date to cancel with any refund
  "special_requests_acknowledged": boolean,  // true if confirmation explicitly acknowledges special requests
  "perks": string[],               // Virtuoso/Fora amenities confirmed (e.g. ["Breakfast for 2", "$100 credit"])
  "notes": string                  // any other important info from the confirmation
}

Confirmation text:
${text}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Verify item belongs to user
  const [item] = await db
    .select({ id: tripItems.id, tripId: tripItems.tripId })
    .from(tripItems)
    .where(eq(tripItems.id, itemId))
    .limit(1);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { text } = body as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });

  try {
    const resp = await fetch(HAPUPPY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HAPUPPY_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt(text) },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 });
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '';

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'Could not parse AI response', raw }, { status: 422 });
    }

    return NextResponse.json({ parsed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
