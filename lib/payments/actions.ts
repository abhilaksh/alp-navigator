'use server';

import { redirect } from 'next/navigation';
import { createRazorpaySubscription, createBillingPortalUrl } from './razorpay';
import { withTeam } from '@/lib/auth/middleware';

export const checkoutAction = withTeam(async (formData, team) => {
  const planId = formData.get('planId') as string;
  await createRazorpaySubscription({ team, planId });
});

export const customerPortalAction = withTeam(async (_, team) => {
  const portalUrl = await createBillingPortalUrl(team);
  redirect(portalUrl);
});
