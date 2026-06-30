'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageCircle, Eye, Loader2, DollarSign, X } from 'lucide-react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
export type WorkflowStatus = 'draft' | 'sent' | 'accepted' | 'booked';

const WORKFLOW_META: Record<WorkflowStatus, { label: string; dot: string }> = {
  draft:    { label: 'Draft',    dot: 'bg-ink-mute' },
  sent:     { label: 'Sent',     dot: 'bg-brass' },
  accepted: { label: 'Accepted', dot: 'bg-success' },
  booked:   { label: 'Booked',   dot: 'bg-spruce' },
};

interface TopbarProps {
  label: string;
  onLabelChange: (v: string) => void;
  clientName: string | null;
  adults: number;
  status: WorkflowStatus;
  onStatusChange: (s: WorkflowStatus) => void;
  saveStatus: SaveStatus;
  onWhatsApp: () => void;
  onPreview: () => void;
  totalFromInr?: number | null;
  isFromPrice?: boolean;
  fxDate?: string | null;
  fxSource?: string | null;
  fxBufferPct?: number | null;
  fxUsdToInr?: number | null;
  onFxSave?: (fx: { fxDate: string; fxSource: string; fxBufferPct: number; fxUsdToInr: number } | null) => void;
  firstViewedAt?: number | null;
  viewCount?: number | null;
}

