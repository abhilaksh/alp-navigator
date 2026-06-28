'use client';

import { useState } from 'react';
import { ChevronRight, X, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { ParsedRate } from '@/lib/db/schema';

export interface RateState {
  id: number;
  source: string;
  sourceLabel: string | null;
  rawText: string | null;
  status: string;
  isConfirmed: number;
  parsedData: string | null;
  proposals: string | null;
  errorMessage: string | null;
  history: string | null;
  sortOrder: number;
}

interface RateCardProps {
  rate: RateState;
  index: number;
  onRemove: (rateId: number) => void;
  onParse: (rateId: number, rawText: string) => Promise<void>;
  onSourceChange: (rateId: number, source: string) => void;
  onSelectProposal: (rateId: number, proposal: ParsedRate) => void;
}

const SOURCES = [
  { value: 'fora',          label: 'Fora Preferred' },
  { value: 'expedia_taap',  label: 'Expedia TAAP' },
  { value: 'hotel_website', label: 'Hotel direct' },
  { value: 'booking',       label: 'Booking.com' },
  { value: 'direct',        label: 'Direct' },
  { value: 'other',         label: 'Other' },
];

function inr(n: number | undefined | null): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export function RateCard({ rate, index, onRemove, onParse, onSourceChange, onSelectProposal }: RateCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [localText, setLocalText] = useState(rate.rawText ?? '');
  const [parsing, setParsing] = useState(false);

  const parsed: ParsedRate | null = rate.parsedData ? (() => { try { return JSON.parse(rate.parsedData); } catch { return null; } })() : null;
  const proposals: ParsedRate[] = rate.proposals ? (() => { try { return JSON.parse(rate.proposals); } catch { return []; } })() : [];
  const history: { parsed: ParsedRate; rawText?: string; timestamp?: string }[] = rate.history
    ? (() => { try { return JSON.parse(rate.history); } catch { return []; } })()
    : [];
  const effectiveStatus = parsing ? 'parsing' : rate.status;

  async function handleParse() {
    if (!localText.trim() || parsing) return;
    setParsing(true);
    try { await onParse(rate.id, localText); } finally { setParsing(false); }
  }

  const summary = (() => {
    if (!parsed) return null;
    const parts: string[] = [];
    if (parsed.total_inr) parts.push(inr(parsed.total_inr));
    if (parsed.nights) parts.push(`${parsed.nights}n`);
    if (parsed.breakfast_included) parts.push('B&B');
    else if (parsed.board_basis) parts.push(parsed.board_basis);
    if (parsed.cancellation_free && parsed.cancellation_deadline) parts.push(`Free cancel ${parsed.cancellation_deadline}`);
    return parts.join(' · ');
  })();

  return (
    <div className="bg-white rounded-sm mb-1.5 overflow-hidden group/rate" style={{ border: '1px solid rgba(22,26,23,0.07)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
        style={{ transition: 'background 0.14s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,26,23,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
        onClick={() => setExpanded(v => !v)}
      >
        <ChevronRight
          size={12}
          className="text-ink-mute flex-shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-ink-mute flex-shrink-0">
          Rate {index + 1}
        </span>
        <span className="text-glacier mx-0.5 text-xs select-none">·</span>
        <select
          value={rate.source}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onSourceChange(rate.id, e.target.value); }}
          className="text-[11px] text-ink-soft bg-transparent outline-none cursor-pointer font-sans flex-shrink-0 px-0.5"
          style={{ border: 'none', borderBottom: '1px solid #C9D2CC' }}
        >
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Status badge */}
        {effectiveStatus === 'done' && parsed && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-success flex-shrink-0">
            <Check size={10} /> Parsed
          </span>
        )}
        {effectiveStatus === 'parsing' && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-mute flex-shrink-0">
            <Loader2 size={10} className="spin" /> Parsing…
          </span>
        )}
        {effectiveStatus === 'error' && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-danger flex-shrink-0">
            <AlertCircle size={10} /> Error
          </span>
        )}
        {effectiveStatus === 'proposals' && (
          <span className="font-mono text-[10px] font-medium text-brass flex-shrink-0">
            {proposals.length} options
          </span>
        )}
        {effectiveStatus === 'idle' && !parsed && (
          <span className="font-mono text-[10px] text-ink-mute flex-shrink-0">No rate yet</span>
        )}

        {/* Summary */}
        {summary && (
          <span className="flex-1 font-mono text-[10px] text-ink-mute overflow-hidden text-ellipsis whitespace-nowrap min-w-0 mx-1">
            {summary}
          </span>
        )}
        {!summary && <span className="flex-1" />}

        <button
          onClick={e => { e.stopPropagation(); onRemove(rate.id); }}
          className="p-0.5 flex items-center flex-shrink-0 text-ink-mute hover:text-danger transition-colors opacity-0 group-hover/rate:opacity-100"
        >
          <X size={11} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div>
          {/* Parsing spinner */}
          {effectiveStatus === 'parsing' && (
            <div className="flex items-center gap-3 px-4 py-4 text-ink-mute text-[13px] font-sans">
              <Loader2 size={16} className="spin text-brass" />
              Parsing rate…
            </div>
          )}

          {/* Idle / Error — paste textarea */}
          {(effectiveStatus === 'idle' || effectiveStatus === 'error') && !parsed && (
            <div className="px-2.5 pb-2.5">
              {effectiveStatus === 'error' && rate.errorMessage && (
                <div className="mb-2 px-2.5 py-2 text-danger text-xs font-sans" style={{ background: 'rgba(139,47,47,0.05)', borderLeft: '3px solid #8B2F2F' }}>
                  {rate.errorMessage}
                </div>
              )}
              <textarea
                value={localText}
                onChange={e => setLocalText(e.target.value)}
                rows={4}
                placeholder="Paste rate confirmation email or booking page content here…"
                className="block w-full min-h-[76px] border border-glacier rounded-sm px-2.5 py-2 font-mono text-[11px] text-ink resize-y outline-none placeholder:text-ink-mute transition-colors"
                style={{ background: 'rgba(22,26,23,0.025)' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#A98B52'; e.currentTarget.style.background = 'rgba(169,139,82,0.025)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#C9D2CC'; e.currentTarget.style.background = 'rgba(22,26,23,0.025)'; }}
              />
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <span className="text-[10px] text-ink-mute italic">Paste the full confirmation text for best results</span>
                <button
                  onClick={handleParse}
                  disabled={!localText.trim() || parsing}
                  className="inline-flex items-center gap-[5px] px-3 py-[5px] bg-spruce hover:bg-spruce-light text-white font-sans text-[11px] font-medium rounded-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={11} />
                  Parse rate
                </button>
              </div>
            </div>
          )}

          {/* Done state */}
          {effectiveStatus === 'done' && parsed && <DoneState parsed={parsed} />}

          {/* Parse history */}
          {effectiveStatus === 'done' && history.length > 0 && (
            <details className="px-2.5 pb-2.5">
              <summary className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute cursor-pointer hover:text-brass transition-colors select-none">
                History ({history.length} prev{history.length !== 1 ? 'ious' : ''} parse{history.length !== 1 ? 's' : ''})
              </summary>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {history.slice().reverse().map((h, i) => (
                  <div key={i} className="border border-glacier rounded-sm px-2.5 py-2" style={{ background: 'rgba(22,26,23,0.02)' }}>
                    <div className="flex items-baseline gap-2 mb-1">
                      {h.parsed.room_type && (
                        <span className="font-sans text-[11px] text-ink-soft">{h.parsed.room_type}</span>
                      )}
                      {h.parsed.total_inr && (
                        <span className="font-mono text-[11px] text-ink-mute ml-auto">{inr(h.parsed.total_inr)}</span>
                      )}
                    </div>
                    {h.timestamp && (
                      <div className="font-mono text-[9px] text-ink-mute">
                        {new Date(h.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Proposals state */}
          {effectiveStatus === 'proposals' && proposals.length > 0 && (
            <ProposalsState
              proposals={proposals}
              onSelect={p => onSelectProposal(rate.id, p)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Done state ──────────────────────────────────────────────────────────── */
function DoneState({ parsed }: { parsed: ParsedRate }) {
  return (
    <div className="px-2.5 pb-3">
      {parsed.room_type && (
        <div className="font-display italic font-light text-[14px] text-ink mb-0.5 tracking-[0.01em]">
          {parsed.room_type}
        </div>
      )}
      {(parsed.checkin || parsed.nights) && (
        <div className="font-mono text-[10px] text-ink-soft flex items-center gap-[7px] mb-2.5">
          {parsed.checkin && parsed.checkout && <span>{parsed.checkin} → {parsed.checkout}</span>}
          {parsed.nights && <span>· {parsed.nights} nights</span>}
          {(parsed.breakfast_included || parsed.board_basis) && (
            <span className="inline-block bg-glacier text-ink-soft font-mono text-[9px] font-medium tracking-[0.07em] uppercase px-1.5 py-0.5 rounded-sm">
              {parsed.breakfast_included ? 'B&B' : parsed.board_basis}
            </span>
          )}
        </div>
      )}

      {/* Receipt */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(22,26,23,0.10)' }}>
        {parsed.nightly_rates && parsed.nightly_rates.length > 0 && (
          <ReceiptRow label="Per night" value={inr(parsed.nightly_rates[0]?.rate_inr)} />
        )}
        {parsed.subtotal_inr != null && (
          <ReceiptRow label={`${parsed.nights ?? 1} night${(parsed.nights ?? 1) !== 1 ? 's' : ''}`} value={inr(parsed.subtotal_inr)} />
        )}
        {parsed.taxes_inr != null && <ReceiptRow label="Taxes & fees" value={inr(parsed.taxes_inr)} />}
        {parsed.total_inr != null && (
          <>
            <div className="h-px my-1.5" style={{ background: 'rgba(22,26,23,0.09)' }} />
            <ReceiptRow label="Total" value={inr(parsed.total_inr)} total />
          </>
        )}
      </div>

      {/* Cancellation */}
      {parsed.cancellation_free && (
        <div className="flex items-center gap-[5px] mt-2 text-[11px] text-success">
          <span className="w-[5px] h-[5px] rounded-full bg-success flex-shrink-0" />
          Free cancellation{parsed.cancellation_deadline ? ` until ${parsed.cancellation_deadline}` : ''}
        </div>
      )}

      {/* Perks + inclusions */}
      {((parsed.perks?.length ?? 0) > 0 || (parsed.inclusions?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {[...(parsed.perks ?? []), ...(parsed.inclusions ?? [])].map((p, i) => (
            <span
              key={i}
              className="text-[10px] font-sans text-brass font-medium px-[7px] py-0.5 rounded-sm"
              style={{ background: 'rgba(169,139,82,0.08)', border: '1px solid rgba(169,139,82,0.2)' }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className={`font-mono uppercase tracking-[0.09em] ${total ? 'text-[10px] text-ink font-medium' : 'text-[9px] text-ink-mute'}`}>
        {label}
      </span>
      <span className={`font-mono text-right ${total ? 'text-sm text-ink font-medium' : 'text-xs text-ink-soft'}`}>
        {value}
      </span>
    </div>
  );
}

/* ─── Proposals state ─────────────────────────────────────────────────────── */
function ProposalsState({ proposals, onSelect }: { proposals: ParsedRate[]; onSelect: (p: ParsedRate) => void }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-ink-mute mb-3 font-sans">
        <strong className="text-ink-soft">Found {proposals.length} options.</strong> Pick one to use:
      </p>
      {proposals.map((p, i) => (
        <div key={i} className="border border-glacier rounded-md px-3.5 py-3 mb-2.5 bg-paper/60">
          {p.room_type && (
            <div className="font-display text-sm text-ink mb-1">{p.room_type}</div>
          )}
          <div className="text-xs text-ink-mute font-sans mb-2">
            {p.checkin} → {p.checkout} · {p.nights} nights
          </div>
          <div className="font-mono text-[15px] text-spruce mb-2.5">
            {inr(p.total_inr)}
            {p.native_currency_code && p.native_currency_total != null && (
              <span className="text-xs text-ink-mute ml-1.5">
                ({p.native_currency_code} {p.native_currency_total.toLocaleString()})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSelect(p)}
              className="px-3.5 py-1.5 bg-spruce hover:bg-spruce-light text-white rounded-sm text-xs font-medium font-sans cursor-pointer transition-colors"
            >
              Use this rate
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
