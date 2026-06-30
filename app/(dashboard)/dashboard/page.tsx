import Link from 'next/link';
import { getTripsWithDetailsForUser, getHoldExpiryByTrip, getCommissionSummaryForUser, getUser, getAnalyticsForUser } from '@/lib/db/queries';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function fmtDate(d: string) {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return d; }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', booked: 'Booked',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft:    { bg: 'rgba(22,26,23,0.06)',  text: '#4A514B' },
  sent:     { bg: 'rgba(169,139,82,0.12)', text: '#7a5e2e' },
  accepted: { bg: 'rgba(30,58,47,0.1)',   text: '#1E3A2F' },
  booked:   { bg: 'rgba(46,107,69,0.12)', text: '#2E6B45' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getUser();
  const [allTrips, holdMap, commission, analytics] = await Promise.all([
    getTripsWithDetailsForUser(false),
    user ? getHoldExpiryByTrip(user.id) : Promise.resolve(new Map<number, string>()),
    getCommissionSummaryForUser(),
    getAnalyticsForUser(),
  ]);

  const now = new Date();

  // ── Compute urgents ───────────────────────────────────────────────────────
  const holdExpiries = allTrips.flatMap(t => {
    const holdStr = holdMap.get(t.id);
    if (!holdStr) return [];
    const holdDate = new Date(holdStr);
    const daysLeft = daysBetween(now, holdDate);
    if (daysLeft > 7) return [];
    return [{ trip: t, holdDate, daysLeft }];
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  const noEngagement = allTrips.filter(t => {
    if (t.status !== 'sent') return false;
    if (t.firstViewedAt) return false; // client has viewed it
    const daysSinceUpdate = daysBetween(new Date(t.updatedAt), now);
    return daysSinceUpdate >= 5;
  }).sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  // ── Pipeline counts ───────────────────────────────────────────────────────
  const statusCounts = allTrips.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  // ── Recent trips ──────────────────────────────────────────────────────────
  const recentTrips = [...allTrips].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 6);

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 py-8 space-y-10">

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.14em] mb-1"
          style={{ color: '#A98B52', fontFamily: 'Schibsted Grotesk, sans-serif' }}
        >
          Navigator
        </p>
        <h1
          className="text-[28px] tracking-tight"
          style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
        >
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h1>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {(holdExpiries.length > 0 || noEngagement.length > 0) && (
        <section>
          <p
            className="font-mono text-[9px] uppercase tracking-[0.12em] mb-4"
            style={{ color: '#8A9189' }}
          >
            Needs attention
          </p>
          <div className="space-y-2">
            {holdExpiries.map(({ trip, holdDate, daysLeft }) => {
              const urgent = daysLeft <= 1;
              return (
                <Link
                  key={`hold-${trip.id}`}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-[4px] hover:opacity-90 transition-opacity"
                  style={{
                    background: urgent ? 'rgba(220,38,38,0.07)' : 'rgba(169,139,82,0.08)',
                    border: `1px solid ${urgent ? 'rgba(220,38,38,0.2)' : 'rgba(169,139,82,0.2)'}`,
                  }}
                >
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: urgent ? '#dc2626' : '#7a5e2e' }}>
                      {trip.label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#8A9189' }}>
                      {trip.clientName && `${trip.clientName} · `}
                      Hold expires {holdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span
                    className="font-mono text-[11px] px-2 py-0.5 rounded-[3px]"
                    style={{
                      background: urgent ? 'rgba(220,38,38,0.12)' : 'rgba(169,139,82,0.12)',
                      color: urgent ? '#dc2626' : '#A98B52',
                    }}
                  >
                    {daysLeft <= 0 ? 'Expired' : daysLeft === 1 ? 'Today' : `${daysLeft}d`}
                  </span>
                </Link>
              );
            })}

            {noEngagement.map(t => (
              <Link
                key={`noeng-${t.id}`}
                href={`/trips/${t.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-[4px] hover:opacity-90 transition-opacity"
                style={{
                  background: 'rgba(30,58,47,0.05)',
                  border: '1px solid rgba(30,58,47,0.12)',
                }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: '#1E3A2F' }}>
                    {t.label}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8A9189' }}>
                    {t.clientName && `${t.clientName} · `}
                    Sent {daysBetween(new Date(t.updatedAt), now)}d ago — no views yet
                  </p>
                </div>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-[3px]"
                  style={{ background: 'rgba(30,58,47,0.08)', color: '#1E3A2F' }}
                >
                  Follow up
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Pipeline strip ─────────────────────────────────────────────── */}
      <section>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-4" style={{ color: '#8A9189' }}>
          Pipeline
        </p>
        <div className="flex flex-wrap gap-3">
          {(['draft', 'sent', 'accepted', 'booked'] as const).map(s => {
            const count = statusCounts[s] ?? 0;
            const style = STATUS_COLOR[s];
            return (
              <Link
                key={s}
                href={`/trips`}
                className="flex items-center gap-3 px-4 py-3 rounded-[4px] hover:opacity-85 transition-opacity"
                style={{ background: style.bg, border: `1px solid ${style.bg}` }}
              >
                <span
                  className="font-mono text-[22px] leading-none"
                  style={{ color: style.text }}
                >
                  {count}
                </span>
                <span className="text-[11px] font-sans" style={{ color: style.text, opacity: 0.75 }}>
                  {STATUS_LABELS[s]}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Commission ─────────────────────────────────────────────────── */}
      {commission.count > 0 && (
        <section
          className="rounded-[6px] p-5"
          style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.06)' }}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-4" style={{ color: '#8A9189' }}>
            Commission
          </p>
          <div className="flex gap-10">
            <div>
              <p className="font-mono text-[11px] mb-1" style={{ color: '#8A9189' }}>Expected</p>
              <p className="font-mono text-[20px]" style={{ color: '#161A17' }}>
                ₹{commission.expected.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#8A9189' }}>
                across {commission.count} hotel{commission.count !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] mb-1" style={{ color: '#8A9189' }}>Received</p>
              <p className="font-mono text-[20px]" style={{ color: commission.received > 0 ? '#2E6B45' : '#8A9189' }}>
                ₹{commission.received.toLocaleString('en-IN')}
              </p>
              {commission.pending > 0 && (
                <p className="text-[10px] mt-1" style={{ color: '#A98B52' }}>
                  ₹{commission.pending.toLocaleString('en-IN')} pending
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Analytics ──────────────────────────────────────────────────── */}
      {analytics && analytics.total > 0 && (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-4" style={{ color: '#8A9189' }}>
            Performance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {([
              { label: 'Total trips', value: analytics.total, sub: null },
              { label: 'Booked', value: analytics.booked.count, sub: analytics.booked.count > 0 && analytics.total > 0 ? `${Math.round(analytics.booked.count / analytics.total * 100)}% conversion` : null },
              { label: 'Avg trip value', value: analytics.avgTripValue ? `₹${analytics.avgTripValue.toLocaleString('en-IN')}` : '—', sub: 'booked only' },
              { label: 'Booked revenue', value: analytics.totalBooked > 0 ? `₹${Math.round(analytics.totalBooked / 100000).toLocaleString('en-IN')}L` : '—', sub: null },
            ] as const).map(({ label, value, sub }) => (
              <div
                key={label}
                className="px-4 py-3 rounded-[4px]"
                style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.06)' }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-1" style={{ color: '#8A9189' }}>{label}</p>
                <p className="font-mono text-[18px] leading-none" style={{ color: '#161A17' }}>{value}</p>
                {sub && <p className="text-[9px] mt-1" style={{ color: '#8A9189' }}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Conversion funnel */}
          {analytics.total > 0 && (() => {
            const stages = [
              { label: 'Draft', count: analytics.draft.count, color: '#8A9189' },
              { label: 'Sent', count: analytics.sent.count, color: '#A98B52' },
              { label: 'Accepted', count: analytics.accepted.count, color: '#1E3A2F' },
              { label: 'Booked', count: analytics.booked.count, color: '#2E6B45' },
            ];
            const max = Math.max(...stages.map(s => s.count), 1);
            return (
              <div className="space-y-2">
                {stages.map(({ label, count: c, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-16 text-[10px]" style={{ color: '#8A9189' }}>{label}</span>
                    <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(22,26,23,0.06)', height: 6 }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(c / max * 100, 2)}%`, background: color }}
                      />
                    </div>
                    <span className="font-mono text-[11px] w-6 text-right" style={{ color: '#4A514B' }}>{c}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Recent trips ───────────────────────────────────────────────── */}
      {recentTrips.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#8A9189' }}>
              Recent
            </p>
            <Link href="/trips" className="text-[11px] transition-colors" style={{ color: '#A98B52' }}>
              All trips →
            </Link>
          </div>
          <div className="space-y-1">
            {recentTrips.map(t => {
              const sc = STATUS_COLOR[t.status] ?? STATUS_COLOR.draft;
              return (
                <Link
                  key={t.id}
                  href={`/trips/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-[4px] hover:bg-paper-deep transition-colors"
                  style={{ background: 'rgba(22,26,23,0.03)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink truncate">{t.label}</p>
                    {t.clientName && (
                      <p className="text-[11px] mt-0.5" style={{ color: '#8A9189' }}>{t.clientName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {t.totalFromInr != null && (
                      <span className="font-mono text-[11px]" style={{ color: '#A98B52' }}>
                        ₹{t.totalFromInr.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span
                      className="text-[9px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-[3px]"
                      style={{ background: sc.bg, color: sc.text }}
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