export function Topbar({
  label, onLabelChange,
  clientName, adults,
  status, onStatusChange,
  saveStatus,
  onWhatsApp, onPreview,
  totalFromInr,
  isFromPrice = true,
  fxDate, fxSource, fxBufferPct, fxUsdToInr, onFxSave,
  firstViewedAt, viewCount,
}: TopbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFxPanel, setShowFxPanel] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [fxForm, setFxForm] = useState({
    fxDate: fxDate ?? today,
    fxSource: fxSource ?? 'RBI',
    fxBufferPct: fxBufferPct != null ? String(fxBufferPct) : '2.5',
    fxUsdToInr: fxUsdToInr != null ? String(fxUsdToInr) : '',
  });
  const fxLocked = fxUsdToInr != null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (fxRef.current && !fxRef.current.contains(e.target as Node)) setShowFxPanel(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const metaParts = [clientName, `${adults} adult${adults !== 1 ? 's' : ''}`]
    .filter(Boolean).join(' · ');

  function handleFxSave() {
    if (!onFxSave) return;
    const rate = parseFloat(fxForm.fxUsdToInr);
    const buf = parseFloat(fxForm.fxBufferPct);
    if (!rate || isNaN(rate)) return;
    onFxSave({ fxDate: fxForm.fxDate, fxSource: fxForm.fxSource, fxBufferPct: isNaN(buf) ? 2.5 : buf, fxUsdToInr: rate });
    setShowFxPanel(false);
  }

  function handleFxClear() {
    if (!onFxSave) return;
    onFxSave(null);
    setShowFxPanel(false);
  }

  return (
    <header
      className="h-[52px] flex items-center flex-shrink-0 relative z-[100]"
      style={{ background: '#1E3A2F' }}
    >
      {/* Monogram */}
      <div
        className="w-[52px] h-[52px] flex items-center justify-center font-display italic font-light text-[18px] flex-shrink-0"
        style={{ color: 'rgba(255,255,255,0.88)', borderRight: '1px solid rgba(255,255,255,0.09)' }}
      >
        alp
      </div>

      {/* Trip title + meta */}
      <div className="flex-1 px-5 flex flex-col justify-center gap-px min-w-0">
        <input
          type="text"
          value={label}
          onChange={e => onLabelChange(e.target.value)}
          className="font-display text-base font-normal text-white bg-transparent border-none border-b border-b-transparent outline-none p-0 w-full tracking-tight"
          style={{ borderBottom: '1px solid transparent', transition: 'border-color 0.14s ease' }}
          onMouseEnter={e => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
          onFocus={e => (e.currentTarget.style.borderBottomColor = 'rgba(169,139,82,0.7)')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
          placeholder="Trip title…"
        />
        <div
          className="text-[11px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: 'rgba(255,255,255,0.46)' }}
        >
          {metaParts}
        </div>
      </div>

      {/* FX rate lock */}
      {onFxSave && (
        <div className="relative flex-shrink-0" ref={fxRef}>
          <button
            onClick={() => setShowFxPanel(v => !v)}
            className="h-[52px] px-3.5 flex flex-col justify-center gap-px text-left transition-colors"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.09)', minWidth: 64 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Lock exchange rate"
          >
            <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'rgba(201,162,106,0.6)' }}>
              <DollarSign size={9} />FX
            </span>
            <span className="font-mono text-[12px]" style={{ color: fxLocked ? 'rgba(201,162,106,0.92)' : 'rgba(255,255,255,0.28)' }}>
              {fxLocked ? `₹${fxUsdToInr!.toFixed(0)}` : '—'}
            </span>
          </button>

          {showFxPanel && (
            <div
              className="absolute top-full right-0 mt-1 rounded-[4px] p-4 z-[200]"
              style={{ background: '#F6F4EE', border: '1px solid #C9D2CC', boxShadow: '0 4px 20px rgba(0,0,0,0.13)', width: 280 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-[13px] font-semibold text-ink">Lock exchange rate</span>
                <button onClick={() => setShowFxPanel(false)} className="text-ink-mute hover:text-ink transition-colors"><X size={13} /></button>
              </div>
              <p className="text-[11px] text-ink-soft font-sans mb-3 leading-[1.5]">
                Documents the USD→INR rate used when building this quote.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-1">Date locked</label>
                  <input type="date" value={fxForm.fxDate}
                    onChange={e => setFxForm(p => ({ ...p, fxDate: e.target.value }))}
                    className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] font-mono text-ink bg-white outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')} />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-1">Source</label>
                  <select value={fxForm.fxSource}
                    onChange={e => setFxForm(p => ({ ...p, fxSource: e.target.value }))}
                    className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] font-sans text-ink bg-white outline-none cursor-pointer">
                    <option>RBI</option><option>Wise</option><option>XE</option><option>manual</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-1">USD → INR</label>
                  <input type="number" placeholder="84.50" value={fxForm.fxUsdToInr}
                    onChange={e => setFxForm(p => ({ ...p, fxUsdToInr: e.target.value }))}
                    className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] font-mono text-ink bg-white outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')} />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-1">Buffer %</label>
                  <input type="number" step="0.5" placeholder="2.5" value={fxForm.fxBufferPct}
                    onChange={e => setFxForm(p => ({ ...p, fxBufferPct: e.target.value }))}
                    className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] font-mono text-ink bg-white outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleFxSave}
                  className="flex-1 py-[6px] bg-spruce text-white text-[11px] font-medium font-sans rounded-sm cursor-pointer hover:opacity-90 transition-opacity">
                  Lock rate
                </button>
                {fxLocked && (
                  <button onClick={handleFxClear}
                    className="px-3 py-[6px] text-ink-mute border border-glacier text-[11px] font-sans rounded-sm cursor-pointer hover:text-danger hover:border-danger transition-colors"
                    style={{ background: 'transparent' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      {totalFromInr != null && (
        <div
          className="px-4 flex flex-col justify-center gap-px flex-shrink-0"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.09)' }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'rgba(201,162,106,0.6)' }}>
            {isFromPrice ? 'Trip from' : 'Trip total'}
          </span>
          <span className="font-mono text-sm font-medium" style={{ color: 'rgba(201,162,106,0.92)' }}>
            ₹{totalFromInr.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-[7px] px-3.5 flex-shrink-0">
        {firstViewedAt && (
          <ViewBadge firstViewedAt={firstViewedAt} viewCount={viewCount ?? 0} />
        )}
        <SaveIndicator status={saveStatus} />

        {/* Workflow pill */}
        <div className="relative" ref={pillRef}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="inline-flex items-center gap-[5px] px-[10px] py-1 rounded-full text-[11px] font-medium tracking-[0.06em] uppercase cursor-pointer transition-colors"
            style={{
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.75)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          >
            <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${WORKFLOW_META[status].dot}`} />
            {WORKFLOW_META[status].label}
            <ChevronDown size={10} />
          </button>

          {showDropdown && (
            <div
              className="absolute top-full right-0 mt-1 bg-paper border border-glacier rounded overflow-hidden min-w-[160px] z-[200]"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
            >
              {(Object.keys(WORKFLOW_META) as WorkflowStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setShowDropdown(false); }}
                  className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-ink hover:bg-paper-deep transition-colors text-left ${
                    s === status ? 'text-brass font-semibold' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${WORKFLOW_META[s].dot}`} />
                  {WORKFLOW_META[s].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* WA */}
        <button
          onClick={onWhatsApp}
          className="inline-flex items-center gap-[5px] px-3 py-[6px] rounded-sm text-xs font-medium transition-colors"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >
          <MessageCircle size={13} />
          WA
        </button>

        {/* Preview */}
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-[5px] px-3 py-[6px] bg-brass hover:bg-brass-light text-white rounded-sm text-xs font-medium transition-colors"
        >
          <Eye size={13} />
          Preview
        </button>
      </div>
    </header>
  );
}

function ViewBadge({ firstViewedAt, viewCount }: { firstViewedAt: number; viewCount: number }) {
  const ms = Date.now() - firstViewedAt;
  const mins   = Math.floor(ms / 60000);
  const hours  = Math.floor(ms / 3600000);
  const days   = Math.floor(ms / 86400000);
  const ago = days >= 1
    ? `${days}d ago`
    : hours >= 1
      ? `${hours}h ago`
      : mins >= 1
        ? `${mins}m ago`
        : 'just now';

  return (
    <div
      className="flex items-center gap-[5px] font-mono text-[9px] px-[7px] py-[3px] rounded-[3px]"
      style={{ background: 'rgba(169,139,82,0.15)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.25)' }}
      title={`First viewed ${new Date(firstViewedAt).toLocaleString('en-IN')} · ${viewCount} total view${viewCount !== 1 ? 's' : ''}`}
    >
      <Eye size={9} />
      <span>Client viewed {ago}</span>
      {viewCount > 1 && <span className="opacity-60">· {viewCount}×</span>}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(201,210,204,0.75)' }}>
        <Loader2 size={12} className="spin" />
        Saving…
      </div>
    );
  }
  const configs: Record<SaveStatus, { dot: string; color: string; label: string }> = {
    saved:   { dot: 'save-dot-saved',   color: '#2E6B45', label: 'Saved' },
    unsaved: { dot: 'save-dot-unsaved', color: '#A98B52', label: 'Unsaved' },
    saving:  { dot: 'save-dot-saving',  color: '#8A9189', label: 'Saving…' },
    error:   { dot: 'save-dot-error',   color: '#8B2F2F', label: 'Save failed' },
  };
  const cfg = configs[status];
  return (
    <div className="flex items-center gap-1.5 text-xs font-sans" style={{ color: cfg.color }}>
      <span className={`w-[7px] h-[7px] rounded-full inline-block flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
}
