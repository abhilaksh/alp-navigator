'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageCircle, Eye, Loader2 } from 'lucide-react';

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
}

export function Topbar({
  label, onLabelChange,
  clientName, adults,
  status, onStatusChange,
  saveStatus,
  onWhatsApp, onPreview,
  totalFromInr,
}: TopbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const metaParts = [clientName, `${adults} adult${adults !== 1 ? 's' : ''}`]
    .filter(Boolean).join(' · ');

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
          style={{
            borderBottom: '1px solid transparent',
            transition: 'border-color 0.14s ease',
          }}
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

      {/* Total */}
      {totalFromInr != null && (
        <div
          className="px-4 flex flex-col justify-center gap-px flex-shrink-0"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.09)' }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'rgba(201,162,106,0.6)' }}>
            Trip from
          </span>
          <span className="font-mono text-sm font-medium" style={{ color: 'rgba(201,162,106,0.92)' }}>
            ₹{totalFromInr.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-[7px] px-3.5 flex-shrink-0">
        {/* Save status */}
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
