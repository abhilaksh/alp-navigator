'use client';

import { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, X, MapPin, Sparkles } from 'lucide-react';
import { RateCard, type RateState } from './rate-card';
import type { ParsedRate } from '@/lib/db/schema';

const BADGE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
  rates: RateState[];
}

export interface HotelItemState {
  id: number;
  type: string;
  title: string;
  bookingStatus: string;
  sortOrder: number;
  hotelDetails: HotelDetailState | null;
}

interface HotelCardProps {
  item: HotelItemState;
  index: number;
  onRemove: (itemId: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
}

function renderStars(n: number | null) {
  if (!n) return null;
  return '★'.repeat(Math.min(n, 5));
}

export function HotelCard({
  item, index,
  onRemove, onMoveUp, onMoveDown, onAddRate, onRemoveRate, onParseRate, onSourceChange, onSelectProposal,
  onTitleChange, onRecommendationChange, onRecommendationBlur, onLocationScoreChange, onLocationScoreBlur,
}: HotelCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
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
  const foraUrl = detail?.foraId ? `https://travel.fora.travel/hotels/${detail.foraId}` : null;
  const expediaUrl = 'https://www.expediataap.com/';
  const websiteUrl = detail?.hotelWebsite ?? null;

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
          {/* Reorder buttons */}
          <div className="flex flex-col gap-[1px] flex-shrink-0 opacity-0 group-hover/hotel:opacity-60 hover:!opacity-100 transition-opacity">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="text-ink-mute cursor-pointer leading-none disabled:opacity-20 disabled:cursor-default transition-colors hover:text-brass"
              style={{ fontSize: 10, lineHeight: 1 }}
            >▲</button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="text-ink-mute cursor-pointer leading-none disabled:opacity-20 disabled:cursor-default transition-colors hover:text-brass"
              style={{ fontSize: 10, lineHeight: 1 }}
            >▼</button>
          </div>

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

            {/* Links */}
            <div className="flex gap-[5px] px-[11px] pb-[10px] pl-[40px]">
              {foraUrl && (
                <a href={foraUrl} target="_blank" rel="noopener" className="hotel-link">Fora ↗</a>
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
