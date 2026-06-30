'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { List, LayoutGrid, AlertTriangle, Clock } from 'lucide-react';

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

function isStaleSent(trip: PipelineTrip): boolean {
  if (trip.status !== 'sent') return false;
  return Date.now() - new Date(trip.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
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
  const staleSent = isStaleSent(trip);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block rounded-[5px] bg-white transition-all"
      style={{
        border: '1px solid rgba(22,26,23,0.09)',
        boxShadow: '0 1px 3px rgba(22,26,23,0.04)',
        transition: 'border-color 0.14s, box-shadow 0.14s, transform 0.14s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = 'rgba(169,139,82,0.35)';
        el.style.boxShadow = '0 4px 14px rgba(22,26,23,0.08)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = 'rgba(22,26,23,0.09)';
        el.style.boxShadow = '0 1px 3px rgba(22,26,23,0.04)';
        el.style.transform = '';
      }}
    >
      <div className={compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}>
        {/* Name row */}
        <div className="flex items-start justify-between gap-2 mb-1">
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
        {(holdUrg || staleSent) && (
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
            {staleSent && (
              <span className="inline-flex items-center gap-1 text-[9px] font-sans font-medium px-[5px] py-[2px] rounded-sm" style={{ background: 'rgba(217,119,6,0.07)', color: '#92400e', border: '1px solid rgba(217,119,6,0.18)' }}>
                <AlertTriangle size={9} /> Proposal going cold
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
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
    return holdUrg === 'critical' || isStaleSent(t);
  });
  const warning = trips.filter(t => {
    return holdUrgency(t.minHoldExpiry) === 'warning' && !isStaleSent(t);
  });

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
              {isStaleSent(t) && (
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
}

export function PipelineView({ trips }: PipelineViewProps) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [activeStatus, setActiveStatus] = useState<string>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: trips.length };
    for (const t of trips) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [trips]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[28px] text-ink tracking-tight leading-none">Pipeline</h1>
          <p className="text-[12px] text-ink-mute font-sans mt-1">{trips.length} active trip{trips.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Alert rail */}
      <AlertRail trips={trips} />

      {/* Status tabs (list view only) */}
      {view === 'list' && (
        <div className="flex items-center gap-0.5 mb-4" style={{ borderBottom: '1px solid #C9D2CC' }}>
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveStatus(key)}
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
        </div>
      )}

      {/* Content */}
      {view === 'list' ? (
        <ListView trips={trips} activeStatus={activeStatus} />
      ) : (
        <KanbanBoard trips={trips} />
      )}
    </div>
  );
}
