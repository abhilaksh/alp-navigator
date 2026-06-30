'use client';

import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import type { HotelItemState } from './hotel-card';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';

type BookingStatus = 'researching' | 'quoted' | 'confirmed' | 'cancelled';

const STATUS_CYCLE: BookingStatus[] = ['researching', 'quoted', 'confirmed', 'cancelled'];

const STATUS_STYLE: Record<BookingStatus, { label: string; bg: string; color: string; border: string }> = {
  researching: { label: 'Researching', bg: 'rgba(22,26,23,0.05)',    color: '#4A514B', border: 'rgba(22,26,23,0.12)' },
  quoted:      { label: 'Quoted',      bg: 'rgba(169,139,82,0.1)',   color: '#A98B52', border: 'rgba(169,139,82,0.3)' },
  confirmed:   { label: 'Confirmed',   bg: 'rgba(30,58,47,0.1)',     color: '#1E3A2F', border: 'rgba(30,58,47,0.25)' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(22,26,23,0.04)',    color: '#8A9189', border: 'rgba(22,26,23,0.1)'  },
};

function getDaysDiff(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function CancelBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const days = getDaysDiff(date);
  if (days === null) return null;
  if (days < 0) return (
    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px]"
      style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
      Free cancel expired
    </span>
  );
  if (days <= 2) return (
    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px]"
      style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
      Cancel free: {days}d left!
    </span>
  );
  if (days <= 7) return (
    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px]"
      style={{ background: 'rgba(217,119,6,0.08)', color: '#d97706' }}>
      Cancel free: {days}d
    </span>
  );
  return (
    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px]"
      style={{ background: 'rgba(22,26,23,0.05)', color: '#8A9189' }}>
      Cancel free: {days}d
    </span>
  );
}

interface BookingsPanelProps {
  destinations: DestinationState[];
  onStatusChange: (itemId: number, status: string) => void;
  onBookingRefChange: (itemId: number, ref: string) => void;
}

