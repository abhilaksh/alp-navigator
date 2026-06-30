'use client';

import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, Star } from 'lucide-react';
import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';
import type { HotelDetailState } from './hotel-card';

type Filter = 'all' | 'shortlisted' | 'eliminated' | 'untagged';

interface ResearchHotel {
  destId: number;
  destName: string;
  itemId: number;
  detailId: number;
  name: string;
  stars: number | null;
  rating: number | null;
  preferredStatus: string | null;
  eliminationNote: string | null;
  familiarityScore: number | null;
  familiarityDate: string | null;
  recommendation: string | null;
  hasRates: boolean;
}

interface ResearchPanelProps {
  destinations: DestinationState[];
  onPreferredStatusChange: (hotelDetailId: number, status: string) => void;
  onEliminationNoteChange: (hotelDetailId: number, note: string | null) => void;
  onFamiliarityChange: (hotelDetailId: number, score: number | null, date: string | null) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  none:      { label: 'Untagged',      color: '#8A9189', bg: 'rgba(22,26,23,0.05)', border: 'transparent' },
  fora:      { label: 'Fora Pref',     color: '#A98B52', bg: 'rgba(169,139,82,0.12)', border: 'rgba(169,139,82,0.35)' },
  virtuoso:  { label: 'Virtuoso',      color: '#1E3A2F', bg: 'rgba(30,58,47,0.1)',   border: 'rgba(30,58,47,0.3)' },
  both:      { label: 'Fora + Virt.',  color: '#4A514B', bg: 'rgba(169,139,82,0.1)', border: 'rgba(169,139,82,0.3)' },
};

