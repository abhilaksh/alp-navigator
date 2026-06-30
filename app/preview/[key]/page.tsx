import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTripWithDetailsByPreviewKey } from '@/lib/db/queries';
import { getUser } from '@/lib/db/queries';
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
    description: `A personalised travel proposal from Alp Travel Co.`,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({ params }: Props) {
  const { key } = await params;
  const [trip, advisor] = await Promise.all([
    getTripWithDetailsByPreviewKey(key),
    getUser(),
  ]);

  if (!trip) return notFound();

  if (trip === 'expired') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6" style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}>
        <div className="text-center max-w-sm">
          <div className="font-display italic text-3xl text-spruce mb-8 tracking-tight">alp</div>
          <p className="font-display text-2xl text-ink mb-3">This quote has expired.</p>
          <p className="text-ink-mute text-sm leading-relaxed">
            Quotes are valid for 30 days. Contact your advisor for a refreshed version.
          </p>
          <a
            href="https://wa.me/919870400235"
            target="_blank" rel="noopener noreferrer"
            className="inline-block mt-8 px-6 py-2.5 bg-spruce text-white text-sm rounded-sm hover:opacity-90 transition-opacity"
            style={{ fontFamily: 'Schibsted Grotesk, sans-serif' }}
          >
            Message on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const destinations = trip.destinations ?? [];
  const totalNights = destinations.reduce((sum, d) => sum + (d.nights ?? 0), 0);

  let totalFromInr = 0;
  let hasPricing = false;
  for (const dest of destinations) {
    for (const item of dest.items ?? []) {
      if (item.type !== 'hotel') continue;
      const rates = item.hotelDetails?.rates ?? [];
      if (!rates.length) continue;
      const cheapest = rates.reduce((min, r) => {
        const parsed = r.parsedData ? (JSON.parse(r.parsedData) as { total_inr?: number }) : null;
        const amt = parsed?.total_inr ?? 0;
        return amt > 0 && amt < min ? amt : min;
      }, Infinity);
      if (cheapest < Infinity) { totalFromInr += cheapest; hasPricing = true; }
    }
  }

  const validUntil = trip.previewExpiresAt
    ? new Date(trip.previewExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const isAdvisor = !!advisor;

  return (
    <div className="min-h-screen" style={{ background: '#F6F4EE', fontFamily: 'Schibsted Grotesk, sans-serif' }}>

      {/* ── Advisor bar (only when logged in) ──────────────────────────────── */}
      {isAdvisor && (
        <div
          className="flex items-center justify-between px-5 py-2 text-[11px]"
          style={{ background: 'rgba(30,58,47,0.08)', borderBottom: '1px solid rgba(30,58,47,0.12)' }}
        >
          <span style={{ color: '#4A514B' }}>
            Previewing as client — this is exactly what your client sees.
          </span>
          <Link
            href={`/trips/${trip.id}`}
            className="font-medium"
            style={{ color: '#1E3A2F' }}
          >
            ← Back to editor
          </Link>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(22,26,23,0.08)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display italic text-spruce text-xl tracking-tight" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#1E3A2F' }}>alp</span>
          <a
            href="https://wa.me/919870400235"
            target="_blank" rel="noopener noreferrer"
            className="text-[12px] transition-colors"
            style={{ color: '#4A514B' }}
            onMouseOver={undefined}
          >
            Questions? WhatsApp →
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ background: '#1E3A2F' }}>
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <p
            className="text-[10px] uppercase tracking-[0.18em] mb-4"
            style={{ color: 'rgba(169,139,82,0.85)', fontFamily: 'Schibsted Grotesk, sans-serif' }}
          >
            Your travel proposal
          </p>
          <h1
            className="text-4xl md:text-5xl leading-[1.08] tracking-tight mb-6"
            style={{ color: '#F6F4EE', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
          >
            {trip.label}
          </h1>

          <div
            className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]"
            style={{ color: 'rgba(246,244,238,0.55)' }}
          >
            <span>
              {trip.adults} {trip.adults === 1 ? 'adult' : 'adults'}
              {trip.children > 0 ? ` · ${trip.children} ${trip.children === 1 ? 'child' : 'children'}` : ''}
            </span>
            {destinations.length > 0 && (
              <span>{destinations.map(d => d.name).join(' → ')}</span>
            )}
            {totalNights > 0 && <span>{totalNights} nights</span>}
          </div>

          {hasPricing && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: 'rgba(169,139,82,0.65)' }}>
                Accommodation from
              </p>
              <p className="font-mono text-2xl" style={{ color: '#A98B52', fontFamily: 'Spline Sans Mono, monospace' }}>
                ₹{totalFromInr.toLocaleString('en-IN')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 py-14 space-y-16">
        {destinations.map((dest, di) => {
          const hotels = (dest.items ?? []).filter(i => i.type === 'hotel');
          return (
            <section key={dest.id}>
              {/* Destination header */}
              <div className="flex items-start gap-5 mb-10">
                <span
                  className="font-mono text-[10px] pt-[5px] flex-shrink-0"
                  style={{ color: '#C9D2CC', fontFamily: 'Spline Sans Mono, monospace' }}
                >
                  {String(di + 1).padStart(2, '0')}
                </span>
                <div className="flex-1" style={{ borderTop: '1px solid rgba(22,26,23,0.1)', paddingTop: 14 }}>
                  <h2
                    className="text-2xl tracking-tight mb-1"
                    style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                  >
                    {dest.name}
                  </h2>
                  {(dest.checkin || dest.checkout) && (
                    <p className="text-[12px]" style={{ color: '#8A9189' }}>
                      {dest.checkin && fmtDate(dest.checkin)}
                      {dest.checkin && dest.checkout && ' — '}
                      {dest.checkout && fmtDate(dest.checkout)}
                      {dest.nights ? ` · ${dest.nights} nights` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Hotels */}
              {hotels.length > 0 ? (
                <div className="ml-[36px] space-y-10">
                  {hotels.map((item, hi) => {
                    const hotel = item.hotelDetails;
                    const confirmedRate = hotel?.rates.find(r => r.isConfirmed);
                    const displayRate = confirmedRate ?? hotel?.rates.find(r => r.status === 'done') ?? hotel?.rates[0];
                    const parsed = displayRate?.parsedData
                      ? (JSON.parse(displayRate.parsedData) as ParsedRate)
                      : null;

                    return (
                      <div key={item.id}>
                        {/* Hotel name row */}
                        <div className="flex items-baseline justify-between gap-4 mb-3">
                          <div className="flex items-baseline gap-3 min-w-0">
                            <span
                              className="font-mono text-[10px] flex-shrink-0"
                              style={{ color: '#C9D2CC', fontFamily: 'Spline Sans Mono, monospace' }}
                            >
                              {String.fromCharCode(65 + hi)}
                            </span>
                            <h3
                              className="text-xl leading-tight"
                              style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                            >
                              {item.title}
                            </h3>
                            {hotel?.stars && (
                              <span className="text-[11px] flex-shrink-0" style={{ color: '#A98B52', letterSpacing: '-0.5px' }}>
                                {'★'.repeat(Math.min(hotel.stars, 5))}
                              </span>
                            )}
                          </div>
                          {parsed?.total_inr && (
                            <div className="text-right flex-shrink-0">
                              <p
                                className="font-mono text-lg leading-none"
                                style={{ color: '#A98B52', fontFamily: 'Spline Sans Mono, monospace' }}
                              >
                                ₹{parsed.total_inr.toLocaleString('en-IN')}
                              </p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#8A9189' }}>total stay</p>
                            </div>
                          )}
                        </div>

                        {/* Recommendation (editorial note) */}
                        {hotel?.recommendation && (
                          <p
                            className="text-[13px] leading-[1.65] mb-4 pl-4"
                            style={{
                              color: '#4A514B',
                              borderLeft: '2px solid #A98B52',
                              fontStyle: 'italic',
                            }}
                          >
                            {hotel.recommendation}
                          </p>
                        )}

                        {/* Rate details */}
                        {parsed && (
                          <div className="space-y-3">
                            {/* Room + dates row */}
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]" style={{ color: '#4A514B' }}>
                              {parsed.room_type && (
                                <span className="font-medium" style={{ color: '#161A17' }}>{parsed.room_type}</span>
                              )}
                              {(parsed.checkin || parsed.checkout) && (
                                <span style={{ fontFamily: 'Spline Sans Mono, monospace', fontSize: 11 }}>
                                  {parsed.checkin && fmtDate(parsed.checkin)}
                                  {parsed.checkin && parsed.checkout && ' — '}
                                  {parsed.checkout && fmtDate(parsed.checkout)}
                                  {parsed.nights ? ` · ${parsed.nights} nights` : ''}
                                </span>
                              )}
                            </div>

                            {/* Inclusions row */}
                            <div className="flex flex-wrap gap-[6px]">
                              {parsed.board_basis && (
                                <span
                                  className="text-[10px] px-2.5 py-[3px] rounded-[3px]"
                                  style={{ background: 'rgba(30,58,47,0.07)', color: '#1E3A2F' }}
                                >
                                  {parsed.board_basis}
                                </span>
                              )}
                              {parsed.breakfast_included && !parsed.board_basis && (
                                <span
                                  className="text-[10px] px-2.5 py-[3px] rounded-[3px]"
                                  style={{ background: 'rgba(30,58,47,0.07)', color: '#1E3A2F' }}
                                >
                                  Breakfast included
                                </span>
                              )}
                              {parsed.cancellation_free && (
                                <span
                                  className="text-[10px] px-2.5 py-[3px] rounded-[3px]"
                                  style={{ background: 'rgba(34,134,58,0.08)', color: '#22863a' }}
                                >
                                  Free cancellation{parsed.cancellation_deadline ? ` until ${fmtDate(parsed.cancellation_deadline)}` : ''}
                                </span>
                              )}
                              {parsed.cancellation_free === false && (
                                <span
                                  className="text-[10px] px-2.5 py-[3px] rounded-[3px]"
                                  style={{ background: 'rgba(220,38,38,0.07)', color: '#dc2626' }}
                                >
                                  Non-refundable
                                </span>
                              )}
                            </div>

                            {/* Perks */}
                            {(parsed.perks?.length || parsed.inclusions?.length) && (
                              <div>
                                <p
                                  className="text-[9px] uppercase tracking-[0.1em] mb-2"
                                  style={{ color: '#8A9189' }}
                                >
                                  Included perks
                                </p>
                                <ul className="space-y-1">
                                  {[...(parsed.perks ?? []), ...(parsed.inclusions ?? [])].map((p, pi) => (
                                    <li key={pi} className="flex items-start gap-2 text-[12px]" style={{ color: '#4A514B' }}>
                                      <span className="mt-[2px] flex-shrink-0" style={{ color: '#A98B52' }}>·</span>
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Advisor-only: price breakdown + rate source */}
                            {isAdvisor && (
                              <div
                                className="rounded-[3px] px-3 py-2.5 text-[11px] space-y-1"
                                style={{ background: 'rgba(30,58,47,0.06)', border: '1px dashed rgba(30,58,47,0.15)' }}
                              >
                                <p className="font-mono text-[9px] uppercase tracking-[0.08em] mb-1.5" style={{ color: '#4A514B' }}>
                                  Advisor view only
                                </p>
                                {displayRate?.source && (
                                  <div className="flex justify-between" style={{ color: '#4A514B' }}>
                                    <span>Source</span>
                                    <span className="font-mono capitalize">{displayRate.source}</span>
                                  </div>
                                )}
                                {parsed.subtotal_inr && (
                                  <div className="flex justify-between" style={{ color: '#4A514B' }}>
                                    <span>Room cost</span>
                                    <span className="font-mono">₹{parsed.subtotal_inr.toLocaleString('en-IN')}</span>
                                  </div>
                                )}
                                {parsed.taxes_inr && (
                                  <div className="flex justify-between" style={{ color: '#4A514B' }}>
                                    <span>Taxes & fees</span>
                                    <span className="font-mono">₹{parsed.taxes_inr.toLocaleString('en-IN')}</span>
                                  </div>
                                )}
                                {parsed.google_rate_inr && parsed.total_inr && parsed.google_rate_inr < parsed.total_inr * 0.92 && (
                                  <div className="flex justify-between" style={{ color: '#dc2626' }}>
                                    <span>Google rate</span>
                                    <span className="font-mono">₹{parsed.google_rate_inr.toLocaleString('en-IN')} ⚠</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {!parsed && !hotel?.recommendation && (
                          <p className="text-[12px] italic" style={{ color: '#8A9189' }}>
                            Hotel details to follow.
                          </p>
                        )}

                        {/* Divider between hotels */}
                        {hi < hotels.length - 1 && (
                          <div className="mt-8" style={{ borderBottom: '1px solid rgba(22,26,23,0.07)' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="ml-[36px] text-[13px] italic" style={{ color: '#8A9189' }}>
                  Hotels to be confirmed.
                </p>
              )}
            </section>
          );
        })}

        {/* Trip notes (to client) */}
        {trip.notes && (
          <section style={{ borderTop: '1px solid rgba(22,26,23,0.09)', paddingTop: 32 }}>
            <p
              className="text-[10px] uppercase tracking-[0.12em] mb-4"
              style={{ color: '#8A9189' }}
            >
              Notes from your advisor
            </p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#4A514B' }}>
              {trip.notes}
            </p>
          </section>
        )}

        {/* CTA */}
        <section
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
          style={{ borderTop: '1px solid rgba(22,26,23,0.09)', paddingTop: 32 }}
        >
          <div>
            <p
              className="text-xl mb-1"
              style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
            >
              Ready to move forward?
            </p>
            <p className="text-[12px]" style={{ color: '#8A9189' }}>
              Message your advisor to confirm. They&apos;ll handle the bookings.
            </p>
            {validUntil && (
              <p className="text-[11px] mt-1" style={{ color: '#8A9189' }}>
                Quote valid until {validUntil}
              </p>
            )}
          </div>
          <a
            href={`https://wa.me/919870400235?text=${encodeURIComponent(`Hi, I'd like to confirm the itinerary for ${trip.label}.`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white rounded-sm transition-opacity hover:opacity-90"
            style={{ background: '#1E3A2F' }}
          >
            Confirm on WhatsApp
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="py-8 text-center text-[11px]"
        style={{ borderTop: '1px solid rgba(22,26,23,0.07)', color: '#8A9189' }}
      >
        Prepared by <span style={{ color: '#4A514B' }}>Alp Travel Co.</span>
        {' '}· Fora Pro Advisor · IATA #33520476
        {' '}· Affiliated with Virtuoso
      </footer>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedRate {
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
  google_rate_inr?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}
