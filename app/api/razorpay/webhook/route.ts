import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleSubscriptionWebhook } from '@/lib/payments/razorpay';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const payload = JSON.parse(body) as Record<string, unknown>;
  const event = payload.event as string;

  await handleSubscriptionWebhook(event, payload);

  return NextResponse.json({ received: true });
}
