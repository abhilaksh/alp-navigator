'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface Snapshot {
  id: number;
  version: number;
  label: string | null;
  createdAt: string | Date;
}

interface EngagementPanelProps {
  tripId: number;
  tripLabel: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  firstViewedAt: number | null;
  viewCount: number;
  clientAcceptedAt: number | null;
  previewKey: string | null;
  clientName: string | null;
  clientWa: string | null;
}

function daysAgo(ts: number | string | Date): string {
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - ms) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff} days ago`;
}

function fmtTs(ts: number | string | Date): string {
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function EngagementPanel({
  tripId, tripLabel, status,
  createdAt, updatedAt,
  firstViewedAt, viewCount,
  clientAcceptedAt, previewKey,
  clientName, clientWa,
}: EngagementPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savingSnap, setSavingSnap] = useState(false);
  const [snapLabel, setSnapLabel] = useState('');
  const [showSnapForm, setShowSnapForm] = useState(false);

  const previewUrl = previewKey
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://navigator.alptravel.co'}/preview/${previewKey}`
    : null;

  useEffect(() => {
    fetch(`/api/trips/${tripId}/snapshots`)
      .then(r => r.json())
      .then((data: Snapshot[]) => setSnapshots(Array.isArray(data) ? data : []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [tripId]);

  function copyPreview() {
    if (!previewUrl) return;
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function saveSnapshot() {
    setSavingSnap(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: snapLabel.trim() || undefined }),
      });
      if (res.ok) {
        const snap = await res.json() as { id: number; version: number };
        setSnapshots(prev => [{
          id: snap.id,
          version: snap.version,
          label: snapLabel.trim() || `Version ${snap.version}`,
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setSnapLabel('');
        setShowSnapForm(false);
      }
    } finally {
      setSavingSnap(false);
    }
  }

  // Build timeline events
  type Event = { label: string; date: number | string | Date; tag?: string; urgent?: boolean };
  const events: Event[] = [
    { label: 'Proposal created', date: createdAt },
  ];
  if (status === 'sent' || status === 'accepted' || status === 'booked') {
    events.push({ label: 'Sent to client', date: updatedAt, tag: 'sent' });
  }
  if (firstViewedAt) {
    events.push({ label: 'Client first viewed', date: firstViewedAt, tag: 'viewed' });
  }
  if (clientAcceptedAt) {
    events.push({ label: 'Client confirmed interest', date: clientAcceptedAt, tag: 'accepted' });
  }
  if (status === 'booked') {
    events.push({ label: 'Booked', date: updatedAt, tag: 'booked' });
  }

  const noViews = status === 'sent' && !firstViewedAt;
  const daysSinceSent = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#F6F4EE' }}>
      <div className="p-5 space-y-8 max-w-lg">

        {/* Preview link */}
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#8A9189' }}>
            Preview link
          </p>
          {previewUrl ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[4px]"
              style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.08)' }}
            >
              <span className="flex-1 text-[11px] truncate font-mono" style={{ color: '#4A514B' }}>
                {previewUrl}
              </span>
              <button
                onClick={copyPreview}
                className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70"
                title="Copy link"
              >
                {copied
                  ? <Check size={13} style={{ color: '#2E6B45' }} />
                  : <Copy size={13} style={{ color: '#8A9189' }} />
                }
              </button>
              <a
                href={previewUrl}
                target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70"
                title="Open preview"
              >
                <ExternalLink size={13} style={{ color: '#8A9189' }} />
              </a>
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: '#8A9189' }}>
              No preview link yet. Generate one from the status bar below.
            </p>
          )}
        </section>

        {/* Engagement metrics */}
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#8A9189' }}>
            Client engagement
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div
              className="px-4 py-3 rounded-[4px]"
              style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.06)' }}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-1" style={{ color: '#8A9189' }}>Views</p>
              <p className="font-mono text-[22px]" style={{ color: viewCount > 0 ? '#1E3A2F' : '#8A9189' }}>
                {viewCount}
              </p>
            </div>
            <div
              className="px-4 py-3 rounded-[4px]"
              style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.06)' }}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-1" style={{ color: '#8A9189' }}>First view</p>
              <p className="text-[12px]" style={{ color: firstViewedAt ? '#161A17' : '#8A9189' }}>
                {firstViewedAt ? daysAgo(firstViewedAt) : '—'}
              </p>
              {firstViewedAt && (
                <p className="text-[10px] mt-0.5" style={{ color: '#8A9189' }}>{fmtTs(firstViewedAt)}</p>
              )}
            </div>
          </div>

          {/* Follow-up nudge */}
          {noViews && daysSinceSent >= 3 && (
            <div
              className="mt-3 px-4 py-3 rounded-[4px]"
              style={{ background: 'rgba(169,139,82,0.07)', border: '1px solid rgba(169,139,82,0.18)' }}
            >
              <p className="text-[12px] font-medium mb-1" style={{ color: '#7a5e2e' }}>
                No views after {daysSinceSent} days
              </p>
              <p className="text-[11px] mb-2" style={{ color: '#8A9189' }}>
                A gentle nudge usually helps.
              </p>
              {clientWa && (
                <a
                  href={`https://wa.me/${clientWa.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${clientName?.split(' ')[0] ?? 'there'}, just checking in — did you get a chance to look at your travel proposal for ${tripLabel}? Happy to walk you through it.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] font-medium"
                  style={{ color: '#A98B52' }}
                >
                  Send WA reminder →
                </a>
              )}
            </div>
          )}

          {clientAcceptedAt && (
            <div
              className="mt-3 px-4 py-3 rounded-[4px]"
              style={{ background: 'rgba(30,58,47,0.06)', border: '1px solid rgba(30,58,47,0.12)' }}
            >
              <p className="text-[12px] font-medium" style={{ color: '#1E3A2F' }}>
                Client confirmed interest
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#8A9189' }}>
                {fmtTs(clientAcceptedAt)} · {daysAgo(clientAcceptedAt)}
              </p>
            </div>
          )}
        </section>

        {/* Timeline */}
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#8A9189' }}>
            Timeline
          </p>
          <div className="relative">
            <div
              className="absolute left-[7px] top-2 bottom-2 w-px"
              style={{ background: 'rgba(22,26,23,0.1)' }}
            />
            <div className="space-y-4">
              {events.map((ev, i) => {
                const isLast = i === events.length - 1;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 mt-0.5 rounded-full z-[1]"
                      style={{
                        width: 15, height: 15,
                        background: isLast ? '#1E3A2F' : '#EDEAE1',
                        border: `2px solid ${isLast ? '#1E3A2F' : 'rgba(22,26,23,0.2)'}`,
                      }}
                    />
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: '#161A17' }}>{ev.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8A9189' }}>
                        {fmtTs(ev.date)} · {daysAgo(ev.date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Version history */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#8A9189' }}>
              Version history
            </p>
            <button
              onClick={() => setShowSnapForm(v => !v)}
              className="text-[11px] transition-colors"
              style={{ color: '#A98B52' }}
            >
              + Save snapshot
            </button>
          </div>

          {showSnapForm && (
            <div
              className="mb-3 p-3 rounded-[4px]"
              style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.08)' }}
            >
              <input
                value={snapLabel}
                onChange={e => setSnapLabel(e.target.value)}
                placeholder="Label (optional — e.g. 'Before hotel swap')"
                className="w-full text-[12px] px-2 py-1.5 rounded-[3px] outline-none"
                style={{ background: '#F6F4EE', border: '1px solid rgba(22,26,23,0.12)', color: '#161A17' }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveSnapshot}
                  disabled={savingSnap}
                  className="text-[11px] px-3 py-1.5 rounded-[3px] text-white disabled:opacity-60"
                  style={{ background: '#1E3A2F' }}
                >
                  {savingSnap ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSnapForm(false)}
                  className="text-[11px]"
                  style={{ color: '#8A9189' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-[11px]" style={{ color: '#8A9189' }}>Loading…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#8A9189' }}>
              No snapshots yet. Snapshots are saved automatically when you send a proposal.
            </p>
          ) : (
            <div className="space-y-1">
              {snapshots.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-[4px]"
                  style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.06)' }}
                >
                  <div>
                    <p className="text-[12px]" style={{ color: '#161A17' }}>
                      {s.label ?? `Version ${s.version}`}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#8A9189' }}>
                      {fmtTs(s.createdAt)}
                    </p>
                  </div>
                  <span
                    className="font-mono text-[10px] px-2 py-0.5 rounded-[3px]"
                    style={{ background: 'rgba(22,26,23,0.06)', color: '#8A9189' }}
                  >
                    v{s.version}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
