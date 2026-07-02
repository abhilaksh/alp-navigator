'use client';

import { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, X, MapPin, Sparkles, GripVertical, RotateCw } from 'lucide-react';
import { RateCard, type RateState } from './rate-card';
import { SpecialRequestsPanel } from './special-requests-panel';
import type { ParsedRate } from '@/lib/db/schema';
import { buildForaSearchUrl, buildExpediaSearchUrl } from '@/lib/hotel-links';
import type { DragHandleProps } from './sortable-item';

const BADGE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface ForaPartnerInfo {
  programs: string[];
  awards?: Array<{ slug: string; label: string; value: number }>;
  commissionRange?: string;
  perks?: string;
}

export interface HotelDetailState {
  id: number;
  itemId: number;
  stars: number | null;
  rating: number | null;
  locationScore: number | null;
  recommendation: string | null;
  foraId: string | null;
  hotelWebsite: string | null;
  thumbnail: string | null;
  lat: number | null;
  lng: number | null;
  googleRateInr: number | null;
  holdExpiresAt: string | null;
  preferredStatus: string | null;  // 'fora' | 'virtuoso' | 'both' | 'none'
  eliminationNote: string | null;
  familiarityScore: number | null;  // 1–5
  familiarityDate: string | null;   // ISO date of last visit/FAM
  commissionPct: number | null;     // expected commission %
  commissionAmountInr: number | null;
  commissionPaidAt: string | null;  // ISO date, null = not yet received
  foraPartner?: ForaPartnerInfo | null;
  rates: RateState[];
}

export interface HotelItemState {
  id: number;
  type: string;
  title: string;
  bookingStatus: string;
  bookingRef: string | null;
  sortOrder: number;
  cancellationFreeUntil: string | null;
  visaRequired: number;
  specialRequests: string | null;
  hotelDetails: HotelDetailState | null;
}

interface HotelCardProps {
  item: HotelItemState;
  index: number;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number | null;
  children?: number | null;
  onRemove: (itemId: number) => void;
  dragHandleProps?: DragHandleProps;
  onRefreshRate?: (itemId: number) => Promise<void>;
  refreshingRate?: boolean;
  onAddRate: (hotelDetailId: number) => Promise<void>;
  onRemoveRate: (rateId: number) => void;
  onParseRate: (rateId: number, rawText: string) => Promise<void>;
  onSourceChange: (rateId: number, source: string) => void;
  onSelectProposal: (rateId: number, proposal: ParsedRate) => void;
  onTitleChange: (itemId: number, title: string) => void;
  onRecommendationChange: (itemId: number, value: string) => void;
  onRecommendationBlur: (hotelDetailId: number, value: string) => void;
  onLocationScoreChange: (itemId: number, value: string) => void;
  onLocationScoreBlur: (hotelDetailId: number, value: string) => void;
  onHoldExpiryChange: (hotelDetailId: number, date: string | null) => void;
  onPreferredStatusChange: (hotelDetailId: number, status: string) => void;
  onEliminationNoteChange: (hotelDetailId: number, note: string | null) => void;
  onFamiliarityChange: (hotelDetailId: number, score: number | null, date: string | null) => void;
  onCommissionChange: (hotelDetailId: number, pct: number | null, amountInr: number | null, paidAt: string | null) => void;
  onCancellationFreeUntilChange: (itemId: number, date: string | null) => void;
  onVisaRequiredChange: (itemId: number, value: number) => void;
  onSpecialRequestsChange: (itemId: number, json: string) => void;
  onBookingStatusChange: (itemId: number, status: string) => void;
  onBookingRefChange: (itemId: number, ref: string) => void;
  onRateExpiryChange?: (rateId: number, expiresAt: string | null) => void;
}

function renderStars(n: number | null) {
  if (!n) return null;
  return '★'.repeat(Math.min(n, 5));
}

const BOOKING_STATUSES = ['researching', 'quoted', 'confirmed', 'cancelled'] as const;
type BookingStatus = typeof BOOKING_STATUSES[number];

