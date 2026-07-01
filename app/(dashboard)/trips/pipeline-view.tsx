'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { List, LayoutGrid, AlertTriangle, Clock, Copy, Archive, MapPin, Sparkles, X } from 'lucide-react';
import { ClientPicker, type ClientSelection } from '@/components/shared/client-picker';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface PipelineTrip {
  id: number;
  label: string;
  status: string;
  adults: number;
  clientId: number | null;
  clientName: string | null;
  totalFromInr: number | null;
  updatedAt: Date;
  createdAt: Date;
  destinationCount: number | null;
  minHoldExpiry: string | null;
  firstViewedAt: number | null;
}

export interface BlueprintTrip {
  id: number;
  label: string;
  updatedAt: Date;
  createdAt: Date;
  destinationCount: number | null;
  blueprintCountry: string | null;
  blueprintTags: string | null;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

const STATUSES = ['draft', 'sent', 'accepted', 'booked'] as const;
type Status = typeof STATUSES[number];

const STATUS_META: Record<Status, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:    { label: 'Draft',    color: '#4A514B', bg: 'rgba(22,26,23,0.06)',  border: 'rgba(22,26,23,0.12)', dot: '#9AA59B' },
  sent:     { label: 'Sent',     color: '#A98B52', bg: 'rgba(169,139,82,0.08)', border: 'rgba(169,139,82,0.28)', dot: '#A98B52' },
  accepted: { label: 'Accepted', color: '#2E6B45', bg: 'rgba(46,107,69,0.08)', border: 'rgba(46,107,69,0.25)', dot: '#2E6B45' },
  booked:   { label: 'Booked',   color: '#1E3A2F', bg: 'rgba(30,58,47,0.1)',   border: 'rgba(30,58,47,0.25)', dot: '#1E3A2F' },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function inr(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}k`;
}

function relativeDate(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function holdUrgency(holdDate: string | null): null | 'warning' | 'critical' {
  if (!holdDate) return null;
  const ms = new Date(holdDate).getTime() - Date.now();
  const hours = ms / 3600000;
  if (hours < 0) return 'critical';
  if (hours < 48) return 'critical';
  if (hours < 7 * 24) return 'warning';
  return null;
}

function followUpState(trip: PipelineTrip): null | 'amber' | 'red' | 'cold' {
  if (trip.status !== 'sent') return null;
  const msSinceSent = Date.now() - new Date(trip.updatedAt).getTime();
  if (trip.firstViewedAt == null) {
    if (msSinceSent > 5 * 24 * 3600000) return 'red';
    if (msSinceSent > 48 * 3600000) return 'amber';
  } else {
    // Client has viewed but not accepted for > 7 days
    if (msSinceSent > 7 * 24 * 3600000) return 'cold';
  }
  return null;
}

function sentAgo(trip: PipelineTrip): string {
  const days = Math.floor((Date.now() - new Date(trip.updatedAt).getTime()) / 86400000);
  if (days < 1) return '<1d';
  return `${days}d`;
}

function holdLabel(holdDate: string): string {
  const ms = new Date(holdDate).getTime() - Date.now();
  if (ms < 0) return 'Hold expired';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `Hold: ${h}h`;
  return `Hold: ${Math.ceil(h / 24)}d`;
}

/* ─── Trip card ───────────────────────────────────────────────────────────────── */

function TripCard({ trip, compact = false }: { trip: PipelineTrip; compact?: boolean }) {
  const meta = STATUS_META[trip.status as Status] ?? STATUS_META.draft;
  const holdUrg = holdUrgency(trip.minHoldExpiry);
  const followUp = followUpState(trip);
  const hasBadges = holdUrg || followUp;
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleDuplicate = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDuplicating(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.tripId) router.push(`/trips/${data.tripId}`);
    } finally {
      setDuplicating(false);
    }
  }, [trip.id, router]);

  const handleArchive = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Archive "${trip.label}"? It will be hidden from the pipeline.`)) return;
    setArchiving(true);
    try {
      await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }, [trip.id, trip.label, router]);

  return (
    <div
      className="group relative rounded-[5px] bg-white transition-all"
      style={{
        border: '1px solid rgba(22,26,23,0.09)',
        boxShadow: '0 1px 3px rgba(22,26,23,0.04)',
        transition: 'border-color 0.14s, box-shadow 0.14s, transform 0.14s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'rgba(169,139,82,0.35)';
        el.style.boxShadow = '0 4px 14px rgba(22,26,23,0.08)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'rgba(22,26,23,0.09)';
        el.style.boxShadow = '0 1px 3px rgba(22,26,23,0.04)';
        el.style.transform = '';
      }}
    >
      {/* Duplicate + Archive buttons — shown on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Duplicate trip"
          className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-sans"
          style={{ background: 'rgba(22,26,23,0.07)', color: '#4A514B', cursor: duplicating ? 'not-allowed' : 'pointer' }}
        >
          <Copy size={10} />
          {duplicating ? '…' : 'Copy'}
        </button>
        <button
          onClick={handleArchive}
          disabled={archiving}
          title="Archive trip"
          className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-sans"
          style={{ background: 'rgba(22,26,23,0.07)', color: '#4A514B', cursor: archiving ? 'not-allowed' : 'pointer' }}
        >
          <Archive size={10} />
          {archiving ? '…' : 'Archive'}
        </button>
      </div>

      <Link href={`/trips/${trip.id}`} className="block">
        <div className={compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}>
          {/* Name row */}
          <div className="flex items-start justify-between gap-2 mb-1 pr-24">
            <span className={`font-display text-ink leading-snug group-hover:text-spruce transition-colors ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
              {trip.label}
            </span>
            {!compact && (
              <span
                className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-sm flex-shrink-0"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
              >
                {meta.label}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {trip.clientName && (
              <span className="text-[11px] text-ink-soft font-sans">{trip.clientName}</span>
            )}
            {trip.clientName && (trip.destinationCount ?? 0) > 0 && (
              <span className="text-ink-mute text-[10px]">·</span>
            )}
            {(trip.destinationCount ?? 0) > 0 && (
              <span className="text-[11px] text-ink-mute font-sans">
                {trip.destinationCount} dest{trip.destinationCount !== 1 ? 's' : ''}
              </span>
            )}
            {trip.totalFromInr != null && (
              <>
                <span className="text-ink-mute text-[10px]">·</span>
                <span className="font-mono text-[11px] text-brass">{inr(trip.totalFromInr)}</span>
              </>
            )}
            <span className="ml-auto text-[10px] text-ink-mute font-sans">{relativeDate(trip.updatedAt)}</span>
          </div>

          {/* Alert chips */}
          {hasBadges && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {holdUrg === 'critical' && trip.minHoldExpiry && (
                <span className="inline-flex items-center gap-1 text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(220,38,38,0.09)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.22)' }}>
                  <Clock size={9} /> {holdLabel(trip.minHoldExpiry)}
                </span>
              )}
              {holdUrg === 'warning' && trip.minHoldExpiry && (
                <span className="inline-flex items-center gap-1 text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.09)', color: '#b45309', border: '1px solid rgba(217,119,6,0.22)' }}>
                  <Clock size={9} /> {holdLabel(trip.minHoldExpiry)}
                </span>
              )}
              {followUp === 'red' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(220,38,38,0.09)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.22)' }}>
                  <AlertTriangle size={9} /> No view · {sentAgo(trip)} — follow up
                </span>
              )}
              {followUp === 'amber' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-sans font-medium px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.09)', color: '#b45309', border: '1px solid rgba(217,119,6,0.22)' }}>
                  <AlertTriangle size={9} /> No view · {sentAgo(trip)}
                </span>
              )}
              {followUp === 'cold' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-sans font-medium px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.07)', color: '#92400e', border: '1px solid rgba(217,119,6,0.18)' }}>
                  <AlertTriangle size={9} /> Proposal going cold
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

/* ─── List view ────────────────────────────────────────────────────────────────── */

function ListView({ trips, activeStatus }: { trips: PipelineTrip[]; activeStatus: string }) {
  const filtered = activeStatus === 'all' ? trips : trips.filter(t => t.status === activeStatus);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-display text-xl text-ink mb-2">
          {activeStatus === 'all' ? 'No trips yet' : 'No trips here'}
        </p>
        <p className="text-sm text-ink-mute mb-6">
          {activeStatus === 'all' ? 'Create your first trip to get started.' : 'Switch to another status or create a new trip.'}
        </p>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 bg-spruce text-white text-sm font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          New trip
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map(t => <TripCard key={t.id} trip={t} />)}
    </div>
  );
}

/* ─── Kanban board ─────────────────────────────────────────────────────────────── */

function KanbanBoard({ trips }: { trips: PipelineTrip[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, PipelineTrip[]> = { draft: [], sent: [], accepted: [], booked: [] };
    for (const t of trips) {
      if (map[t.status]) map[t.status].push(t);
      else map.draft.push(t);
    }
    return map;
  }, [trips]);

  return (
    <div
      className="grid gap-4 pb-4"
      style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', alignItems: 'start' }}
    >
      {STATUSES.map(status => {
        const meta = STATUS_META[status];
        const col = grouped[status];
        return (
          <div key={status} className="flex flex-col gap-2">
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-[4px] mb-0.5 sticky top-0 bg-paper z-10"
              style={{ border: `1px solid ${meta.border}` }}
            >
              <div className="flex items-center gap-2">
                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: meta.dot }} />
                <span className="font-sans text-[12px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <span
                className="font-mono text-[10px] font-medium px-[5px] py-[1px] rounded-full"
                style={{ background: meta.bg, color: meta.color }}
              >
                {col.length}
              </span>
            </div>

            {/* Cards */}
            {col.length === 0 ? (
              <div className="rounded-[4px] py-6 flex items-center justify-center text-[11px] text-ink-mute font-sans" style={{ border: '1px dashed rgba(22,26,23,0.12)' }}>
                Empty
              </div>
            ) : (
              col.map(t => <TripCard key={t.id} trip={t} compact />)
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Alert rail ────────────────────────────────────────────────────────────────── */

function AlertRail({ trips }: { trips: PipelineTrip[] }) {
  const urgent = trips.filter(t => {
    const holdUrg = holdUrgency(t.minHoldExpiry);
    const fu = followUpState(t);
    return holdUrg === 'critical' || fu === 'red' || fu === 'cold';
  });
  const warning = trips.filter(t => {
    return holdUrgency(t.minHoldExpiry) === 'warning' || followUpState(t) === 'amber';
  }).filter(t => !urgent.includes(t));

  if (urgent.length === 0 && warning.length === 0) return null;

  return (
    <div className="mb-6 rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.03)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(220,38,38,0.12)', background: 'rgba(220,38,38,0.05)' }}>
        <AlertTriangle size={13} style={{ color: '#b91c1c' }} />
        <span className="text-[11px] font-sans font-semibold" style={{ color: '#b91c1c' }}>
          {urgent.length + warning.length} item{urgent.length + warning.length !== 1 ? 's' : ''} need attention
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {[...urgent, ...warning].map(t => (
          <Link key={t.id} href={`/trips/${t.id}`} className="flex items-center justify-between group">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-display text-[13px] text-ink group-hover:text-spruce truncate transition-colors">
                {t.label}
              </span>
              {t.clientName && <span className="text-[11px] text-ink-mute">{t.clientName}</span>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              {holdUrgency(t.minHoldExpiry) === 'critical' && t.minHoldExpiry && (
                <span className="text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(220,38,38,0.09)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.22)' }}>
                  {holdLabel(t.minHoldExpiry)}
                </span>
              )}
              {holdUrgency(t.minHoldExpiry) === 'warning' && t.minHoldExpiry && (
                <span className="text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.09)', color: '#b45309', border: '1px solid rgba(217,119,6,0.22)' }}>
                  {holdLabel(t.minHoldExpiry)}
                </span>
              )}
              {followUpState(t) === 'red' && (
                <span className="text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(220,38,38,0.09)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.22)' }}>
                  No view · {sentAgo(t)} — follow up
                </span>
              )}
              {followUpState(t) === 'amber' && (
                <span className="text-[9px] font-sans font-medium px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.09)', color: '#b45309', border: '1px solid rgba(217,119,6,0.22)' }}>
                  Sent {sentAgo(t)} — no view yet
                </span>
              )}
              {followUpState(t) === 'cold' && (
                <span className="text-[9px] font-sans font-medium px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.07)', color: '#92400e', border: '1px solid rgba(217,119,6,0.18)' }}>
                  Sent {relativeDate(t.updatedAt)} — follow up
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Instantiate modal ───────────────────────────────────────────────────────── */

function InstantiateModal({ blueprint, onClose }: { blueprint: BlueprintTrip; onClose: () => void }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [clientSelection, setClientSelection] = useState<ClientSelection>({});
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${blueprint.id}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          clientId: clientSelection.clientId,
          clientName: clientSelection.clientName,
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create trip from blueprint');
      }
      const { tripId } = await res.json();
      router.push(`/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(22,26,23,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[6px] shadow-xl"
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid rgba(22,26,23,0.1)' }}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(22,26,23,0.08)' }}>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={13} style={{ color: '#A98B52' }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-brass">Use blueprint</span>
            </div>
            <h2 className="font-display text-[19px] text-ink leading-tight">{blueprint.label}</h2>
          </div>
          <button onClick={onClose} className="text-ink-mute hover:text-ink transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="bpStartDate" className="block text-sm font-medium text-ink-soft mb-1.5">
              Start date
            </label>
            <input
              id="bpStartDate"
              type="date"
              required
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-glacier rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
            />
            <p className="text-[11px] text-ink-mute mt-1">Destination dates are computed from this date and the blueprint's day offsets.</p>
          </div>

          <ClientPicker onChange={setClientSelection} />

          <div>
            <label htmlFor="bpLabel" className="block text-sm font-medium text-ink-soft mb-1.5">
              Trip label <span className="text-ink-mute font-normal">(optional)</span>
            </label>
            <input
              id="bpLabel"
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`${blueprint.label} — ${startDate || 'date'}`}
              className="w-full px-3.5 py-2.5 bg-white border border-glacier rounded-md text-sm text-ink placeholder:text-ink-mute/60 focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="pt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !startDate}
              className="bg-spruce text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-spruce-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create trip'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-ink-mute hover:text-ink px-3 py-2.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Blueprint card + list ──────────────────────────────────────────────────── */

