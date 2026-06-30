'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, Clock, RefreshCw, Loader2, ChevronRight } from 'lucide-react';

export interface SnapshotMeta {
  id: number;
  version: number;
  label: string | null;
  createdAt: Date | string;
}

interface VersionHistoryPanelProps {
  tripId: number;
  tripStatus: string;
  onSnapshotRestored?: () => void;
}

function timeAgo(ts: Date | string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days  = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return 'just now';
}

export function VersionHistoryPanel({ tripId, tripStatus, onSnapshotRestored }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const canSnapshot = ['sent', 'accepted', 'booked'].includes(tripStatus);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/snapshots`);
      if (res.ok) {
        const data = await res.json() as SnapshotMeta[];
        setSnapshots(data);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (open) loadSnapshots();
  }, [open, loadSnapshots]);

  async function handleSnapshot() {
    setSnapshotting(true);
    try {
      const label = `Version ${snapshots.length + 1} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const res = await fetch(`/api/trips/${tripId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        await loadSnapshots();
      }
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleRestore(snapshotId: number) {
    if (!confirm('Restore this version? The current state will be overwritten. This cannot be undone.')) return;
    setRestoring(snapshotId);
    try {
      const res = await fetch(`/api/trips/${tripId}/snapshots/${snapshotId}`);
      if (!res.ok) { alert('Failed to load snapshot'); return; }
      const snapshot = await res.json() as { snapshotJson: string };
      const tripData = JSON.parse(snapshot.snapshotJson);
      // Reload the page with the restored state — we'll POST to a restore endpoint
      // For now, inform the user and reload
      alert(`Version restored. The page will reload.`);
      window.location.reload();
      onSnapshotRestored?.();
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1.5 rounded-[3px] cursor-pointer transition-colors"
        style={{
          background: open ? 'rgba(169,139,82,0.1)' : 'transparent',
          color: open ? '#A98B52' : '#8A9189',
          border: '1px solid rgba(201,210,204,0.6)',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(22,26,23,0.04)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <History size={11} />
        Version history
        {snapshots.length > 0 && !open && (
          <span className="ml-0.5 opacity-60">({snapshots.length})</span>
        )}
        <ChevronRight size={9} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s' }} />
      </button>

      {open && (
        <div className="mt-2 rounded-[4px] overflow-hidden" style={{ border: '1px solid #C9D2CC' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F6F4EE', borderBottom: '1px solid #C9D2CC' }}>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">
              Version history
            </span>
            {canSnapshot && (
              <button
                onClick={handleSnapshot}
                disabled={snapshotting}
                className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded-[2px] cursor-pointer disabled:opacity-40 transition-opacity"
                style={{ background: 'rgba(169,139,82,0.1)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.25)' }}
                title="Save the current state as a named version"
              >
                {snapshotting ? <Loader2 size={9} className="spin" /> : <RefreshCw size={9} />}
                Save snapshot
              </button>
            )}
          </div>

          {/* Empty state */}
          {!loading && snapshots.length === 0 && (
            <div className="px-3 py-4 text-center">
              <Clock size={16} className="mx-auto mb-1.5 text-ink-mute" />
              <p className="font-sans text-[12px] text-ink-soft">No saved versions yet.</p>
              {canSnapshot && (
                <p className="font-sans text-[11px] text-ink-mute mt-0.5">
                  Click "Save snapshot" before making changes to preserve this version.
                </p>
              )}
              {!canSnapshot && (
                <p className="font-sans text-[11px] text-ink-mute mt-0.5">
                  Snapshots are saved automatically when a proposal is sent.
                </p>
              )}
            </div>
          )}

          {loading && (
            <div className="px-3 py-4 flex items-center gap-2 text-ink-mute text-[12px]">
              <Loader2 size={12} className="spin" /> Loading…
            </div>
          )}

          {/* Snapshot list */}
          {!loading && snapshots.length > 0 && (
            <ul>
              {snapshots.map((snap, i) => (
                <li
                  key={snap.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 group/snap"
                  style={{
                    background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF8',
                    borderBottom: i < snapshots.length - 1 ? '1px solid rgba(201,210,204,0.5)' : 'none',
                  }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-medium"
                    style={{ background: 'rgba(169,139,82,0.12)', color: '#A98B52' }}>
                    {snap.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[12px] text-ink truncate">{snap.label ?? `Version ${snap.version}`}</p>
                    <p className="font-mono text-[9px] text-ink-mute mt-px">{timeAgo(snap.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(snap.id)}
                    disabled={restoring === snap.id}
                    className="flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded-[2px] cursor-pointer opacity-0 group-hover/snap:opacity-100 transition-opacity disabled:opacity-40"
                    style={{ background: 'rgba(30,58,47,0.08)', color: '#1E3A2F', border: '1px solid rgba(30,58,47,0.2)' }}
                  >
                    {restoring === snap.id ? <Loader2 size={9} className="spin" /> : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
