'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, X, Check } from 'lucide-react';

export interface SpecialRequest {
  id: string;
  type: 'dietary' | 'anniversary' | 'room' | 'mobility' | 'transport' | 'other';
  text: string;
  status: 'requested' | 'acknowledged' | 'reconfirmed' | 'delivered' | 'failed';
  transmittedAt: string | null;
  acknowledgedAt: string | null;
}

const REQUEST_TYPES = [
  { value: 'room', label: 'Room' },
  { value: 'dietary', label: 'Dietary' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
] as const;

const STATUS_CYCLE: SpecialRequest['status'][] = [
  'requested', 'acknowledged', 'reconfirmed', 'delivered', 'failed',
];

const STATUS_STYLE: Record<SpecialRequest['status'], { label: string; bg: string; color: string }> = {
  requested:    { label: 'Requested',    bg: 'rgba(22,26,23,0.06)',   color: '#4A514B' },
  acknowledged: { label: 'Acknowledged', bg: 'rgba(169,139,82,0.12)', color: '#A98B52' },
  reconfirmed:  { label: 'Reconfirmed',  bg: 'rgba(30,58,47,0.1)',    color: '#1E3A2F' },
  delivered:    { label: 'Delivered',    bg: 'rgba(34,134,58,0.1)',   color: '#22863a' },
  failed:       { label: 'Failed',       bg: 'rgba(220,38,38,0.1)',   color: '#dc2626' },
};

function parseRequests(raw: string | null | undefined): SpecialRequest[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as SpecialRequest[]; } catch { return []; }
}

interface SpecialRequestsPanelProps {
  itemId: number;
  initialRequests: string | null;
  onChange: (itemId: number, json: string) => void;
}

export function SpecialRequestsPanel({ itemId, initialRequests, onChange }: SpecialRequestsPanelProps) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<SpecialRequest[]>(() => parseRequests(initialRequests));
  const [addingNew, setAddingNew] = useState(false);
  const [newType, setNewType] = useState<SpecialRequest['type']>('room');
  const [newText, setNewText] = useState('');

  const save = useCallback((updated: SpecialRequest[]) => {
    const json = JSON.stringify(updated);
    onChange(itemId, json);
    fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialRequests: json }),
    }).catch(() => {});
  }, [itemId, onChange]);

  function addRequest() {
    const text = newText.trim();
    if (!text) return;
    const req: SpecialRequest = {
      id: String(Date.now()),
      type: newType,
      text,
      status: 'requested',
      transmittedAt: null,
      acknowledgedAt: null,
    };
    const updated = [...requests, req];
    setRequests(updated);
    save(updated);
    setNewText('');
    setAddingNew(false);
  }

  function cycleStatus(id: string) {
    const updated = requests.map(r => {
      if (r.id !== id) return r;
      const idx = STATUS_CYCLE.indexOf(r.status);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return { ...r, status: next };
    });
    setRequests(updated);
    save(updated);
  }

  function removeRequest(id: string) {
    const updated = requests.filter(r => r.id !== id);
    setRequests(updated);
    save(updated);
  }

  const pendingCount = requests.filter(r => r.status === 'requested').length;

  return (
    <div style={{ borderTop: '1px solid rgba(22,26,23,0.07)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-[6px] w-full px-[11px] py-[8px] pl-[40px] text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {open
          ? <ChevronDown size={11} style={{ color: '#8A9189', flexShrink: 0 }} />
          : <ChevronRight size={11} style={{ color: '#8A9189', flexShrink: 0 }} />
        }
        <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#8A9189' }}>
          Special requests
        </span>
        {requests.length > 0 && (
          <span className="font-mono text-[9px]" style={{ color: '#8A9189' }}>
            ({requests.length})
          </span>
        )}
        {pendingCount > 0 && (
          <span
            className="w-[5px] h-[5px] rounded-full flex-shrink-0"
            style={{ background: '#A98B52' }}
            title={`${pendingCount} pending`}
          />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="px-[11px] pb-[12px] pl-[40px]">

          {/* Request list */}
          {requests.length > 0 && (
            <div className="flex flex-col gap-[5px] mb-[8px]">
              {requests.map(req => {
                const ss = STATUS_STYLE[req.status];
                const typeInfo = REQUEST_TYPES.find(t => t.value === req.type);
                return (
                  <div key={req.id} className="flex items-start gap-[6px] group/req">
                    {/* Type chip */}
                    <span
                      className="font-mono text-[8px] uppercase tracking-[0.07em] px-[5px] py-[2px] rounded-[2px] flex-shrink-0"
                      style={{
                        background: 'rgba(30,58,47,0.07)',
                        color: '#4A514B',
                        marginTop: 1,
                      }}
                    >
                      {typeInfo?.label ?? req.type}
                    </span>

                    {/* Text */}
                    <span
                      className="font-sans text-[11px] flex-1 leading-[1.5]"
                      style={{ color: '#4A514B' }}
                    >
                      {req.text}
                    </span>

                    {/* Status badge (click to cycle) */}
                    <button
                      onClick={() => cycleStatus(req.id)}
                      className="font-mono text-[8px] uppercase tracking-[0.07em] px-[5px] py-[2px] rounded-[2px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-70"
                      style={{ background: ss.bg, color: ss.color, border: 'none', marginTop: 1 }}
                      title="Click to advance status"
                    >
                      {ss.label}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeRequest(req.id)}
                      className="flex-shrink-0 opacity-0 group-hover/req:opacity-100 transition-opacity hover:opacity-70 cursor-pointer"
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        color: '#8A9189', marginTop: 2,
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new row */}
          {addingNew ? (
            <div className="flex items-center gap-[6px]">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as SpecialRequest['type'])}
                className="font-mono text-[9px] uppercase text-ink-soft bg-transparent outline-none cursor-pointer"
                style={{ borderBottom: '1px solid #C9D2CC', paddingBottom: 2 }}
              >
                {REQUEST_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <input
                type="text"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addRequest();
                  if (e.key === 'Escape') { setAddingNew(false); setNewText(''); }
                }}
                autoFocus
                placeholder="Describe the request…"
                className="flex-1 font-sans text-[11px] text-ink bg-transparent outline-none placeholder:text-ink-mute placeholder:italic"
                style={{ borderBottom: '1px solid #A98B52', paddingBottom: 2 }}
              />

              <button
                onClick={addRequest}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#A98B52' }}
                className="hover:opacity-70 transition-opacity flex-shrink-0"
              >
                <Check size={12} />
              </button>

              <button
                onClick={() => { setAddingNew(false); setNewText(''); }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#8A9189' }}
                className="hover:opacity-70 transition-opacity flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-[4px] font-sans text-[10px] transition-colors"
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', color: '#8A9189',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#A98B52')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8A9189')}
            >
              <Plus size={10} />
              Add request
            </button>
          )}
        </div>
      )}
    </div>
  );
}
