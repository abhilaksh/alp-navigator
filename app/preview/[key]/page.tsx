import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTripWithDetailsByPreviewKey, getAdvisorProfileByTeamId } from '@/lib/db/queries';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { calcPerkValue, formatPerkValue } from '@/lib/perk-value';
import { trips } from '@/lib/db/schema';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import type { Metadata } from 'next';
import { AcceptanceBlock } from '@/components/preview/acceptance-block';

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

  // Load advisor profile for this trip's team
  const advisorProfile = (trip !== 'expired' && (trip as { teamId?: number }).teamId)
    ? await getAdvisorProfileByTeamId((trip as { teamId: number }).teamId)
    : null;

  const waNumber = advisorProfile?.whatsappNumber?.replace(/\D/g, '') ?? '919870400235';
  const waBase = `https://wa.me/${waNumber}`;

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
            href={waBase}
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

  // ── Track this view (fire-and-forget; never block render) ────────────────
  // Only track when NOT viewed as the advisor (to avoid advisor visits inflating count)
  if (!advisor) {
    const now = Date.now();
    db.update(trips)
      .set({
        firstViewedAt: drizzleSql`COALESCE(first_viewed_at, ${now})`,
        viewCount: drizzleSql`view_count + 1`,
      })
      .where(eq(trips.id, trip.id))
      .catch(() => {});
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const destinations = trip.destinations ?? [];
  const itineraryDays = (trip as { itineraryDays?: ItineraryDayPreview[] }).itineraryDays ?? [];
  const hasItinerary = itineraryDays.some(d => d.title || d.summary || (d.blocks && d.blocks.length > 0));
  const totalNights = destinations.reduce((sum, d) => sum + (d.nights ?? 0), 0);

  let totalFromInr = 0;
  let hasPricing = false;
  let hasEstimated = false;
  for (const dest of destinations) {
    for (const item of dest.items ?? []) {
      if (item.type === 'hotel') {
        const itemRates = item.hotelDetails?.rates ?? [];
        if (!itemRates.length) continue;
        const cheapest = itemRates.reduce((min, r) => {
          const parsed = r.parsedData ? (JSON.parse(r.parsedData) as { total_inr?: number }) : null;
          const amt = parsed?.total_inr ?? 0;
          return amt > 0 && amt < min ? amt : min;
        }, Infinity);
        if (cheapest < Infinity) { totalFromInr += cheapest; hasPricing = true; }
      } else if (item.confirmedTotalInr && item.confirmedTotalInr > 0) {
        totalFromInr += item.confirmedTotalInr;
        hasPricing = true;
        const dj = item.detailsJson ? (typeof item.detailsJson === 'string' ? JSON.parse(item.detailsJson as string) : item.detailsJson) as { isEstimated?: boolean } : null;
        if (dj?.isEstimated) hasEstimated = true;
      }
    }
  }

  const isAdvisor = !!advisor;

  return (
    <div className="min-h-screen" style={{ background: '#F6F4EE', fontFamily: 'Schibsted Grotesk, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-section { page-break-inside: avoid; }
          body { background: #F6F4EE !important; }
          header, footer { display: none !important; }
          main { padding-top: 0 !important; }
          a[href]::after { content: none !important; }
        }
      `}</style>

      {/* ── Advisor bar (only when logged in) ──────────────────────────────── */}
      {isAdvisor && (
        <div
          className="no-print flex items-center justify-between px-5 py-2 text-[11px]"
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
      <header className="no-print" style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(22,26,23,0.08)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display italic text-spruce text-xl tracking-tight" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#1E3A2F' }}>alp</span>
          <a
            href={waBase}
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
      <div
        style={{
          background: '#1E3A2F',
          ...((trip as { heroImage?: string | null }).heroImage
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(30,58,47,0.82) 0%, rgba(30,58,47,0.72) 100%), url(${(trip as { heroImage?: string | null }).heroImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        }}
      >
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
                {hasEstimated ? 'Total from (estimated)' : 'Total from'}
              </p>
              <p className="font-mono text-2xl" style={{ color: '#A98B52', fontFamily: 'Spline Sans Mono, monospace' }}>
                {hasEstimated ? '~' : ''}₹{totalFromInr.toLocaleString('en-IN')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 py-14 space-y-16">

        {/* Personal note + journey overview */}
        {((trip as { personalNote?: string | null }).personalNote || (trip as { journeyOverview?: string | null }).journeyOverview) && (
          <section style={{ borderBottom: '1px solid rgba(22,26,23,0.08)', paddingBottom: 40, marginBottom: 0 }}>
            {(trip as { personalNote?: string | null }).personalNote && (
              <div className="mb-8">
                <p
                  className="text-[13px] leading-[1.75] italic"
                  style={{ color: '#4A514B', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                >
                  {(trip as { personalNote?: string | null }).personalNote}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: '#A98B52' }}>
                  — Abhilaksh, Alp Travel Co.
                </p>
              </div>
            )}
            {(trip as { journeyOverview?: string | null }).journeyOverview && (
              <div>
                <p
                  className="text-[11px] uppercase tracking-[0.14em] mb-3"
                  style={{ color: '#A98B52' }}
                >
                  The journey
                </p>
                <p
                  className="text-[14px] leading-[1.75]"
                  style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                >
                  {(trip as { journeyOverview?: string | null }).journeyOverview}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Day-by-day itinerary ─────────────────────────────────────── */}
        {hasItinerary && (
          <section className="print-section">
            <div className="flex items-start gap-5 mb-10">
              <div className="flex-1" style={{ borderTop: '1px solid rgba(22,26,23,0.1)', paddingTop: 14 }}>
                <p className="text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: '#A98B52' }}>
                  Day by day
                </p>
              </div>
            </div>
            <div className="space-y-8">
              {itineraryDays.map(day => (
                <div key={day.id} className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-[36px] text-right">
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: '#C9D2CC', fontFamily: 'Spline Sans Mono, monospace' }}
                    >
                      {String(day.dayNumber).padStart(2, '0')}
                    </span>
                    {day.date && (
                      <p className="font-mono text-[9px] mt-[2px]" style={{ color: '#C9D2CC' }}>
                        {fmtDateShort(day.date)}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 pb-8" style={{ borderBottom: '1px solid rgba(22,26,23,0.07)' }}>
                    {day.title && (
                      <h4
                        className="text-[18px] leading-snug mb-2"
                        style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                      >
                        {day.title}
                      </h4>
                    )}
                    {day.summary && (
                      <p
                        className="text-[13px] leading-[1.7] mb-4"
                        style={{ color: '#4A514B' }}
                      >
                        {day.summary}
                      </p>
                    )}
                    {day.blocks && day.blocks.length > 0 && (
                      <div className="space-y-2">
                        {day.blocks.map(block => (
                          <ItineraryBlockItem key={block.id} block={block} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {destinations.map((dest, di) => {
          const hotels = (dest.items ?? []).filter(i => i.type === 'hotel');
          const destHeroImage = (dest as { heroImage?: string | null }).heroImage ?? null;
          return (
            <section key={dest.id}>
              {/* Destination hero image */}
              {destHeroImage && (
                <div
                  className="w-full h-[220px] md:h-[280px] rounded-[4px] overflow-hidden mb-8"
                  style={{ border: '1px solid rgba(22,26,23,0.06)' }}
                >
                  <img
                    src={destHeroImage}
                    alt={dest.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

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
                  {(dest as { narrative?: string | null }).narrative && (
                    <p
                      className="mt-3 text-[13px] italic leading-relaxed"
                      style={{
                        color: '#4A514B',
                        fontFamily: 'Fraunces, Georgia, serif',
                        fontWeight: 300,
                        borderLeft: '2px solid rgba(169,139,82,0.4)',
                        paddingLeft: 12,
                      }}
                    >
                      {(dest as { narrative?: string | null }).narrative}
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
                                {/* Perk value estimate */}
                                {(() => {
                                  const allPerks = [...(parsed.perks ?? []), ...(parsed.inclusions ?? [])];
                                  const { totalInr } = calcPerkValue(allPerks, parsed.nights ?? 1);
                                  if (totalInr <= 0) return null;
                                  return (
                                    <div
                                      className="flex items-center justify-between mt-3 px-3 py-2 rounded-[3px]"
                                      style={{ background: 'rgba(169,139,82,0.07)', border: '1px solid rgba(169,139,82,0.2)' }}
                                    >
                                      <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: '#8A9189' }}>
                                        Est. partner perk value
                                      </span>
                                      <span className="font-mono text-[12px] font-medium" style={{ color: '#A98B52' }}>
                                        {formatPerkValue(totalInr)}
                                      </span>
                                    </div>
                                  );
                                })()}
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

              {/* Non-hotel line items: flights, transfers, activities */}
              {(() => {
                const lineItems = (dest.items ?? []).filter(i => i.type !== 'hotel' && i.confirmedTotalInr);
                if (!lineItems.length) return null;
                return (
                  <div className="ml-[36px] mt-8 space-y-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: '#8A9189' }}>
                      Additional inclusions
                    </p>
                    {lineItems.map(item => {
                      const dj = item.detailsJson
                        ? (typeof item.detailsJson === 'string' ? JSON.parse(item.detailsJson as string) : item.detailsJson) as LineItemDetails
                        : null;
                      const isEst = dj?.isEstimated ?? false;
                      const icon = item.type === 'flight' ? '✈' : item.type === 'transfer' ? '→' : '◇';
                      const summary = buildLineItemSummary(item.type, dj);
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-4 py-2.5 px-3 rounded-[3px]"
                          style={{ background: 'rgba(22,26,23,0.04)', border: '1px solid rgba(22,26,23,0.07)' }}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-[12px] flex-shrink-0 mt-[1px]" style={{ color: '#8A9189' }}>{icon}</span>
                            <div className="min-w-0">
                              <p className="text-[13px] text-ink leading-snug truncate">{item.title}</p>
                              {summary && <p className="text-[11px] mt-[2px]" style={{ color: '#8A9189' }}>{summary}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-[13px]" style={{ color: '#A98B52' }}>
                              {isEst ? '~' : ''}₹{item.confirmedTotalInr!.toLocaleString('en-IN')}
                            </p>
                            {isEst && (
                              <p className="text-[9px] mt-[1px]" style={{ color: '#8A9189' }}>estimated</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
        <AcceptanceBlock
          previewKey={trip.previewKey!}
          waLink={waBase}
          tripLabel={trip.label}
          alreadyAccepted={!!(trip as { clientAcceptedAt?: number | null }).clientAcceptedAt}
          expiresAt={(trip as { previewExpiresAt?: number | null }).previewExpiresAt ?? null}
        />
      </main>

      {/* Footer */}
      <footer
        className="no-print py-8 text-center text-[11px]"
        style={{ borderTop: '1px solid rgba(22,26,23,0.07)', color: '#8A9189' }}
      >
        {advisorProfile?.quoteFooter ? (
          advisorProfile.quoteFooter
        ) : (
          <>
            Prepared by <span style={{ color: '#4A514B' }}>{advisorProfile?.agencyName ?? 'Alp Travel Co.'}</span>
            {advisorProfile?.iataNumber ? <>{' '}· IATA #{advisorProfile.iataNumber}</> : <>{' '}· IATA #33520476</>}
            {advisorProfile?.virtuosoMembership ? <>{' '}· Virtuoso</> : <>{' '}· Affiliated with Virtuoso</>}
          </>
        )}
      </footer>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItemDetails {
  isEstimated?: boolean;
  // flight
  airline?: string; from?: string; to?: string; cabinClass?: string;
  departureDateTime?: string; flightNumber?: string; passengers?: number | string;
  // transfer
  pickupLocation?: string; dropoffLocation?: string; vehicleType?: string; dateTime?: string;
  // activity
  activityName?: string; operator?: string;
}

function buildLineItemSummary(type: string, dj: LineItemDetails | null): string {
  if (!dj) return '';
  if (type === 'flight') {
    const parts: string[] = [];
    if (dj.from && dj.to) parts.push(`${dj.from} → ${dj.to}`);
    if (dj.cabinClass) parts.push(dj.cabinClass.charAt(0).toUpperCase() + dj.cabinClass.slice(1));
    if (dj.departureDateTime) parts.push(fmtDateShort(dj.departureDateTime.split('T')[0]));
    return parts.join(' · ');
  }
  if (type === 'transfer') {
    const parts: string[] = [];
    if (dj.pickupLocation || dj.dropoffLocation) parts.push(`${dj.pickupLocation ?? '?'} → ${dj.dropoffLocation ?? '?'}`);
    if (dj.vehicleType) parts.push(dj.vehicleType);
    return parts.join(' · ');
  }
  if (type === 'activity' || type === 'experience') {
    const parts: string[] = [];
    if (dj.operator) parts.push(dj.operator);
    return parts.join(' · ');
  }
  return '';
}

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

interface ItineraryBlockPreview {
  id: number;
  type: string;
  content: string | null;
  sortOrder: number;
}

interface ItineraryDayPreview {
  id: number;
  dayNumber: number;
  date: string | null;
  title: string | null;
  summary: string | null;
  sortOrder: number;
  blocks: ItineraryBlockPreview[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

function fmtDateShort(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
    });
  } catch { return dateStr; }
}

function ItineraryBlockItem({ block }: { block: ItineraryBlockPreview }) {
  const BLOCK_STYLES: Record<string, { prefix: string; color: string; bg?: string }> = {
    tip:            { prefix: 'Tip',      color: '#A98B52', bg: 'rgba(169,139,82,0.06)' },
    meal:           { prefix: 'Meal',     color: '#2E6B45' },
    transport_note: { prefix: 'Transfer', color: '#4A514B' },
    hotel_ref:      { prefix: 'Hotel',    color: '#1E3A2F', bg: 'rgba(30,58,47,0.05)' },
    map_pin:        { prefix: '📍',       color: '#4A514B' },
    text:           { prefix: '',         color: '#4A514B' },
  };

  const style = BLOCK_STYLES[block.type] ?? BLOCK_STYLES.text;
  if (!block.content) return null;

  return (
    <div
      className="flex items-start gap-2.5 text-[12px] rounded-[3px] px-3 py-2"
      style={{ background: style.bg ?? 'transparent', color: style.color }}
    >
      {style.prefix && (
        <span
          className="font-mono text-[9px] uppercase tracking-[0.08em] pt-[3px] flex-shrink-0"
          style={{ color: style.color, opacity: 0.65 }}
        >
          {style.prefix}
        </span>
      )}
      <span className="leading-relaxed">{block.content}</span>
    </div>
  );
}
