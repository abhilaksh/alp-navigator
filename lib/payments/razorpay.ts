import Razorpay from 'razorpay';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Team } from '@/lib/db/schema';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS = [
  {
    name: 'Free',
    amountInr: 0,
    planId: null,
  },
  {
    name: 'Pro',
    amountInr: 1999,
    planId: process.env.RAZORPAY_PRO_PLAN_ID,
  },
  {
    name: 'Agency',
    amountInr: 4999,
    planId: process.env.RAZORPAY_AGENCY_PLAN_ID,
  },
] as const;

// ─── Subscription helpers ─────────────────────────────────────────────────────

export async function createRazorpaySubscription({
  team,
  planId,
}: {
  team: Team;
  planId: string;
}) {
  if (!planId) throw new Error('Plan ID is required');

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: {
      teamId: String(team.id),
      teamName: team.name,
    },
  });

  await db
    .update(teams)
    .set({
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: planId,
      subscriptionStatus: 'created',
    })
    .where(eq(teams.id, team.id));

  return subscription;
}

export async function createBillingPortalUrl(team: Team): Promise<string> {
  // Razorpay has no hosted billing portal — link to hPanel or a self-service page
  return `/dashboard/settings/billing`;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function handleSubscriptionWebhook(
  event: string,
  payload: Record<string, unknown>
) {
  const sub = (payload as { subscription?: { entity?: Record<string, unknown> } })
    ?.subscription?.entity as Record<string, unknown> | undefined;
  if (!sub) return;

  const teamIdStr = (sub.notes as Record<string, string> | undefined)?.teamId;
  if (!teamIdStr) return;

  const teamId = parseInt(teamIdStr, 10);
  if (isNaN(teamId)) return;

  const statusMap: Record<string, string> = {
    'subscription.activated': 'active',
    'subscription.charged': 'active',
    'subscription.completed': 'completed',
    'subscription.cancelled': 'cancelled',
    'subscription.paused': 'paused',
    'subscription.resumed': 'active',
  };

  const newStatus = statusMap[event];
  if (!newStatus) return;

  const planMap: Record<string, string> = {
    [process.env.RAZORPAY_PRO_PLAN_ID || '']: 'Pro',
    [process.env.RAZORPAY_AGENCY_PLAN_ID || '']: 'Agency',
  };

  await db
    .update(teams)
    .set({
      subscriptionStatus: newStatus,
      razorpaySubscriptionId: sub.id as string,
      razorpayPlanId: sub.plan_id as string,
      planName: planMap[sub.plan_id as string] || null,
    })
    .where(eq(teams.id, teamId));
}