export function BookingsPanel({ destinations, onStatusChange, onBookingRefChange }: BookingsPanelProps) {
  // Flatten all hotel items with their destination context
  const rows: Array<{ dest: DestinationState; hotel: HotelItemState }> = [];
  for (const dest of destinations) {
    for (const item of dest.items) {
      if (isHotelItem(item)) rows.push({ dest, hotel: item });
    }
  }

  // Alerts
  const urgentCancels = rows.filter(r => {
    const days = getDaysDiff(r.hotel.cancellationFreeUntil);
    return days !== null && days <= 7;
  });

  const expiringHolds = rows.filter(r => {
    if (!r.hotel.hotelDetails?.holdExpiresAt) return false;
    const days = getDaysDiff(r.hotel.hotelDetails.holdExpiresAt);
    return days !== null && days <= 2;
  });

  // Totals
  const confirmedTotal = rows.reduce((sum, r) => {
    if (r.hotel.bookingStatus !== 'confirmed') return sum;
    const rates = r.hotel.hotelDetails?.rates ?? [];
    const cheapest = rates.reduce((min, rate) => {
      const parsed = rate.parsedData ? (JSON.parse(rate.parsedData) as { total_inr?: number }) : null;
      const amt = parsed?.total_inr ?? 0;
      return amt > 0 && amt < min ? amt : min;
    }, Infinity);
    return sum + (cheapest < Infinity ? cheapest : 0);
  }, 0);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-ink-mute font-sans">No hotels added yet.</p>
      </div>
    );
  }

  function cycleStatus(itemId: number, current: string) {
    const idx = STATUS_CYCLE.indexOf(current as BookingStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onStatusChange(itemId, next);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-paper" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>
      <div className="max-w-3xl mx-auto px-6 py-7">

        {/* Alert banners */}
        {urgentCancels.length > 0 && (
          <div className="mb-5 px-4 py-3 rounded-[4px] text-[12px] font-sans"
            style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', color: '#b45309' }}>
            <span className="font-semibold">Free cancellation expiring soon:</span>
            {' '}{urgentCancels.map(r => r.hotel.title).join(', ')}.
          </div>
        )}
        {expiringHolds.length > 0 && (
          <div className="mb-5 px-4 py-3 rounded-[4px] text-[12px] font-sans"
            style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.22)', color: '#b91c1c' }}>
            <span className="font-semibold">Hold expiring soon:</span>
            {' '}{expiringHolds.map(r => r.hotel.title).join(', ')}.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[15px] text-ink" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}>
            Bookings overview
          </h2>
          {confirmedTotal > 0 && (
            <span className="font-mono text-[12px]" style={{ color: '#A98B52' }}>
              ₹{confirmedTotal.toLocaleString('en-IN')} confirmed
            </span>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(22,26,23,0.09)', boxShadow: '0 1px 3px rgba(22,26,23,0.04)' }}>
          {/* Column headers */}
          <div
            className="grid px-4 py-2"
            style={{
              gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr',
              borderBottom: '1px solid rgba(22,26,23,0.07)',
              background: 'rgba(22,26,23,0.02)',
            }}
          >
            {['Destination', 'Hotel', 'Status', 'Booking ref', 'Deadlines'].map(h => (
              <span key={h} className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {rows.map(({ dest, hotel }, ri) => {
            const ss = STATUS_STYLE[hotel.bookingStatus as BookingStatus] ?? STATUS_STYLE.researching;
            const rateStatus = (() => {
              const rates = hotel.hotelDetails?.rates ?? [];
              if (rates.some(r => r.status === 'done')) return { label: 'Rate parsed', color: '#1E3A2F', bg: 'rgba(30,58,47,0.08)' };
              if (rates.length > 0) return { label: `${rates.length} rate${rates.length > 1 ? 's' : ''}`, color: '#8A9189', bg: 'rgba(22,26,23,0.05)' };
              return null;
            })();

            return (
              <div
                key={hotel.id}
                className="grid items-start px-4 py-3 group hover:bg-paper transition-colors"
                style={{
                  gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr',
                  borderBottom: ri < rows.length - 1 ? '1px solid rgba(22,26,23,0.05)' : 'none',
                }}
              >
                {/* Destination */}
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[11px] text-ink-soft">{dest.name}</span>
                  {(dest.checkin || dest.checkout) && (
                    <span className="font-mono text-[9px] text-ink-mute">
                      {dest.checkin?.slice(5)} – {dest.checkout?.slice(5)}
                    </span>
                  )}
                </div>

                {/* Hotel name + rate badge */}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-display text-[13px] text-ink truncate" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}>
                    {hotel.title}
                  </span>
                  {hotel.hotelDetails?.stars && (
                    <span className="text-[9px] text-brass">{'★'.repeat(hotel.hotelDetails.stars)}</span>
                  )}
                  {rateStatus && (
                    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px] w-fit"
                      style={{ background: rateStatus.bg, color: rateStatus.color }}>
                      {rateStatus.label}
                    </span>
                  )}
                </div>

                {/* Booking status (clickable) */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => cycleStatus(hotel.id, hotel.bookingStatus)}
                    className="text-[9px] font-mono uppercase tracking-[0.06em] px-[6px] py-[3px] rounded-[2px] cursor-pointer transition-opacity hover:opacity-70 w-fit"
                    style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                    title="Click to advance status"
                  >
                    {ss.label}
                  </button>
                </div>

                {/* Booking ref */}
                <div>
                  <input
                    type="text"
                    defaultValue={(hotel as unknown as { bookingRef?: string | null }).bookingRef ?? ''}
                    onBlur={e => {
                      const val = e.currentTarget.value.trim();
                      if (val !== ((hotel as unknown as { bookingRef?: string | null }).bookingRef ?? '')) {
                        onBookingRefChange(hotel.id, val);
                      }
                    }}
                    placeholder="—"
                    className="font-mono text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-px transition-colors w-full"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlurCapture={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                </div>

                {/* Deadlines */}
                <div className="flex flex-col gap-1">
                  <CancelBadge date={hotel.cancellationFreeUntil} />
                  {hotel.hotelDetails?.holdExpiresAt && (
                    <span className="font-mono text-[8px] px-[5px] py-[2px] rounded-[2px]"
                      style={{ background: 'rgba(22,26,23,0.05)', color: '#8A9189' }}>
                      Hold: {hotel.hotelDetails.holdExpiresAt}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status summary */}
        <div className="mt-5 flex gap-4 text-[11px] font-sans text-ink-mute">
          {(Object.keys(STATUS_STYLE) as BookingStatus[]).map(s => {
            const count = rows.filter(r => r.hotel.bookingStatus === s).length;
            if (!count) return null;
            const ss = STATUS_STYLE[s];
            return (
              <span key={s} className="flex items-center gap-[5px]">
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: ss.color }} />
                <span style={{ color: ss.color }}>{count}</span>
                <span>{ss.label.toLowerCase()}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
