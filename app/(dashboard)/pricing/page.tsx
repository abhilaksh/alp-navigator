import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { PLANS } from '@/lib/payments/razorpay';
import { SubmitButton } from './submit-button';

export const revalidate = 3600;

export default async function PricingPage() {
  const proplan = PLANS.find((p: typeof PLANS[number]) => p.name === 'Pro');
  const agencyPlan = PLANS.find((p: typeof PLANS[number]) => p.name === 'Agency');

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl text-ink mb-3">Plans</h1>
        <p className="text-ink-mute text-sm">Built for Fora Pro advisors in India.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <PricingCard
          name="Free"
          priceInr={0}
          interval="forever"
          features={['3 active trips', '1 advisor seat', 'AI rate parsing (10/mo)', 'WhatsApp export']}
          planId={null}
        />
        <PricingCard
          name={proplan?.name || 'Pro'}
          priceInr={proplan?.amountInr || 1999}
          interval="month"
          featured
          features={[
            'Unlimited trips',
            '1 advisor seat',
            'AI rate parsing (unlimited)',
            'Client portal links',
            'Fora perks display',
          ]}
          planId={process.env.RAZORPAY_PRO_PLAN_ID}
        />
        <PricingCard
          name={agencyPlan?.name || 'Agency'}
          priceInr={agencyPlan?.amountInr || 4999}
          interval="month"
          features={[
            'Everything in Pro',
            'Up to 5 advisor seats',
            'Team activity log',
            'Priority support',
          ]}
          planId={process.env.RAZORPAY_AGENCY_PLAN_ID}
        />
      </div>
    </main>
  );
}

function PricingCard({
  name,
  priceInr,
  interval,
  features,
  planId,
  featured = false,
}: {
  name: string;
  priceInr: number;
  interval: string;
  features: string[];
  planId?: string | null | undefined;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 ${
        featured
          ? 'border-brass bg-spruce text-white'
          : 'border-glacier bg-white text-ink'
      }`}
    >
      <h2 className={`font-display text-xl mb-1 ${featured ? 'text-white' : 'text-ink'}`}>
        {name}
      </h2>
      <p className={`text-3xl font-mono font-medium mb-1 ${featured ? 'text-brass' : 'text-ink'}`}>
        {priceInr === 0 ? 'Free' : `₹${priceInr.toLocaleString('en-IN')}`}
      </p>
      {priceInr > 0 && (
        <p className={`text-xs mb-6 ${featured ? 'text-white/60' : 'text-ink-mute'}`}>
          per {interval}
        </p>
      )}
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check
              className={`h-4 w-4 mt-0.5 shrink-0 ${featured ? 'text-brass' : 'text-success'}`}
            />
            <span className={`text-sm ${featured ? 'text-white/90' : 'text-ink-soft'}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      {planId ? (
        <form action={checkoutAction}>
          <input type="hidden" name="planId" value={planId} />
          <SubmitButton />
        </form>
      ) : priceInr === 0 ? (
        <p className={`text-xs text-center ${featured ? 'text-white/50' : 'text-ink-mute'}`}>
          Current plan
        </p>
      ) : null}
    </div>
  );
}