const BOOKING_BADGE: Record<BookingStatus, { color: string; bg: string }> = {
  researching: { color: '#8A9189', bg: 'rgba(22,26,23,0.06)' },
  quoted:      { color: '#A98B52', bg: 'rgba(169,139,82,0.1)' },
  confirmed:   { color: '#1E3A2F', bg: 'rgba(30,58,47,0.1)' },
  cancelled:   { color: '#8A9189', bg: 'rgba(22,26,23,0.04)' },
};

export function HotelCard({
  item, index, checkin, checkout, adults, children,
  onRemove, dragHandleProps, onRefreshRate, refreshingRate, onAddRate, onRemoveRate, onParseRate, onSourceChange, onSelectProposal,
  onTitleChange, onRecommendationChange, onRecommendationBlur, onLocationScoreChange, onLocationScoreBlur,
  onHoldExpiryChange, onPreferredStatusChange, onEliminationNoteChange, onFamiliarityChange,
  onCommissionChange,
  onCancellationFreeUntilChange, onVisaRequiredChange, onSpecialRequestsChange,
  onBookingStatusChange, onBookingRefChange, onRateExpiryChange,
}: HotelCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [showEliminationNote, setShowEliminationNote] = useState(false);
  const detail = item.hotelDetails;
  const badge = BADGE_LETTERS[index] ?? String(index + 1);
  const isComplete = detail?.rates.some(r => r.status === 'done') ?? false;
  const rateCount = detail?.rates.length ?? 0;

  // Sub-row summary for collapsed state
  const collapsedSummary = (() => {
    if (!detail) return null;
    const doneRate = detail.rates.find(r => r.status === 'done');
    if (!doneRate?.parsedData) return rateCount > 0 ? `${rateCount} rate${rateCount !== 1 ? 's' : ''} · Pending parse` : 'No rates yet';
    try {
      const p: ParsedRate = JSON.parse(doneRate.parsedData);
      const parts: string[] = [];
      if (p.room_type) parts.push(p.room_type);
      if (p.total_inr) parts.push(`₹${p.total_inr.toLocaleString('en-IN')}`);
      return parts.join(' · ') || 'Rate loaded';
    } catch { return null; }
  })();

  // Fora / ExpediaTAAP URLs
  const foraListingUrl = detail?.foraId ? `https://travel.fora.travel/hotels/${detail.foraId}` : null;
  const foraSearchUrl = buildForaSearchUrl({ hotelName: item.title, checkin, checkout, adults, children });
  const expediaUrl = buildExpediaSearchUrl({ hotelName: item.title, checkin, checkout, adults, lat: detail?.lat, lng: detail?.lng });
  const websiteUrl = detail?.hotelWebsite ?? null;

  // Hold expiry computation
  const holdExpiry = (() => {
    if (!detail?.holdExpiresAt) return null;
    const now = new Date();
    const expiry = new Date(detail.holdExpiresAt + 'T23:59:59');
    const msLeft = expiry.getTime() - now.getTime();
    const hLeft = msLeft / (1000 * 60 * 60);
    if (msLeft < 0) return { label: 'Hold expired', color: '#dc2626' };
    if (hLeft < 24) return { label: 'Hold expiring!', color: '#dc2626' };
    if (hLeft < 48) return { label: 'Hold: tomorrow', color: '#d97706' };
    const dLeft = Math.ceil(hLeft / 24);
    return { label: `Hold: ${dLeft}d`, color: '#64748b' };
  })();

  // GPS text
  const gpsText = (detail?.lat != null && detail?.lng != null)
    ? `${Math.abs(detail.lat).toFixed(4)}° ${detail.lat >= 0 ? 'N' : 'S'}, ${Math.abs(detail.lng).toFixed(4)}° ${detail.lng >= 0 ? 'E' : 'W'}`
    : null;

  return (
    <div
      className="relative rounded-[4px] mb-3 overflow-hidden transition-shadow group/hotel"
      style={{
        background: '#EDEAE1',
        borderLeft: `3px solid ${isComplete ? '#A98B52' : 'rgba(201,210,204,0.5)'}`,
        transition: 'border-color 0.24s ease, box-shadow 0.24s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(22,26,23,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
    >
      {/* Watermark letter */}
      <div
        className="absolute bottom-[-16px] right-[10px] font-display italic font-light leading-none pointer-events-none select-none z-0"
        style={{ fontSize: 130, color: isComplete ? '#A98B52' : '#1E3A2F', opacity: isComplete ? 0.07 : 0.04 }}
      >
        {badge}
      </div>

      <div className="relative z-[1]">
        {/* ── Card header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-[7px] px-[11px] py-[11px] pb-[9px]">
          {/* Drag handle */}
          <button
            {...(dragHandleProps?.attributes ?? {})}
            {...(dragHandleProps?.listeners ?? {})}
            className="text-ink-mute flex-shrink-0 opacity-0 group-hover/hotel:opacity-60 hover:!opacity-100 transition-opacity"
            style={{ touchAction: 'none', cursor: 'grab' }}
          >
            <GripVertical size={14} />
          </button>

          {/* Badge */}
          <span
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 font-display italic font-light text-[12px] text-white transition-colors"
            style={{ background: isComplete ? '#A98B52' : '#1E3A2F' }}
          >
            {badge}
          </span>

          {/* Name */}
          <input
            type="text"
            value={item.title}
            onChange={e => onTitleChange(item.id, e.target.value)}
            className="flex-1 font-display text-[15px] font-normal text-ink bg-transparent border-none border-b border-b-transparent outline-none py-px min-w-0"
            style={{ borderBottom: '1px solid transparent', transition: 'border-color 0.14s' }}
            onMouseEnter={e => (e.currentTarget.style.borderBottomColor = '#E2E8E4')}
            onMouseLeave={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
            onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
            onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
          />

          {/* Stars */}
          {detail?.stars && (
            <span className="text-brass text-[10px] tracking-[-0.5px] flex-shrink-0">{renderStars(detail.stars)}</span>
          )}

          {/* Rating */}
          {detail?.rating && (
            <span
              className="font-mono text-[11px] text-ink-soft flex-shrink-0 px-[5px] py-0.5 rounded-[3px]"
              style={{ background: 'rgba(22,26,23,0.06)' }}
            >
              {detail.rating.toFixed(1)}
            </span>
          )}

          {/* Google rate + refresh */}
          {onRefreshRate && (
            <span className="flex items-center gap-[3px] flex-shrink-0">
              {detail?.googleRateInr != null && (
                <span className="font-mono text-[10px] text-ink-mute">
                  ₹{Math.round(detail.googleRateInr / 1000)}k/n
                </span>
              )}
              <button
                onClick={() => onRefreshRate(item.id)}
                disabled={refreshingRate}
                title="Refresh Google rate"
                className="text-ink-mute hover:text-spruce transition-colors disabled:opacity-50"
                style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0 }}
              >
                <RotateCw size={11} className={refreshingRate ? 'spin' : ''} />
              </button>
            </span>
          )}

          {/* Hold expiry badge */}
          {holdExpiry && (
            <span
              className="font-mono text-[10px] font-medium flex-shrink-0 px-[6px] py-[2px] rounded-[3px]"
              style={{ color: holdExpiry.color, background: `${holdExpiry.color}18` }}
            >
              {holdExpiry.label}
            </span>
          )}

          {/* Booking status chip */}
          {item.bookingStatus !== 'researching' && (
            <button
              onClick={() => {
                const idx = BOOKING_STATUSES.indexOf(item.bookingStatus as BookingStatus);
                const next = BOOKING_STATUSES[(idx + 1) % BOOKING_STATUSES.length];
                onBookingStatusChange(item.id, next);
              }}
              className="font-mono text-[9px] uppercase tracking-[0.06em] px-[6px] py-[2px] rounded-[2px] cursor-pointer flex-shrink-0 transition-opacity hover:opacity-70"
              style={{
                background: BOOKING_BADGE[(item.bookingStatus as BookingStatus) ?? 'researching'].bg,
                color: BOOKING_BADGE[(item.bookingStatus as BookingStatus) ?? 'researching'].color,
                border: 'none',
              }}
              title="Click to advance booking status"
            >
              {item.bookingStatus}
            </button>
          )}

          {/* Fora program + award badges */}
          {detail?.foraPartner?.programs.includes('Fora Reserve') && (
            <span className="font-sans text-[9px] font-semibold tracking-[0.06em] uppercase flex-shrink-0 px-[5px] py-[2px] rounded-[2px]"
              style={{ background: 'rgba(169,139,82,0.15)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.3)' }}>
              FR
            </span>
          )}
          {detail?.foraPartner?.awards?.map((aw, ai) => (
            <span key={ai} className="font-sans text-[9px] font-medium flex-shrink-0 px-[5px] py-[2px] rounded-[2px]"
              style={{ background: 'rgba(30,58,47,0.08)', color: '#4A514B', border: '1px solid rgba(30,58,47,0.15)' }}>
              {aw.slug === 'michelin_keys' ? `${aw.value}🔑` : aw.slug === 'michelin_stars' ? `${aw.value}★M` : aw.slug === 'forbes' ? 'Forbes' : aw.label}
            </span>
          ))}

          {/* Preferred status badge */}
          {detail && detail.preferredStatus && detail.preferredStatus !== 'none' && (
            <span
              className="font-sans text-[9px] font-semibold uppercase tracking-[0.06em] flex-shrink-0 px-[6px] py-[2px] rounded-[2px] cursor-pointer"
              style={
                detail.preferredStatus === 'fora'
                  ? { background: 'rgba(169,139,82,0.15)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.35)' }
                  : detail.preferredStatus === 'virtuoso'
                  ? { background: 'rgba(30,58,47,0.12)', color: '#1E3A2F', border: '1px solid rgba(30,58,47,0.3)' }
                  : { background: 'linear-gradient(90deg, rgba(169,139,82,0.15), rgba(30,58,47,0.12))', color: '#4A514B', border: '1px solid rgba(169,139,82,0.3)' }
              }
              title="Click to clear preferred status"
              onClick={() => detail && onPreferredStatusChange(detail.id, 'none')}
            >
              {detail.preferredStatus === 'fora' ? 'Fora Pref' : detail.preferredStatus === 'virtuoso' ? 'Virtuoso' : 'Fora + Virtuoso'}
            </span>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-[3px] text-ink-mute flex items-center flex-shrink-0 transition-colors hover:text-ink"
            style={{ opacity: 1 }}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Remove */}
          <button
            onClick={() => setPendingRemove(true)}
            className="p-[3px] text-ink-mute flex items-center flex-shrink-0 opacity-0 group-hover/hotel:opacity-100 transition-opacity hover:text-danger"
          >
            <X size={12} />
          </button>
        </div>

        {/* ── Collapsed summary ─────────────────────────────────────── */}
        {collapsed && (
          <div className="flex items-center gap-3 px-4 pb-3 text-xs text-ink-mute font-sans">
            {collapsedSummary && <span>{collapsedSummary}</span>}
            {rateCount > 0 && <span className="text-ink-mute/60">· {rateCount} rate{rateCount !== 1 ? 's' : ''}</span>}
          </div>
        )}

        {/* ── Expanded content ──────────────────────────────────────── */}
        {!collapsed && (
          <>
            {/* Sub-row */}
            {collapsedSummary && (
              <div className="px-[11px] pb-[7px] pl-[40px] text-[11px] text-ink-soft tracking-[0.01em]">
                {collapsedSummary}
              </div>
            )}

            {/* Fora programs + perks */}
            {detail?.foraPartner && (
              <div className="px-[11px] pb-[8px] pl-[40px]">
                <div className="flex flex-wrap gap-[5px] mb-[5px]">
                  {detail.foraPartner.programs.map((prog, pi) => (
                    <span key={pi}
                      className="font-sans text-[9px] font-semibold uppercase tracking-[0.06em] px-[6px] py-[2px] rounded-[2px]"
                      style={prog === 'Fora Reserve'
                        ? { background: 'rgba(169,139,82,0.12)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.28)' }
                        : { background: 'rgba(30,58,47,0.07)', color: '#4A514B', border: '1px solid rgba(30,58,47,0.14)' }
                      }>{prog}</span>
                  ))}
                  {detail.foraPartner.commissionRange && (
                    <span className="font-mono text-[9px] px-[5px] py-[2px] rounded-[2px]"
                      style={{ background: 'rgba(22,26,23,0.05)', color: '#8A9189' }}>
                      {detail.foraPartner.commissionRange}
                    </span>
                  )}
                </div>
                {detail.foraPartner.perks && (
                  <p className="font-sans text-[10px] text-ink-soft leading-[1.55]" style={{ borderLeft: '2px solid rgba(169,139,82,0.35)', paddingLeft: 6 }}>
                    {detail.foraPartner.perks}
                  </p>
                )}
              </div>
            )}

            {/* Links */}
            <div className="flex gap-[5px] px-[11px] pb-[10px] pl-[40px]">
              <a href={foraSearchUrl} target="_blank" rel="noopener" className="hotel-link">Fora ↗</a>
              {foraListingUrl && (
                <a href={foraListingUrl} target="_blank" rel="noopener" className="hotel-link">Fora listing ↗</a>
              )}
              <a href={expediaUrl} target="_blank" rel="noopener" className="hotel-link">ExpediaTAAP ↗</a>
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener" className="hotel-link">Website ↗</a>
              )}
            </div>

            {/* Meta: location score + our take */}
            <div className="flex flex-col gap-[9px] px-[11px] pb-[10px] pl-[40px]">
              {/* Location score */}
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Location score</div>
                <div className="flex items-baseline gap-[5px]">
                  <input
                    type="text"
                    value={detail?.locationScore?.toString() ?? ''}
                    onChange={e => onLocationScoreChange(item.id, e.target.value)}
                    onBlur={e => detail && onLocationScoreBlur(detail.id, e.target.value)}
                    placeholder="—"
                    className="font-mono text-[14px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none w-[46px] p-0 transition-colors"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlurCapture={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                  <span className="font-mono text-[9px] text-ink-mute">/ 10</span>
                </div>
              </div>

              {/* Hold expiry date */}
              {detail && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Hold expires</div>
                  <input
                    type="date"
                    value={detail.holdExpiresAt ?? ''}
                    onChange={e => onHoldExpiryChange(detail.id, e.target.value || null)}
                    className="font-mono text-[12px] text-ink-soft bg-transparent border-none outline-none p-0 transition-colors"
                    style={{ borderBottom: '1px solid transparent', colorScheme: 'light' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                </div>
              )}

              {/* Preferred status selector */}
              {detail && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[4px]">Preferred partner</div>
                  <div className="flex gap-[5px]">
                    {(['none', 'fora', 'virtuoso', 'both'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => onPreferredStatusChange(detail.id, s)}
                        className="font-sans text-[9px] uppercase tracking-[0.05em] px-[6px] py-[2px] rounded-[2px] cursor-pointer transition-all"
                        style={{
                          background: detail.preferredStatus === s
                            ? (s === 'fora' ? 'rgba(169,139,82,0.2)' : s === 'virtuoso' ? 'rgba(30,58,47,0.15)' : s === 'both' ? 'rgba(169,139,82,0.12)' : 'rgba(22,26,23,0.07)')
                            : 'rgba(22,26,23,0.04)',
                          color: detail.preferredStatus === s
                            ? (s === 'fora' ? '#A98B52' : s === 'virtuoso' ? '#1E3A2F' : s === 'both' ? '#4A514B' : '#8A9189')
                            : '#8A9189',
                          border: `1px solid ${detail.preferredStatus === s
                            ? (s === 'fora' ? 'rgba(169,139,82,0.4)' : s === 'virtuoso' ? 'rgba(30,58,47,0.35)' : s === 'both' ? 'rgba(169,139,82,0.3)' : 'rgba(22,26,23,0.12)')
                            : 'transparent'}`,
                          fontWeight: detail.preferredStatus === s ? 600 : 400,
                        }}
                      >
                        {s === 'none' ? '—' : s === 'fora' ? 'Fora' : s === 'virtuoso' ? 'Virtuoso' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Familiarity score + date */}
              {detail && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[4px]">Familiarity</div>
                  <div className="flex items-center gap-[10px]">
                    <div className="flex gap-[4px]">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => onFamiliarityChange(detail.id, detail.familiarityScore === n ? null : n, detail.familiarityDate)}
                          className="cursor-pointer transition-all"
                          style={{
                            fontSize: 14,
                            color: (detail.familiarityScore ?? 0) >= n ? '#A98B52' : '#C9D2CC',
                            lineHeight: 1,
                            background: 'none',
                            border: 'none',
                            padding: '0 1px',
                          }}
                          title={`Familiarity: ${n}/5`}
                        >●</button>
                      ))}
                    </div>
                    <input
                      type="date"
                      value={detail.familiarityDate ?? ''}
                      onChange={e => onFamiliarityChange(detail.id, detail.familiarityScore, e.target.value || null)}
                      className="font-mono text-[10px] text-ink-mute bg-transparent border-none outline-none p-0 transition-colors"
                      style={{ borderBottom: '1px solid transparent', colorScheme: 'light' }}
                      onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                      onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                      title="Date of last visit or FAM trip"
                    />
                    {detail.familiarityDate && (
                      <span className="font-mono text-[9px] text-ink-mute">visited</span>
                    )}
                  </div>
                </div>
              )}

              {/* Elimination note */}
              {detail && (detail.eliminationNote || showEliminationNote) ? (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Cut because…</div>
                  <textarea
                    value={detail.eliminationNote ?? ''}
                    onChange={e => onEliminationNoteChange(detail.id, e.target.value || null)}
                    rows={2}
                    placeholder="Why this property was considered and cut…"
                    className="w-full bg-transparent border-none outline-none font-sans text-xs text-ink-soft leading-[1.65] resize-none py-0 pl-[7px] min-h-[34px] transition-colors placeholder:text-ink-mute placeholder:italic"
                    style={{ borderLeft: '2px solid rgba(139,47,47,0.25)', transition: 'border-color 0.14s' }}
                    onFocus={e => (e.currentTarget.style.borderLeftColor = 'rgba(139,47,47,0.6)')}
                    onBlur={e => {
                      e.currentTarget.style.borderLeftColor = 'rgba(139,47,47,0.25)';
                      if (!e.currentTarget.value) setShowEliminationNote(false);
                    }}
                    autoFocus={showEliminationNote && !detail.eliminationNote}
                  />
                </div>
              ) : detail ? (
                <button
                  onClick={() => setShowEliminationNote(true)}
                  className="text-[10px] font-sans text-ink-mute hover:text-ink-soft transition-colors text-left"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  + Add elimination note
                </button>
              ) : null}

              {/* Commission tracking */}
              {detail && item.bookingStatus !== 'researching' && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[4px]">Commission</div>
                  <div className="flex items-center gap-[12px] flex-wrap">
                    <div className="flex items-baseline gap-[4px]">
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={100}
                        value={detail.commissionPct ?? ''}
                        onChange={e => {
                          const pct = e.target.value ? parseFloat(e.target.value) : null;
                          // auto-calc amount from best parsed rate total
                          const doneRate = detail.rates.find(r => r.status === 'done');
                          let autoAmount: number | null = null;
                          if (pct && doneRate?.parsedData) {
                            try {
                              const p = JSON.parse(doneRate.parsedData);
                              if (p.total_inr) autoAmount = Math.round(p.total_inr * pct / 100);
                            } catch { /* no-op */ }
                          }
                          onCommissionChange(detail.id, pct, autoAmount ?? detail.commissionAmountInr, detail.commissionPaidAt);
                        }}
                        placeholder="—"
                        className="font-mono text-[13px] text-ink-soft bg-transparent border-none outline-none w-[38px] p-0 transition-colors"
                        style={{ borderBottom: '1px solid transparent' }}
                        onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                        onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                      />
                      <span className="font-mono text-[9px] text-ink-mute">%</span>
                    </div>
                    {detail.commissionPct && (
                      <div className="flex items-baseline gap-[4px]">
                        <input
                          type="number"
                          value={detail.commissionAmountInr ?? ''}
                          onChange={e => onCommissionChange(detail.id, detail.commissionPct, e.target.value ? parseInt(e.target.value) : null, detail.commissionPaidAt)}
                          placeholder="₹—"
                          className="font-mono text-[13px] text-ink-soft bg-transparent border-none outline-none w-[80px] p-0 transition-colors"
                          style={{ borderBottom: '1px solid transparent' }}
                          onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                        />
                        <span className="font-mono text-[9px] text-ink-mute">INR</span>
                      </div>
                    )}
                    {detail.commissionPct && (
                      <div className="flex items-baseline gap-[4px]">
                        <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-mute">Rcvd</span>
                        <input
                          type="date"
                          value={detail.commissionPaidAt ?? ''}
                          onChange={e => onCommissionChange(detail.id, detail.commissionPct, detail.commissionAmountInr, e.target.value || null)}
                          className="font-mono text-[11px] text-ink-soft bg-transparent border-none outline-none p-0 transition-colors"
                          style={{ borderBottom: '1px solid transparent', colorScheme: 'light' }}
                          onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                        />
                        {detail.commissionPaidAt && (
                          <span
                            className="font-mono text-[9px] px-[5px] py-px rounded-[2px]"
                            style={{ background: 'rgba(46,107,69,0.1)', color: '#2E6B45' }}
                          >
                            Paid
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation free until + visa required + booking status */}
              <div className="flex gap-[18px] flex-wrap">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Cancel free until</div>
                  <input
                    type="date"
                    value={item.cancellationFreeUntil ?? ''}
                    onChange={e => onCancellationFreeUntilChange(item.id, e.target.value || null)}
                    className="font-mono text-[12px] text-ink-soft bg-transparent border-none outline-none p-0 transition-colors"
                    style={{ borderBottom: '1px solid transparent', colorScheme: 'light' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Booking status</div>
                  <div className="flex gap-[5px]">
                    {BOOKING_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => onBookingStatusChange(item.id, s)}
                        className="font-mono text-[8px] uppercase tracking-[0.05em] px-[5px] py-[2px] rounded-[2px] cursor-pointer transition-opacity"
                        style={{
                          background: item.bookingStatus === s ? BOOKING_BADGE[s].bg : 'rgba(22,26,23,0.04)',
                          color: item.bookingStatus === s ? BOOKING_BADGE[s].color : '#8A9189',
                          border: `1px solid ${item.bookingStatus === s ? BOOKING_BADGE[s].color + '40' : 'transparent'}`,
                          fontWeight: item.bookingStatus === s ? 600 : 400,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Booking ref</div>
                  <input
                    type="text"
                    defaultValue={item.bookingRef ?? ''}
                    onBlur={e => {
                      e.currentTarget.style.borderBottomColor = 'transparent';
                      const val = e.currentTarget.value.trim();
                      if (val !== (item.bookingRef ?? '')) onBookingRefChange(item.id, val);
                    }}
                    placeholder="—"
                    className="font-mono text-[12px] text-ink-soft bg-transparent border-none outline-none p-0 transition-colors w-[100px]"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                  />
                </div>
                <div className="flex items-center gap-[6px]">
                  <input
                    type="checkbox"
                    id={`visa-${item.id}`}
                    checked={item.visaRequired === 1}
                    onChange={e => onVisaRequiredChange(item.id, e.target.checked ? 1 : 0)}
                    className="cursor-pointer accent-brass w-[13px] h-[13px]"
                  />
                  <label htmlFor={`visa-${item.id}`} className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute cursor-pointer">
                    Visa req.
                  </label>
                </div>
              </div>

              {/* Our take */}
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-[3px]">Our take</div>
                <div className="relative">
                  <textarea
                    value={detail?.recommendation ?? ''}
                    onChange={e => onRecommendationChange(item.id, e.target.value)}
                    onBlur={e => detail && onRecommendationBlur(detail.id, e.target.value)}
                    rows={2}
                    placeholder="Add your note about this property…"
                    className="w-full bg-transparent border-none border-l-2 border-l-transparent outline-none font-sans text-xs text-ink-soft leading-[1.65] resize-none py-0 pb-6 pl-[7px] min-h-[38px] transition-colors placeholder:text-ink-mute placeholder:italic"
                    style={{ borderLeft: '2px solid transparent', transition: 'border-color 0.14s, color 0.14s' }}
                    onFocus={e => { e.currentTarget.style.borderLeftColor = '#A98B52'; e.currentTarget.style.color = '#161A17'; }}
                    onBlurCapture={e => { e.currentTarget.style.borderLeftColor = 'transparent'; e.currentTarget.style.color = ''; }}
                  />
                  <button
                    className="absolute bottom-[6px] right-[6px] inline-flex items-center gap-1 px-2 py-[3px] rounded-[3px] text-brass text-[11px] font-sans cursor-pointer transition-colors"
                    style={{ border: '1px solid rgba(169,139,82,0.35)', background: 'rgba(246,244,238,0.9)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#A98B52'; e.currentTarget.style.color = '#F6F4EE'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(246,244,238,0.9)'; e.currentTarget.style.color = '#A98B52'; }}
                  >
                    <Sparkles size={11} /> AI
                  </button>
                </div>
              </div>
            </div>

            {/* GPS row */}
            {(gpsText || detail) && (
              <div className="flex items-center gap-[7px] px-[11px] pb-[10px] pl-[40px]">
                {gpsText ? (
                  <a
                    href={`https://maps.google.com/?q=${detail?.lat},${detail?.lng}`}
                    target="_blank" rel="noopener"
                    className="font-mono text-[10px] text-ink-mute hover:text-brass transition-colors"
                  >
                    {gpsText}
                  </a>
                ) : (
                  <span className="font-mono text-[10px] text-ink-mute">No location set</span>
                )}
                <button className="text-[10px] font-sans text-ink-mute border border-glacier px-2 py-0.5 rounded-sm hover:text-spruce hover:border-spruce transition-colors">
                  <MapPin size={9} className="inline mr-1" />Find
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="h-px mx-[11px]" style={{ background: 'rgba(22,26,23,0.07)' }} />

            {/* Rates */}
            {detail && (
              <div className="px-[11px] pt-[10px] pb-[12px]">
                {detail.rates.map((rate, i) => (
                  <RateCard
                    key={rate.id}
                    rate={rate}
                    index={i}
                    onRemove={onRemoveRate}
                    onParse={onParseRate}
                    onSourceChange={onSourceChange}
                    onSelectProposal={onSelectProposal}
                    onExpiryChange={onRateExpiryChange}
                  />
                ))}
                <button
                  onClick={() => onAddRate(detail.id)}
                  className="flex items-center gap-[5px] w-full px-[10px] py-[6px] text-[11px] text-ink-mute bg-none border border-dashed border-glacier rounded-sm cursor-pointer hover:text-brass hover:border-brass transition-colors"
                  style={{ background: 'none' }}
                >
                  + Add another rate
                </button>
              </div>
            )}

            {/* Special requests */}
            <SpecialRequestsPanel
              itemId={item.id}
              initialRequests={item.specialRequests}
              onChange={onSpecialRequestsChange}
            />
          </>
        )}

        {/* ── Delete confirm ────────────────────────────────────────── */}
        {pendingRemove && (
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-sans text-danger"
            style={{ background: 'rgba(139,47,47,0.06)', borderTop: '1px solid rgba(139,47,47,0.15)' }}
          >
            <span>Remove this hotel?</span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => { setPendingRemove(false); onRemove(item.id); }}
                className="px-3 py-[5px] bg-danger text-paper border-none rounded-sm text-xs cursor-pointer font-sans"
              >
                Remove
              </button>
              <button
                onClick={() => setPendingRemove(false)}
                className="px-3 py-[5px] text-ink-soft border border-glacier rounded-sm text-xs cursor-pointer font-sans"
                style={{ background: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
