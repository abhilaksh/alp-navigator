import { notFound } from 'next/navigation';
import { getTripWithDetailsByPreviewKey } from '@/lib/db/queries';
import type { Metadata } from 'next';

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const trip = await getTripWithDetailsByPreviewKey(key);
  if (!trip || trip === 'expired') {
    return { title: 'Quote not found — Alp Travel Co.' };
  }
  return {
    title: `${trip.label} — Alp Travel Co.`,
    description: `Personalised travel proposal from Alp Travel Co.`,
  };
}

export default async function PreviewPage({ params }: Props) {
  const { key } = await params;
  const trip = await getTripWithDetailsByPreviewKey(key);

  if (!trip) return notFound();

  if (trip === 'expired') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl text-ink mb-3">Quote expired</p>
          <p className="text-ink-mute text-sm">
            This quote link has expired. Contact your advisor for an updated version.
          </p>
          <a
            href={`https://wa.me/919870400235`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-5 py-2.5 bg-spruce text-white text-sm rounded hover:bg-spruce-light transition-colors"
          >
            Message on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // Compute totals
  const destinations = trip.destinations ?? [];
  const totalNights = destinations.reduce((sum, d) => sum + (d.nights ?? 0), 0);

  // Sum cheapest confirmed/parsed rate per hotel
  let totalFromInr = 0;
  let hasPricing = false;
  for (const dest of destinations) {
    for (const item of dest.items ?? []) {
      if (item.type !== 'hotel') continue;
      const rates = item.hotelDetails?.rates ?? [];
      if (rates.length === 0) continue;
      const cheapest = rates.reduce((min, r) => {
        const parsed = r.parsedData ? (JSON.parse(r.parsedData) as { total_inr?: number }) : null;
        const amt = parsed?.total_inr ?? 0;
        return amt > 0 && amt < min ? amt : min;
      }, Infinity);
      if (cheapest < Infinity) {
        totalFromInr += cheapest;
        hasPricing = true;
      }
    }
  }

  const validUntil = trip.previewExpiresAt
    ? new Date(trip.previewExpiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="border-b border-glacier bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display italic text-spruce text-xl tracking-tight">alp</span>
          <a
            href={`https://wa.me/919870400235`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-soft hover:text-ink transition-colors"
          >
            Questions? WhatsApp us
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-spruce text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-brass text-xs font-sans uppercase tracking-widest mb-3">
            Your personalised proposal
          </p>
          <h1 className="font-display text-4xl md:text-5xl mb-4 leading-tight">
            {trip.label}
          </h1>
          <div className="flex flex-wrap gap-6 text-white/70 text-sm mt-6">
            <span>{trip.adults} {trip.adults === 1 ? 'adult' : 'adults'}{trip.children > 0 ? ` · ${trip.children} ${trip.children === 1 ? 'child' : 'children'}` : ''}</span>
            {destinations.length > 0 && (
              <span>{destinations.length} {destinations.length === 1 ? 'destination' : 'destinations'}</span>
            )}
            {totalNights > 0 && <span>{totalNights} nights</span>}
            {hasPricing && (
              <span className="text-brass font-mono">
                From ₹{totalFromInr.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Itinerary */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {destinations.map((dest, di) => {
          const hotels = (dest.items ?? []).filter((i) => i.type === 'hotel');
          return (
            <section key={dest.id}>
              {/* Destination header */}
              <div className="flex items-baseline gap-4 mb-6 pb-3 border-b border-glacier">
                <span className="font-mono text-xs text-ink-mute">{String(di + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="font-display text-2xl text-ink">{dest.name}</h2>
                  {(dest.checkin || dest.checkout) && (
                    <p className="text-sm text-ink-mute mt-0.5">
                      {dest.checkin && formatDate(dest.checkin)}
                      {dest.checkin && dest.checkout && ' — '}
                      {dest.checkout && formatDate(dest.checkout)}
                      {dest.nights ? ` · ${dest.nights} nights` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Hotels */}
              {hotels.length > 0 ? (
                <div className="space-y-6">
                  {hotels.map((item, hi) => {
                    const hotel = item.hotelDetails;
                    const confirmedRate = hotel?.rates.find((r) => r.isConfirmed);
                    const displayRate = confirmedRate ?? hotel?.rates[0];
                    const parsed = displayRate?.parsedData
                      ? (JSON.parse(displayRate.parsedData) as {
                          room_type?: string;
                          total_inr?: number;
                          subtotal_inr?: number;
                          taxes_inr?: number;
                          checkin?: string;
                          checkout?: string;
                          nights?: number;
                          board_basis?: string;
                          breakfast_included?: boolean;
                          cancellation_free?: boolean;
                          cancellation_deadline?: string;
                          perks?: string[];
                          inclusions?: string[];
                        })
                      : null;

                    return (
                      <div key={item.id} className="bg-white rounded-lg border border-glacier overflow-hidden">
                        {/* Hotel header */}
                        <div className="px-6 py-4 border-b border-glacier flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-ink-mute">
                                {String.fromCharCode(65 + hi)}
                              </span>
                              <h3 className="font-display text-lg text-ink">{item.title}</h3>
                              {hotel?.stars && (
                                <span className="text-xs text-brass">
                                  {'★'.repeat(hotel.stars)}
                                </span>
                              )}
                            </div>
                            {hotel?.rating && (
                              <span className="text-xs text-ink-mute">
                                {hotel.rating.toFixed(1)} / 5
                                {hotel.reviews ? ` · ${hotel.reviews.toLocaleString()} reviews` : ''}
                              </span>
                            )}
                          </div>
                          {parsed?.total_inr && (
                            <div className="text-right shrink-0">
                              <p className="font-mono text-lg text-ink font-medium">
                                ₹{parsed.total_inr.toLocaleString('en-IN')}
                              </p>
                              <p className="text-xs text-ink-mute">total</p>
                            </div>
                          )}
                        </div>

                        <div className="px-6 py-4 space-y-4">
                          {/* Our take */}
                          {hotel?.recommendation && (
                            <p className="text-sm text-ink-soft italic border-l-2 border-brass pl-3">
                              {hotel.recommendation}
                            </p>
                          )}

                          {/* Rate details */}
                          {parsed && (
                            <div className="space-y-3">
                              {parsed.room_type && (
                                <p className="text-sm font-medium text-ink">{parsed.room_type}</p>
                              )}

                              {/* Dates */}
                              {(parsed.checkin || parsed.checkout) && (
                                <div className="flex gap-6 text-sm text-ink-soft">
                                  {parsed.checkin && (
                                    <span>Check-in: <span className="text-ink">{formatDate(parsed.checkin)}</span></span>
                                  )}
                                  {parsed.checkout && (
                                    <span>Check-out: <span className="text-ink">{formatDate(parsed.checkout)}</span></span>
                                  )}
                                  {parsed.nights && (
                                    <span><span className="text-ink">{parsed.nights}</span> nights</span>
                                  )}
                                </div>
                              )}

                              {/* Board / inclusions */}
                              <div className="flex flex-wrap gap-2">
                                {parsed.board_basis && (
                                  <span className="text-xs bg-paper-deep text-ink-soft px-2 py-1 rounded">
                                    {parsed.board_basis}
                                  </span>
                                )}
                                {parsed.breakfast_included && (
                                  <span className="text-xs bg-paper-deep text-ink-soft px-2 py-1 rounded">
                                    Breakfast included
                                  </span>
                                )}
                              </div>

                              {/* Price breakdown */}
                              {(parsed.subtotal_inr || parsed.taxes_inr) && (
                                <div className="bg-paper-deep rounded p-3 space-y-1.5 text-sm">
                                  {parsed.subtotal_inr && (
                                    <div className="flex justify-between text-ink-soft">
                                      <span>Subtotal</span>
                                      <span className="font-mono">₹{parsed.subtotal_inr.toLocaleString('en-IN')}</span>
                                    </div>
                                  )}
                                  {parsed.taxes_inr && (
                                    <div className="flex justify-between text-ink-soft">
                                      <span>Taxes & fees</span>
                                      <span className="font-mono">₹{parsed.taxes_inr.toLocaleString('en-IN')}</span>
                                    </div>
                                  )}
                                  {parsed.total_inr && (
                                    <div className="flex justify-between font-medium text-ink pt-1 border-t border-glacier">
                                      <span>Total</span>
                                      <span className="font-mono">₹{parsed.total_inr.toLocaleString('en-IN')}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Cancellation */}
                              {parsed.cancellation_free !== undefined && (
                                <p className={`text-xs ${parsed.cancellation_free ? 'text-success' : 'text-danger'}`}>
                                  {parsed.cancellation_free
                                    ? `Free cancellation${parsed.cancellation_deadline ? ` until ${formatDate(parsed.cancellation_deadline)}` : ''}`
                                    : 'Non-refundable'}
                                </p>
                              )}

                              {/* Perks / inclusions */}
                              {(parsed.perks?.length || parsed.inclusions?.length) && (
                                <div>
                                  <p className="text-xs text-brass font-medium uppercase tracking-wide mb-1.5">
                                    Included perks
                                  </p>
                                  <ul className="space-y-1">
                                    {[...(parsed.perks ?? []), ...(parsed.inclusions ?? [])].map((perk, pi) => (
                                      <li key={pi} className="text-xs text-ink-soft flex items-start gap-1.5">
                                        <span className="text-brass mt-0.5">·</span>
                                        {perk}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {!parsed && !hotel?.recommendation && (
                            <p className="text-sm text-ink-mute italic">Details to follow.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-mute italic">Hotels to be confirmed.</p>
              )}
            </section>
          );
        })}

        {/* Notes */}
        {trip.notes && (
          <section className="border-t border-glacier pt-8">
            <h3 className="font-display text-lg text-ink mb-3">Notes from your advisor</h3>
            <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{trip.notes}</p>
          </section>
        )}

        {/* Footer CTA */}
        <section className="border-t border-glacier pt-8 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg text-ink">Ready to book?</p>
            <p className="text-sm text-ink-mute mt-1">
              Message your advisor on WhatsApp to confirm this itinerary.
            </p>
            {validUntil && (
              <p className="text-xs text-ink-mute mt-2">Quote valid until {validUntil}</p>
            )}
          </div>
          <a
            href={`https://wa.me/919870400235?text=${encodeURIComponent(`Hi, I'd like to proceed with the quote for ${trip.label}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-spruce hover:bg-spruce-light text-white text-sm rounded transition-colors"
          >
            Confirm on WhatsApp
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-glacier mt-8 py-6 text-center">
        <p className="text-xs text-ink-mute">
          Prepared by <span className="font-medium text-ink-soft">Alp Travel Co.</span> — Fora Pro Advisor · IATA #33520476
        </p>
      </footer>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
