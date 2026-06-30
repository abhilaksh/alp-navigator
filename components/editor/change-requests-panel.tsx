'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, CheckCircle2, MinusCircle, Trash2, ChevronDown } from 'lucide-react';

type ChangeRequestCategory = 'hotel_swap' | 'date_change' | 'activity_add' | 'budget_adjust' | 'other';
type ChangeRequestStatus = 'open' | 'implemented' | 'noted';

interface ChangeRequest {
  id: number;
  tripId: number;
  snapshotVersion: number | null;
  category: string;
  text: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const CATEGORIES: { value: ChangeRequestCategory; label: string; color: string }[] = [
  { value: 'hotel_swap',    label: 'Hotel swap',     color: '#A98B52' },
  { value: 'date_change',   label: 'Date change',    color: '#4A6FA5' },
  { value: 'activity_add',  label: 'Activity add',   color: '#2E6B45' },
  { value: 'budget_adjust', label: 'Budget adjust',  color: '#7B4FA5' },
  { value: 'other',         label: 'Other',          color: '#4A514B' },
];

function categoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[4];
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  tripId: number;
  openCount?: (n: number) => void;
}

export function ChangeRequestsPanel({ tripId, openCount }: Props) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<ChangeRequestCategory>('hotel_swap');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/change-requests`);
      if (res.ok) {
        const data = await res.json() as ChangeRequest[];
        setRequests(data);
        openCount?.(data.filter(r => r.status === 'open').length);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, openCount]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, text: newText.trim() }),
      });
      if (res.ok) {
        const created = await res.json() as ChangeRequest;
        setRequests(prev => [created, ...prev]);
        openCount?.(requests.filter(r => r.status === 'open').length + 1);
        setNewText('');
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: number, status: ChangeRequestStatus) {
    const res = await fetch(`/api/change-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json() as ChangeRequest;
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      openCount?.(requests.filter(r => r.id !== id && r.status === 'open').length + (status === 'open' ? 1 : 0));
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/change-requests/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const removed = requests.find(r => r.id === id);
      setRequests(prev => prev.filter(r => r.id !== id));
      if (removed?.status === 'open') {
        openCount?.(requests.filter(r => r.status === 'open' && r.id !== id).length);
      }
    }
  }

  const openReqs = requests.filter(r => r.status === 'open');
  const closedReqs = requests.filter(r => r.status !== 'open');

  return (
    <div style={{ padding: '28px 32px 80px', maxWidth: 640 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-display text-[20px] font-normal text-ink tracking-tight" style={{ letterSpacing: '-0.01em' }}>
            Client Revisions
          </h2>
          <p className="font-sans text-[11px] text-ink-mute mt-0.5">
            Log feedback from the client as they review the proposal.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-[6px] px-3 py-[7px] rounded-[4px] font-sans text-[12px] cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: '#1E3A2F', color: 'white', border: 'none' }}
          >
            <MessageSquarePlus size={13} />
            Log change
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div
          className="mb-5 rounded-[6px] p-4"
          style={{ background: 'white', border: '1px solid rgba(22,26,23,0.1)' }}
        >
          <p className="font-sans text-[11px] font-medium text-ink-mute uppercase tracking-[0.06em] mb-3">
            New revision request
          </p>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setNewCategory(cat.value)}
                className="px-2.5 py-1 rounded-[3px] font-mono text-[9px] uppercase tracking-[0.06em] cursor-pointer transition-all"
                style={{
                  background: newCategory === cat.value ? cat.color : 'rgba(22,26,23,0.04)',
                  color: newCategory === cat.value ? 'white' : cat.color,
                  border: `1px solid ${newCategory === cat.value ? cat.color : 'rgba(22,26,23,0.1)'}`,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="What did the client ask for? Be specific — this becomes your revision record."
            className="w-full font-sans text-[12px] leading-relaxed rounded-[4px] p-3 resize-none outline-none"
            style={{ border: '1px solid rgba(22,26,23,0.12)', color: '#161A17', minHeight: 80, background: '#F6F4EE' }}
            rows={3}
            autoFocus
          />

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={saving || !newText.trim()}
              className="px-3 py-[7px] rounded-[4px] font-sans text-[12px] font-medium cursor-pointer disabled:opacity-40 transition-opacity"
              style={{ background: '#A98B52', color: 'white', border: 'none' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewText(''); }}
              className="px-3 py-[7px] rounded-[4px] font-sans text-[12px] cursor-pointer"
              style={{ background: 'none', border: '1px solid rgba(22,26,23,0.12)', color: '#4A514B' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className="font-sans text-[12px] text-ink-mute">Loading…</p>
      )}

      {/* Open requests */}
      {!loading && openReqs.length === 0 && closedReqs.length === 0 && (
        <div className="py-10 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(169,139,82,0.08)' }}
          >
            <MessageSquarePlus size={18} style={{ color: '#A98B52' }} />
          </div>
          <p className="font-sans text-[13px] text-ink mb-1">No revision requests yet</p>
          <p className="font-sans text-[11px] text-ink-mute max-w-xs mx-auto leading-relaxed">
            When the client asks for changes, log them here to track what was addressed.
          </p>
        </div>
      )}

      {openReqs.length > 0 && (
        <div className="mb-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-3">
            Open · {openReqs.length}
          </p>
          <div className="flex flex-col gap-2">
            {openReqs.map(req => (
              <ChangeRequestCard
                key={req.id}
                req={req}
                onStatus={handleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {closedReqs.length > 0 && (
        <ClosedRequests reqs={closedReqs} onStatus={handleStatus} onDelete={handleDelete} />
      )}
    </div>
  );
}

function ChangeRequestCard({
  req,
  onStatus,
  onDelete,
}: {
  req: ChangeRequest;
  onStatus: (id: number, status: ChangeRequestStatus) => void;
  onDelete: (id: number) => void;
}) {
  const meta = categoryMeta(req.category);
  const isOpen = req.status === 'open';

  return (
    <div
      className="rounded-[6px] p-4"
      style={{
        background: 'white',
        border: `1px solid ${isOpen ? 'rgba(22,26,23,0.1)' : 'rgba(22,26,23,0.06)'}`,
        opacity: isOpen ? 1 : 0.65,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Category + date */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.06em] px-[6px] py-[2px] rounded-[3px]"
              style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
            >
              {meta.label}
            </span>
            <span className="font-mono text-[9px] text-ink-mute">
              {formatDate(req.createdAt)}
            </span>
            {req.status === 'implemented' && (
              <span className="font-mono text-[9px] px-[5px] py-[1px] rounded-[2px]" style={{ background: 'rgba(46,107,69,0.1)', color: '#2E6B45' }}>
                Implemented
              </span>
            )}
            {req.status === 'noted' && (
              <span className="font-mono text-[9px] px-[5px] py-[1px] rounded-[2px]" style={{ background: 'rgba(74,81,75,0.08)', color: '#4A514B' }}>
                Noted
              </span>
            )}
          </div>

          {/* Text */}
          <p className="font-sans text-[12px] leading-relaxed text-ink">{req.text}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isOpen && (
            <>
              <button
                onClick={() => onStatus(req.id, 'implemented')}
                title="Mark implemented"
                className="w-7 h-7 flex items-center justify-center rounded-[3px] cursor-pointer transition-colors hover:bg-[#2E6B45]/10"
                style={{ background: 'none', border: 'none' }}
              >
                <CheckCircle2 size={14} style={{ color: '#2E6B45' }} />
              </button>
              <button
                onClick={() => onStatus(req.id, 'noted')}
                title="Mark as noted (won't implement)"
                className="w-7 h-7 flex items-center justify-center rounded-[3px] cursor-pointer transition-colors hover:bg-[#4A514B]/10"
                style={{ background: 'none', border: 'none' }}
              >
                <MinusCircle size={14} style={{ color: '#8A9189' }} />
              </button>
            </>
          )}
          {!isOpen && (
            <button
              onClick={() => onStatus(req.id, 'open')}
              title="Re-open"
              className="w-7 h-7 flex items-center justify-center rounded-[3px] cursor-pointer transition-colors"
              style={{ background: 'none', border: 'none' }}
            >
              <span className="font-mono text-[8px] text-ink-mute">↩</span>
            </button>
          )}
          <button
            onClick={() => onDelete(req.id)}
            title="Delete"
            className="w-7 h-7 flex items-center justify-center rounded-[3px] cursor-pointer transition-colors hover:bg-red-50"
            style={{ background: 'none', border: 'none' }}
          >
            <Trash2 size={12} style={{ color: '#8A9189' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ClosedRequests({
  reqs,
  onStatus,
  onDelete,
}: {
  reqs: ChangeRequest[];
  onStatus: (id: number, status: ChangeRequestStatus) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-mute cursor-pointer mb-3"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        <ChevronDown size={10} style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
        Closed · {reqs.length}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {reqs.map(req => (
            <ChangeRequestCard key={req.id} req={req} onStatus={onStatus} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