function BlueprintCard({ blueprint, onUse }: { blueprint: BlueprintTrip; onUse: () => void }) {
  const tags = parseTags(blueprint.blueprintTags);
  return (
    <div
      className="group relative rounded-[5px] bg-white transition-all px-4 py-3.5"
      style={{ border: '1px solid rgba(169,139,82,0.22)', boxShadow: '0 1px 3px rgba(22,26,23,0.04)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} style={{ color: '#A98B52' }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-brass">
              {blueprint.blueprintCountry ?? 'Blueprint'}
            </span>
          </div>
          <span className="font-display text-[15px] text-ink leading-snug block truncate">{blueprint.label}</span>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {(blueprint.destinationCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-mute font-sans">
                <MapPin size={10} />
                {blueprint.destinationCount} destination{blueprint.destinationCount !== 1 ? 's' : ''}
              </span>
            )}
            {tags.map(t => (
              <span
                key={t}
                className="text-[10px] font-sans font-medium px-[6px] py-[1px] rounded-full"
                style={{ background: 'rgba(30,58,47,0.06)', color: '#4A514B', border: '1px solid rgba(22,26,23,0.1)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onUse}
          className="flex-shrink-0 bg-spruce text-white text-[12px] font-medium px-3.5 py-[7px] rounded-[4px] hover:opacity-90 transition-opacity font-sans"
        >
          Use this blueprint
        </button>
      </div>
    </div>
  );
}

function BlueprintList({ blueprints, onUse }: { blueprints: BlueprintTrip[]; onUse: (b: BlueprintTrip) => void }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const b of blueprints) parseTags(b.blueprintTags).forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [blueprints]);

  const filtered = useMemo(() => {
    if (!activeTag) return blueprints;
    return blueprints.filter(b => parseTags(b.blueprintTags).includes(activeTag));
  }, [blueprints, activeTag]);

  const grouped = useMemo(() => {
    const map = new Map<string, BlueprintTrip[]>();
    for (const b of filtered) {
      const key = b.blueprintCountry ?? 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (blueprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-display text-xl text-ink mb-2">No blueprints yet</p>
        <p className="text-sm text-ink-mute">
          Mark any trip as a blueprint from its editor to reuse it for future clients.
        </p>
      </div>
    );
  }

  return (
    <div>
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setActiveTag(null)}
            className="text-[11px] font-sans font-medium px-2.5 py-1 rounded-full transition-colors"
            style={{
              background: activeTag === null ? '#1E3A2F' : 'transparent',
              color: activeTag === null ? '#F6F4EE' : '#4A514B',
              border: `1px solid ${activeTag === null ? '#1E3A2F' : 'rgba(22,26,23,0.15)'}`,
            }}
          >
            All
          </button>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => setActiveTag(prev => (prev === t ? null : t))}
              className="text-[11px] font-sans font-medium px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: activeTag === t ? '#A98B52' : 'transparent',
                color: activeTag === t ? 'white' : '#4A514B',
                border: `1px solid ${activeTag === t ? '#A98B52' : 'rgba(22,26,23,0.15)'}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {grouped.map(([country, list]) => (
          <div key={country}>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-display text-[15px] text-ink">{country}</span>
              <span className="font-mono text-[10px] text-ink-mute">{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map(b => <BlueprintCard key={b.id} blueprint={b} onUse={() => onUse(b)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pipeline View (main export) ────────────────────────────────────────────── */

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'booked', label: 'Booked' },
] as const;

interface PipelineViewProps {
  trips: PipelineTrip[];
  blueprints?: BlueprintTrip[];
  commissionSummary?: { expected: number; received: number; pending: number; count: number };
  showingArchived?: boolean;
}

export function PipelineView({ trips, blueprints = [], commissionSummary, showingArchived = false }: PipelineViewProps) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [instantiateTarget, setInstantiateTarget] = useState<BlueprintTrip | null>(null);
  const onBlueprints = activeStatus === 'blueprints';

  const filteredTrips = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter(t =>
      t.label.toLowerCase().includes(q) ||
      (t.clientName ?? '').toLowerCase().includes(q)
    );
  }, [trips, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: filteredTrips.length };
    for (const t of filteredTrips) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [filteredTrips]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[28px] text-ink tracking-tight leading-none">
            {showingArchived ? 'Archived' : 'Pipeline'}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[12px] text-ink-mute font-sans">
              {trips.length} {showingArchived ? 'archived' : 'active'} trip{trips.length !== 1 ? 's' : ''}
            </p>
            {showingArchived ? (
              <a href="/trips" className="text-[11px] text-brass hover:underline font-sans">← Back to pipeline</a>
            ) : (
              <a href="/trips?archived=1" className="text-[11px] text-ink-mute hover:text-ink font-sans transition-colors">View archived →</a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search trips…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-44 pl-3 pr-3 py-[6px] text-[12px] font-sans rounded-[4px] outline-none transition-colors"
              style={{
                border: '1px solid #C9D2CC',
                background: search ? 'white' : 'transparent',
                color: '#161A17',
              }}
            />
          </div>
          {/* View toggle */}
          <div className="flex rounded-[4px] overflow-hidden" style={{ border: '1px solid #C9D2CC' }}>
            {(['list', 'kanban'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); if (v === 'kanban') setActiveStatus('all'); }}
                className="flex items-center gap-1.5 px-3 py-[6px] text-[11px] font-sans transition-colors cursor-pointer"
                style={{
                  background: view === v ? '#1E3A2F' : 'transparent',
                  color: view === v ? '#F6F4EE' : '#4A514B',
                }}
              >
                {v === 'list' ? <List size={12} /> : <LayoutGrid size={12} />}
                {v === 'list' ? 'List' : 'Kanban'}
              </button>
            ))}
          </div>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-1.5 bg-spruce text-white text-[12px] font-medium px-3.5 py-[7px] rounded-[4px] hover:opacity-90 transition-opacity font-sans"
          >
            + New trip
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      {!onBlueprints && (
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        {STATUSES.map(s => {
          const meta = STATUS_META[s];
          const n = counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => { setView('list'); setActiveStatus(s); }}
              className="text-left px-3.5 py-2.5 rounded-[5px] cursor-pointer transition-all"
              style={{
                background: activeStatus === s && view === 'list' ? meta.bg : 'white',
                border: `1px solid ${activeStatus === s && view === 'list' ? meta.border : 'rgba(22,26,23,0.08)'}`,
              }}
            >
              <div className="font-mono text-[20px] font-medium text-ink leading-none mb-0.5">{n}</div>
              <div className="text-[10px] font-sans font-medium uppercase tracking-[0.08em]" style={{ color: meta.color }}>
                {meta.label}
              </div>
            </button>
          );
        })}
      </div>
      )}

      {/* Alert rail */}
      {!onBlueprints && <AlertRail trips={filteredTrips} />}

      {/* Commission summary — only shown when data exists */}
      {!onBlueprints && commissionSummary && commissionSummary.count > 0 && (
        <div
          className="flex items-center gap-6 px-4 py-3 rounded-[5px] mb-4"
          style={{ background: 'rgba(22,26,23,0.04)', border: '1px solid rgba(22,26,23,0.07)' }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">Commission</span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[15px] text-ink">{inr(commissionSummary.expected)}</span>
            <span className="font-sans text-[10px] text-ink-mute">expected · {commissionSummary.count} hotel{commissionSummary.count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[15px]" style={{ color: commissionSummary.received > 0 ? '#2E6B45' : '#9AA59B' }}>{inr(commissionSummary.received)}</span>
            <span className="font-sans text-[10px] text-ink-mute">received</span>
          </div>
          {commissionSummary.pending > 0 && (
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[15px]" style={{ color: '#A98B52' }}>{inr(commissionSummary.pending)}</span>
              <span className="font-sans text-[10px] text-ink-mute">pending</span>
            </div>
          )}
        </div>
      )}

      {/* Status tabs (list view only) */}
      {(view === 'list' || onBlueprints) && (
        <div className="flex items-center gap-0.5 mb-4" style={{ borderBottom: '1px solid #C9D2CC' }}>
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveStatus(key); setView('list'); }}
              className="px-4 py-2 text-[12px] font-medium font-sans border-b-2 -mb-px transition-colors cursor-pointer"
              style={{
                borderBottomColor: activeStatus === key ? '#1E3A2F' : 'transparent',
                color: activeStatus === key ? '#1E3A2F' : '#4A514B',
              }}
            >
              {label}
              {counts[key] != null && (
                <span className="ml-1.5 text-[10px] font-mono" style={{ color: activeStatus === key ? '#A98B52' : '#9AA59B' }}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setActiveStatus('blueprints')}
            className="px-4 py-2 text-[12px] font-medium font-sans border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5"
            style={{
              borderBottomColor: onBlueprints ? '#A98B52' : 'transparent',
              color: onBlueprints ? '#A98B52' : '#4A514B',
            }}
          >
            <Sparkles size={11} />
            Blueprints
            <span className="ml-0.5 text-[10px] font-mono" style={{ color: onBlueprints ? '#A98B52' : '#9AA59B' }}>
              {blueprints.length}
            </span>
          </button>
        </div>
      )}

      {/* Content */}
      {onBlueprints ? (
        <BlueprintList blueprints={blueprints} onUse={setInstantiateTarget} />
      ) : view === 'list' ? (
        <ListView trips={filteredTrips} activeStatus={activeStatus} />
      ) : (
        <KanbanBoard trips={filteredTrips} />
      )}

      {instantiateTarget && (
        <InstantiateModal blueprint={instantiateTarget} onClose={() => setInstantiateTarget(null)} />
      )}
    </div>
  );
}