export function ResearchPanel({
  destinations,
  onPreferredStatusChange,
  onEliminationNoteChange,
  onFamiliarityChange,
}: ResearchPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedNote, setExpandedNote] = useState<number | null>(null); // detailId
  const [editingNote, setEditingNote] = useState<{ id: number; value: string } | null>(null);

  const allHotels = useMemo<ResearchHotel[]>(() => {
    const out: ResearchHotel[] = [];
    for (const dest of destinations) {
      for (const item of dest.items) {
        if (!isHotelItem(item) || !item.hotelDetails) continue;
        const d = item.hotelDetails as HotelDetailState;
        out.push({
          destId: dest.id,
          destName: dest.name,
          itemId: item.id,
          detailId: d.id,
          name: item.title,
          stars: d.stars,
          rating: d.rating,
          preferredStatus: d.preferredStatus,
          eliminationNote: d.eliminationNote,
          familiarityScore: d.familiarityScore,
          familiarityDate: d.familiarityDate,
          recommendation: d.recommendation,
          hasRates: d.rates.some(r => r.status === 'done'),
        });
      }
    }
    return out;
  }, [destinations]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allHotels;
    if (filter === 'shortlisted') return allHotels.filter(h => h.preferredStatus && h.preferredStatus !== 'none');
    if (filter === 'eliminated') return allHotels.filter(h => !!h.eliminationNote);
    if (filter === 'untagged') return allHotels.filter(h => !h.preferredStatus || h.preferredStatus === 'none');
    return allHotels;
  }, [allHotels, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { destId: number; hotels: ResearchHotel[] }>();
    for (const h of filtered) {
      if (!map.has(h.destName)) map.set(h.destName, { destId: h.destId, hotels: [] });
      map.get(h.destName)!.hotels.push(h);
    }
    return map;
  }, [filtered]);

  const counts = useMemo(() => ({
    all: allHotels.length,
    shortlisted: allHotels.filter(h => h.preferredStatus && h.preferredStatus !== 'none').length,
    eliminated: allHotels.filter(h => !!h.eliminationNote).length,
    untagged: allHotels.filter(h => !h.preferredStatus || h.preferredStatus === 'none').length,
  }), [allHotels]);

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F6F4EE' }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="font-display text-[22px] font-normal text-ink mb-1">Research</h2>
          <p className="font-sans text-[12px] text-ink-mute">
            {allHotels.length} hotel{allHotels.length !== 1 ? 's' : ''} across {destinations.length} destination{destinations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-[5px]">
          {(['all', 'shortlisted', 'eliminated', 'untagged'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="font-sans text-[11px] px-[10px] py-[4px] rounded-full cursor-pointer transition-all"
              style={{
                background: filter === f ? '#1E3A2F' : 'rgba(22,26,23,0.06)',
                color: filter === f ? '#F6F4EE' : '#4A514B',
                border: `1px solid ${filter === f ? '#1E3A2F' : 'transparent'}`,
                fontWeight: filter === f ? 500 : 400,
              }}
            >
              {f === 'all' ? 'All' : f === 'shortlisted' ? 'Shortlisted' : f === 'eliminated' ? 'Cut' : 'Untagged'}
              <span className="ml-1.5 opacity-60 font-mono text-[10px]">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {allHotels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Star size={36} className="mb-4" style={{ color: '#C9D2CC' }} />
          <p className="font-display text-[18px] text-ink-soft mb-2">No hotels in this trip yet</p>
          <p className="text-sm text-ink-mute">Add hotels from the editor tab to start researching.</p>
        </div>
      )}

      {/* Destination groups */}
      {Array.from(grouped.entries()).map(([destName, { hotels }]) => (
        <div key={destName} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-display text-[13px] font-medium text-ink-soft tracking-[0.01em]">{destName}</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(22,26,23,0.09)' }} />
            <span className="font-mono text-[10px] text-ink-mute">{hotels.length}</span>
          </div>

          <div className="flex flex-col gap-[6px]">
            {hotels.map(h => (
              <ResearchRow
                key={h.detailId}
                hotel={h}
                expandedNote={expandedNote}
                editingNote={editingNote}
                onExpandNote={id => setExpandedNote(prev => prev === id ? null : id)}
                onEditNote={(id, value) => setEditingNote({ id, value })}
                onSaveNote={(id, value) => {
                  onEliminationNoteChange(id, value || null);
                  setEditingNote(null);
                  if (!value) setExpandedNote(null);
                }}
                onCancelNote={() => setEditingNote(null)}
                onPreferredStatusChange={onPreferredStatusChange}
                onFamiliarityChange={onFamiliarityChange}
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && allHotels.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-sans text-[14px] text-ink-mute">No hotels match this filter.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Research Row ─────────────────────────────────────────────────────────── */

interface ResearchRowProps {
  hotel: ResearchHotel;
  expandedNote: number | null;
  editingNote: { id: number; value: string } | null;
  onExpandNote: (id: number) => void;
  onEditNote: (id: number, value: string) => void;
  onSaveNote: (id: number, value: string) => void;
  onCancelNote: () => void;
  onPreferredStatusChange: (hotelDetailId: number, status: string) => void;
  onFamiliarityChange: (hotelDetailId: number, score: number | null, date: string | null) => void;
}

function ResearchRow({
  hotel,
  expandedNote,
  editingNote,
  onExpandNote,
  onEditNote,
  onSaveNote,
  onCancelNote,
  onPreferredStatusChange,
  onFamiliarityChange,
}: ResearchRowProps) {
  const statusMeta = STATUS_LABELS[hotel.preferredStatus ?? 'none'] ?? STATUS_LABELS.none;
  const isEliminated = !!hotel.eliminationNote;
  const hasNote = expandedNote === hotel.detailId;
  const isEditingNote = editingNote?.id === hotel.detailId;

  return (
    <div
      className="rounded-[4px] overflow-hidden transition-shadow"
      style={{
        background: '#EDEAE1',
        borderLeft: `3px solid ${
          isEliminated ? 'rgba(139,47,47,0.4)'
          : (hotel.preferredStatus && hotel.preferredStatus !== 'none') ? '#A98B52'
          : 'rgba(201,210,204,0.5)'
        }`,
        opacity: isEliminated ? 0.75 : 1,
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-[10px]">
        {/* Hotel name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="font-display text-[14px] text-ink truncate"
              style={{ textDecoration: isEliminated ? 'line-through' : 'none', opacity: isEliminated ? 0.6 : 1 }}
            >
              {hotel.name}
            </span>
            {hotel.stars && (
              <span className="font-sans text-[9px] text-brass flex-shrink-0">{'★'.repeat(Math.min(hotel.stars, 5))}</span>
            )}
            {hotel.rating && (
              <span className="font-mono text-[10px] text-ink-mute flex-shrink-0">{hotel.rating.toFixed(1)}</span>
            )}
            {hotel.hasRates && (
              <span className="font-mono text-[9px] flex-shrink-0 px-[5px] py-px rounded-[2px]"
                style={{ background: 'rgba(46,107,69,0.12)', color: '#2E6B45' }}>
                Rates
              </span>
            )}
          </div>
          {hotel.recommendation && !isEliminated && (
            <p className="font-sans text-[11px] text-ink-mute mt-[2px] truncate" style={{ maxWidth: 380 }}>
              {hotel.recommendation}
            </p>
          )}
          {hotel.eliminationNote && (
            <p className="font-sans text-[11px] mt-[2px] truncate" style={{ color: 'rgba(139,47,47,0.8)', maxWidth: 380 }}>
              ✂ {hotel.eliminationNote}
            </p>
          )}
        </div>

        {/* Familiarity dots */}
        <div className="flex gap-[3px] flex-shrink-0">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onFamiliarityChange(hotel.detailId, hotel.familiarityScore === n ? null : n, hotel.familiarityDate)}
              className="cursor-pointer transition-all leading-none"
              style={{
                fontSize: 11,
                color: (hotel.familiarityScore ?? 0) >= n ? '#A98B52' : '#C9D2CC',
                background: 'none', border: 'none', padding: '0 1px',
              }}
              title={`Familiarity: ${n}/5`}
            >●</button>
          ))}
        </div>

        {/* Preferred status selector */}
        <div className="flex gap-[4px] flex-shrink-0">
          {(['none', 'fora', 'virtuoso', 'both'] as const).map(s => {
            const meta = STATUS_LABELS[s];
            const active = (hotel.preferredStatus ?? 'none') === s;
            return (
              <button
                key={s}
                onClick={() => onPreferredStatusChange(hotel.detailId, s)}
                className="font-sans text-[9px] uppercase tracking-[0.05em] px-[6px] py-[2px] rounded-[2px] cursor-pointer transition-all"
                style={{
                  background: active ? meta.bg : 'rgba(22,26,23,0.04)',
                  color: active ? meta.color : '#C9D2CC',
                  border: `1px solid ${active ? meta.border : 'transparent'}`,
                  fontWeight: active ? 600 : 400,
                }}
                title={meta.label}
              >
                {s === 'none' ? '—' : s === 'fora' ? 'F' : s === 'virtuoso' ? 'V' : 'F+V'}
              </button>
            );
          })}
        </div>

        {/* Elimination note toggle */}
        <button
          onClick={() => onExpandNote(hotel.detailId)}
          className="flex items-center gap-1 cursor-pointer transition-colors"
          style={{
            background: 'none', border: 'none', padding: '2px 4px',
            color: isEliminated ? 'rgba(139,47,47,0.7)' : '#C9D2CC',
            fontSize: 11,
          }}
          title={isEliminated ? 'Edit elimination note' : 'Cut this hotel'}
        >
          <XCircle size={14} />
        </button>
      </div>

      {/* Elimination note expand */}
      {(hasNote || isEditingNote) && (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid rgba(22,26,23,0.07)' }}>
          {isEditingNote ? (
            <div className="pt-2">
              <textarea
                value={editingNote.value}
                onChange={e => onEditNote(hotel.detailId, e.target.value)}
                rows={2}
                autoFocus
                placeholder="Why was this property cut? (e.g. over budget, wrong dates, availability issue)"
                className="w-full bg-transparent outline-none font-sans text-[12px] text-ink-soft resize-none leading-[1.6] placeholder:text-ink-mute placeholder:italic"
                style={{ border: 'none', borderLeft: '2px solid rgba(139,47,47,0.4)', paddingLeft: 8 }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onSaveNote(hotel.detailId, editingNote.value)}
                  className="font-sans text-[11px] px-3 py-[4px] rounded-[3px] cursor-pointer text-paper"
                  style={{ background: '#8B2F2F', border: 'none' }}
                >
                  {editingNote.value ? 'Save note' : 'Remove cut'}
                </button>
                <button
                  onClick={onCancelNote}
                  className="font-sans text-[11px] px-3 py-[4px] rounded-[3px] cursor-pointer text-ink-soft"
                  style={{ background: 'transparent', border: '1px solid #C9D2CC' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex items-start justify-between gap-3">
              <p
                className="font-sans text-[12px] leading-[1.6] flex-1"
                style={{ color: hotel.eliminationNote ? 'rgba(139,47,47,0.8)' : '#8A9189', fontStyle: hotel.eliminationNote ? 'normal' : 'italic' }}
              >
                {hotel.eliminationNote || 'No elimination note yet.'}
              </p>
              <button
                onClick={() => onEditNote(hotel.detailId, hotel.eliminationNote ?? '')}
                className="font-sans text-[11px] text-ink-mute hover:text-ink transition-colors flex-shrink-0"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
