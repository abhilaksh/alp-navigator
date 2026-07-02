'use client';

import { useState } from 'react';
import { ChevronRight, X, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { ParsedItemRate } from '@/lib/db/schema';

export interface ItemRateState {
  id: number;
  source: string | null;
  sourceLabel: string | null;
  rawText: string | null;
  status: string;
  isConfirmed: number;
  parsedData: string | null;
  proposals: string | null;
  errorMessage: string | null;
  history: string | null;
  sortOrder: number;
  updatedAt: Date | string | null;
  expiresAt: string | null;
}

interface ItemRateCardProps {
  rate: ItemRateState;
  index: number;
  itemType: string;
  onRemove: (rateId: number) => void;
  onParse: (rateId: number, rawText: string) => Promise<void>;
  onSourceChange: (rateId: number, source: string) => void;
  onSelectProposal: (rateId: number, proposal: ParsedItemRate) => void;
  onExpiryChange?: (rateId: number, expiresAt: string | null) => void;
}

const SOURCES = [
  { value: 'direct',  label: 'Direct / vendor' },
  { value: 'agent',   label: 'Travel agent / GDS' },
  { value: 'ota',     label: 'OTA' },
  { value: 'other',   label: 'Other' },
];

function inr(n: number | undefined | null): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function summaryFor(parsed: ParsedItemRate, itemType: string): string {
  const parts: string[] = [];
  if (parsed.total_inr) parts.push(inr(parsed.total_inr));
  if (itemType === 'flight') {
    if (parsed.fare_class) parts.push(parsed.fare_class === 'refundable' ? 'Refundable' : 'Non-refundable');
    if (parsed.cabin_class) parts.push(parsed.cabin_class);
  } else if (itemType === 'transfer') {
    if (parsed.mode) parts.push(parsed.mode);
  } else {
    if (parsed.option_name) parts.push(parsed.option_name);
  }
  if (parsed.cancellation_free && parsed.cancellation_deadline) parts.push(`Free cancel ${parsed.cancellation_deadline}`);
  return parts.join(' · ');
}

export function ItemRateCard({ rate, index, itemType, onRemove, onParse, onSourceChange, onSelectProposal, onExpiryChange }: ItemRateCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [localText, setLocalText] = useState(rate.rawText ?? '');
  const [parsing, setParsing] = useState(false);
  const [showExpiryInput, setShowExpiryInput] = useState(false);

  const parsed: ParsedItemRate | null = rate.parsedData ? (() => { try { return JSON.parse(rate.parsedData!); } catch { return null; } })() : null;
  const proposals: ParsedItemRate[] = rate.proposals ? (() => { try { return JSON.parse(rate.proposals!); } catch { return []; } })() : [];
  const effectiveStatus = parsing ? 'parsing' : rate.status;

  const isStale = (() => {
    if (effectiveStatus !== 'done' || !parsed || !rate.updatedAt) return false;
    const parsedMs = new Date(rate.updatedAt).getTime();
    if (isNaN(parsedMs)) return false;
    return Date.now() - parsedMs > 7 * 24 * 60 * 60 * 1000;
  })();

  const expiryInfo = (() => {
    if (!rate.expiresAt) return null;
    const msLeft = new Date(rate.expiresAt + 'T23:59:59').getTime() - Date.now();
    const hoursLeft = msLeft / 3600000;
    if (msLeft < 0) return { label: 'Expired', color: '#8B2F2F', bg: 'rgba(139,47,47,0.1)', border: 'rgba(139,47,47,0.25)' };
    if (hoursLeft < 24) return { label: `${Math.ceil(hoursLeft)}h left`, color: '#8B2F2F', bg: 'rgba(139,47,47,0.08)', border: 'rgba(139,47,47,0.2)' };
    if (hoursLeft < 48) return { label: 'Exp. tomorrow', color: '#b45309', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)' };
    const daysLeft = Math.ceil(msLeft / 86400000);
    return { label: `Exp. ${daysLeft}d`, color: '#166534', bg: 'rgba(22,101,52,0.07)', border: 'rgba(22,101,52,0.2)' };
  })();

  async function handleParse() {
    if (!localText.trim() || parsing) return;
    setParsing(true);
    try { await onParse(rate.id, localText); } finally { setParsing(false); }
  }

  const summary = parsed ? summaryFor(parsed, itemType) : null;

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
          value={rate.source ?? 'other'}
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

        {/* Stale rate warning */}
        {isStale && (
          <span
            className="font-mono text-[9px] font-medium px-[5px] py-px rounded-sm flex-shrink-0 mr-0.5"
            title="Rate was parsed more than 7 days ago — verify pricing is still current"
            style={{ background: 'rgba(217,119,6,0.1)', color: '#b45309', border: '1px solid rgba(217,119,6,0.25)' }}
          >
            Stale
          </span>
        )}

        {/* Expiry badge / date input */}
        {showExpiryInput ? (
          <input
            type="date"
            autoFocus
            defaultValue={rate.expiresAt ?? ''}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); }}
            onBlur={e => {
              e.stopPropagation();
              const val = e.target.value || null;
              onExpiryChange?.(rate.id, val);
              setShowExpiryInput(false);
            }}
            className="font-mono text-[10px] border border-glacier rounded-sm px-1.5 py-px outline-none flex-shrink-0"
            style={{ background: '#F6F4EE', color: '#161A17', minWidth: 110 }}
          />
        ) : expiryInfo ? (
          <button
            onClick={e => { e.stopPropagation(); setShowExpiryInput(true); }}
            className="font-mono text-[9px] font-medium px-[5px] py-px rounded-sm flex-shrink-0 cursor-pointer"
            title="Click to change expiry date"
            style={{ background: expiryInfo.bg, color: expiryInfo.color, border: `1px solid ${expiryInfo.border}` }}
          >
            {expiryInfo.label}
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setShowExpiryInput(true); }}
            className="font-mono text-[9px] px-[5px] py-px rounded-sm flex-shrink-0 cursor-pointer opacity-0 group-hover/rate:opacity-60 hover:!opacity-100 transition-opacity"
            style={{ background: 'transparent', color: '#8A9189', border: '1px dashed #C9D2CC' }}
            title="Set rate expiry date"
          >
            + Expiry
          </button>
        )}

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
          {effectiveStatus === 'parsing' && (
            <div className="flex items-center gap-3 px-4 py-4 text-ink-mute text-[13px] font-sans">
              <Loader2 size={16} className="spin text-brass" />
              Parsing rate…
            </div>
          )}

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
                placeholder="Paste the fare/quote confirmation text here…"
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

          {effectiveStatus === 'done' && parsed && <DoneState parsed={parsed} itemType={itemType} />}

          {effectiveStatus === 'done' && isStale && (
            <div className="mx-2.5 mb-2.5 px-2.5 py-1.5 rounded-sm flex items-center gap-1.5 text-[10px] font-sans" style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', color: '#92400e' }}>
              <span>⚠</span>
              <span>Rate parsed {Math.floor((Date.now() - new Date(rate.updatedAt!).getTime()) / 86400000)} days ago — confirm pricing is still current</span>
            </div>
          )}

          {effectiveStatus === 'proposals' && proposals.length > 0 && (
            <ProposalsState
              proposals={proposals}
              itemType={itemType}
              onSelect={p => onSelectProposal(rate.id, p)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Done state (type-aware) ────────────────────────────────────────────── */
function DoneState({ parsed, itemType }: { parsed: ParsedItemRate; itemType: string }) {
  return (
    <div className="px-2.5 pb-3">
      <TypeIdentity parsed={parsed} itemType={itemType} />

      {parsed.date_mismatch && (
        <div
          className="flex items-start gap-1.5 text-[11px] px-2.5 py-2 rounded-sm mb-2.5"
          style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}
        >
          <AlertCircle size={13} className="flex-shrink-0 mt-[1px]" />
          <span>{parsed.date_mismatch_note ?? 'This date doesn’t match the destination’s dates.'}</span>
        </div>
      )}

      {itemType === 'flight' && <FareBracketTable parsed={parsed} />}

      {/* Receipt */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(22,26,23,0.10)' }}>
        {parsed.taxes_inr != null && <ReceiptRow label="Taxes & fees" value={inr(parsed.taxes_inr)} />}
        {parsed.total_inr != null && (
          <>
            <div className="h-px my-1.5" style={{ background: 'rgba(22,26,23,0.09)' }} />
            <ReceiptRow label="Total" value={inr(parsed.total_inr)} total />
          </>
        )}
      </div>

      {parsed.cancellation_free && (
        <div className="flex items-center gap-[5px] mt-2 text-[11px] text-success">
          <span className="w-[5px] h-[5px] rounded-full bg-success flex-shrink-0" />
          Free cancellation{parsed.cancellation_deadline ? ` until ${parsed.cancellation_deadline}` : ''}
        </div>
      )}
      {!parsed.cancellation_free && parsed.cancellation_deadline && (
        <div className="mt-2 text-[11px] text-ink-mute">
          Cancellation deadline: {parsed.cancellation_deadline}
        </div>
      )}
      {parsed.cancellation_note && (
        <div className="mt-1 text-[10px] text-ink-mute italic">{parsed.cancellation_note}</div>
      )}

      {itemType === 'activity' && parsed.inclusions && parsed.inclusions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {parsed.inclusions.map((p, i) => (
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

      {itemType === 'activity' && parsed.payment_due_date && (
        <div className="mt-2 text-[11px] text-ink-mute">
          Payment due: {parsed.payment_due_date}
        </div>
      )}
    </div>
  );
}

function TypeIdentity({ parsed, itemType }: { parsed: ParsedItemRate; itemType: string }) {
  if (itemType === 'flight') {
    return (
      <div className="mb-2.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-display italic font-light text-[14px] text-ink tracking-[0.01em]">
            {parsed.airline ?? 'Flight'}{parsed.flight_number ? ` ${parsed.flight_number}` : ''}
          </span>
          {parsed.fare_class && (
            <span
              className="font-mono text-[9px] font-medium uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm"
              style={{
                background: parsed.fare_class === 'refundable' ? 'rgba(46,107,69,0.1)' : 'rgba(139,47,47,0.08)',
                color: parsed.fare_class === 'refundable' ? '#2E6B45' : '#8B2F2F',
              }}
            >
              {parsed.fare_class === 'refundable' ? 'Refundable' : 'Non-refundable'}
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-ink-soft flex items-center gap-[7px] flex-wrap">
          {(parsed.from || parsed.to) && <span>{parsed.from ?? '?'} → {parsed.to ?? '?'}</span>}
          {parsed.departure_datetime && <span>· {parsed.departure_datetime.replace('T', ' ')}</span>}
          {parsed.cabin_class && (
            <span className="inline-block bg-glacier text-ink-soft font-mono text-[9px] font-medium tracking-[0.07em] uppercase px-1.5 py-0.5 rounded-sm">
              {parsed.cabin_class}
            </span>
          )}
        </div>
        {(parsed.baggage_checked || parsed.baggage_cabin) && (
          <div className="font-mono text-[10px] text-ink-mute mt-1">
            Baggage: {[parsed.baggage_checked && `checked ${parsed.baggage_checked}`, parsed.baggage_cabin && `cabin ${parsed.baggage_cabin}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    );
  }

  if (itemType === 'transfer') {
    return (
      <div className="mb-2.5">
        <div className="font-display italic font-light text-[14px] text-ink mb-0.5 tracking-[0.01em]">
          {parsed.vehicle_or_class ?? parsed.mode ?? 'Transfer'}
        </div>
        <div className="font-mono text-[10px] text-ink-soft flex items-center gap-[7px] flex-wrap">
          {(parsed.pickup || parsed.dropoff) && <span>{parsed.pickup ?? '?'} → {parsed.dropoff ?? '?'}</span>}
          {parsed.transfer_datetime && <span>· {parsed.transfer_datetime.replace('T', ' ')}</span>}
          {parsed.operator && <span>· {parsed.operator}</span>}
        </div>
      </div>
    );
  }

  // activity / experience
  return (
    <div className="mb-2.5">
      <div className="font-display italic font-light text-[14px] text-ink mb-0.5 tracking-[0.01em]">
        {parsed.option_name ?? 'Activity option'}
      </div>
      <div className="font-mono text-[10px] text-ink-soft flex items-center gap-[7px] flex-wrap">
        {parsed.operator && <span>{parsed.operator}</span>}
        {parsed.activity_datetime && <span>· {parsed.activity_datetime.replace('T', ' ')}</span>}
        {parsed.duration && <span>· {parsed.duration}</span>}
      </div>
    </div>
  );
}

function FareBracketTable({ parsed }: { parsed: ParsedItemRate }) {
  const brackets: { label: string; fare?: number; count?: number }[] = [
    { label: 'Adult', fare: parsed.fare_adult_inr, count: parsed.adult_count },
    { label: 'Teen', fare: parsed.fare_teen_inr, count: parsed.teen_count },
    { label: 'Child', fare: parsed.fare_child_inr, count: parsed.child_count },
    { label: 'Infant', fare: parsed.fare_infant_inr, count: parsed.infant_count },
  ].filter(b => b.fare != null);

  if (brackets.length === 0) return null;

  return (
    <div className="mb-2.5">
      {brackets.map(b => (
        <div key={b.label} className="flex justify-between items-baseline py-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.09em] text-ink-mute">
            {b.label}{b.count ? ` × ${b.count}` : ''}
          </span>
          <span className="font-mono text-xs text-ink-soft">{inr(b.fare)}</span>
        </div>
      ))}
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

/* ─── Proposals state (type-aware) ───────────────────────────────────────── */
function ProposalsState({ proposals, itemType, onSelect }: { proposals: ParsedItemRate[]; itemType: string; onSelect: (p: ParsedItemRate) => void }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-ink-mute mb-3 font-sans">
        <strong className="text-ink-soft">Found {proposals.length} options.</strong> Pick one to use:
      </p>
      {proposals.map((p, i) => (
        <div key={i} className="border border-glacier rounded-md px-3.5 py-3 mb-2.5 bg-paper/60">
          <TypeIdentity parsed={p} itemType={itemType} />
          {p.date_mismatch && (
            <div
              className="flex items-start gap-1.5 text-[11px] px-2.5 py-2 rounded-sm mb-2"
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}
            >
              <AlertCircle size={12} className="flex-shrink-0 mt-[1px]" />
              <span>{p.date_mismatch_note ?? 'Dates don’t match the destination’s dates.'}</span>
            </div>
          )}
          {itemType === 'flight' && <FareBracketTable parsed={p} />}
          <div className="font-mono text-[15px] text-spruce mb-2.5">
            {inr(p.total_inr)}
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
