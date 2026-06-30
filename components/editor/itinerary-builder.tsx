'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import {
  Plus, Trash2, MapPin, Car, Utensils, Lightbulb,
  Building2, FileText, Calendar, Map, Sparkles, MessageCircle, Loader2, Copy, Check,
} from 'lucide-react';
import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface ItineraryBlock {
  id: number;
  dayId: number;
  type: string;
  content: string | null;
  itemId: number | null;
  sortOrder: number;
}

export interface ItineraryDay {
  id: number;
  tripId: number;
  destinationId: number | null;
  dayNumber: number;
  date: string | null;
  title: string | null;
  summary: string | null;
  sortOrder: number;
  blocks: ItineraryBlock[];
}

const BLOCK_TYPES = [
  { key: 'text',           label: 'Note',       Icon: FileText,  color: '#4A514B' },
  { key: 'tip',            label: 'Tip',        Icon: Lightbulb, color: '#A98B52' },
  { key: 'meal',           label: 'Meal',       Icon: Utensils,  color: '#2E6B45' },
  { key: 'transport_note', label: 'Transfer',   Icon: Car,       color: '#4A514B' },
  { key: 'hotel_ref',      label: 'Hotel',      Icon: Building2, color: '#1E3A2F' },
  { key: 'map_pin',        label: 'Map pin',    Icon: MapPin,    color: '#4A514B' },
] as const;

type BlockTypeKey = typeof BLOCK_TYPES[number]['key'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return d; }
}

function BlockIcon({ type, size = 13 }: { type: string; size?: number }) {
  const meta = BLOCK_TYPES.find(b => b.key === type);
  if (!meta) return <FileText size={size} style={{ color: '#4A514B' }} />;
  return <meta.Icon size={size} style={{ color: meta.color }} />;
}

/* ─── Block card ─────────────────────────────────────────────────────────────── */

function BlockCard({
  block, destinations, onSave, onDelete,
}: {
  block: ItineraryBlock;
  destinations: DestinationState[];
  onSave: (id: number, content: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? '');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      textRef.current.style.height = 'auto';
      textRef.current.style.height = textRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  const meta = BLOCK_TYPES.find(b => b.key === block.type);

  // For hotel_ref, find the hotel name
  if (block.type === 'hotel_ref') {
    const allHotels = destinations.flatMap(d => d.items.filter(i => isHotelItem(i)));
    const linked = block.itemId ? allHotels.find(i => i.id === block.itemId) : null;
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] group"
        style={{ background: 'rgba(30,58,47,0.04)', border: '1px solid rgba(30,58,47,0.1)' }}
      >
        <Building2 size={13} style={{ color: '#1E3A2F', flexShrink: 0 }} />
        <span className="font-sans text-[13px] text-ink flex-1 truncate">
          {linked ? linked.title : (block.content ?? 'Hotel reference')}
        </span>
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-mute hover:text-danger cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div
        className="rounded-[4px] overflow-hidden"
        style={{ border: '1px solid rgba(169,139,82,0.4)', background: 'white' }}
      >
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(22,26,23,0.06)', background: 'rgba(22,26,23,0.02)' }}>
          <BlockIcon type={block.type} size={11} />
          <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-ink-mute">{meta?.label ?? block.type}</span>
        </div>
        <textarea
          ref={textRef}
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
          onBlur={() => { onSave(block.id, draft); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(block.content ?? ''); setEditing(false); } }}
          className="w-full px-3 py-2 font-sans text-[13px] text-ink bg-transparent outline-none resize-none"
          style={{ minHeight: 60 }}
          placeholder={`Add ${meta?.label ?? 'note'}…`}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-[4px] group cursor-pointer transition-colors"
      style={{ background: 'rgba(22,26,23,0.02)', border: '1px solid rgba(22,26,23,0.07)' }}
      onClick={() => { setDraft(block.content ?? ''); setEditing(true); }}
    >
      <BlockIcon type={block.type} size={13} />
      <div className="flex-1 min-w-0">
        {block.content ? (
          <p className="font-sans text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{block.content}</p>
        ) : (
          <p className="font-sans text-[12px] text-ink-mute italic">Click to add {meta?.label?.toLowerCase() ?? 'note'}…</p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(block.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-mute hover:text-danger cursor-pointer flex-shrink-0 mt-0.5"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/* ─── Day panel ─────────────────────────────────────────────────────────────── */

function DayPanel({
  day, destinations, onUpdateDay, onAddBlock, onUpdateBlock, onDeleteBlock, onDeleteDay,
}: {
  day: ItineraryDay;
  destinations: DestinationState[];
  onUpdateDay: (id: number, patch: Partial<ItineraryDay>) => void;
  onAddBlock: (dayId: number, type: BlockTypeKey) => void;
  onUpdateBlock: (id: number, content: string) => void;
  onDeleteBlock: (id: number) => void;
  onDeleteDay: (id: number) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(day.title ?? '');
  const [dateDraft, setDateDraft] = useState(day.date ?? '');
  const [summaryDraft, setSummaryDraft] = useState(day.summary ?? '');
  const [generating, setGenerating] = useState(false);

  // Sync local draft when day prop changes (e.g. after mutate)
  useEffect(() => { setTitleDraft(day.title ?? ''); }, [day.title]);
  useEffect(() => { setSummaryDraft(day.summary ?? ''); }, [day.summary]);
  useEffect(() => { setDateDraft(day.date ?? ''); }, [day.date]);

  // Hotel items for hotel_ref picker
  const hotelItems = destinations.flatMap(d =>
    d.items.filter(i => isHotelItem(i)).map(i => ({ id: i.id, title: i.title, destName: d.name }))
  );

  const [showHotelPicker, setShowHotelPicker] = useState(false);

  const destName = day.destinationId
    ? destinations.find(d => d.id === day.destinationId)?.name
    : destinations[0]?.name;

  async function handleGenerate() {
    setGenerating(true);
    try {
      // Collect hotel names from hotel_ref blocks
      const hotelNames = day.blocks
        .filter(b => b.type === 'hotel_ref' && b.content)
        .map(b => b.content as string);

      // Collect advisor notes from "Our take" on those hotels
      const advisorNotes = destinations.flatMap(d => d.items)
        .filter(i => isHotelItem(i) && (i as { hotelDetails?: { recommendation?: string | null } }).hotelDetails?.recommendation)
        .map(i => (i as { hotelDetails?: { recommendation?: string | null } }).hotelDetails?.recommendation)
        .filter(Boolean)
        .slice(0, 2)
        .join(' | ');

      const res = await fetch(`/api/itinerary/days/${day.id}/write-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationName: destName,
          hotelNames,
          advisorNotes,
          existingSummary: summaryDraft,
        }),
      });

      if (res.ok) {
        const { narrative } = await res.json();
        if (narrative) {
          setSummaryDraft(narrative);
          onUpdateDay(day.id, { summary: narrative });
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>
      <div className="max-w-[720px] mx-auto px-6 py-6">

        {/* Day header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.09em] text-ink-mute">
                  Day {day.dayNumber}
                </span>
                {destName && (
                  <span className="text-[10px] font-sans text-ink-mute">· {destName}</span>
                )}
              </div>
              <input
                type="text"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder={`Day ${day.dayNumber} title`}
                className="font-display text-[24px] text-ink bg-transparent border-none border-b border-b-transparent outline-none w-full leading-tight"
                style={{ letterSpacing: '-0.02em', borderBottom: '1px solid transparent', transition: 'border-color 0.14s' }}
                onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; onUpdateDay(day.id, { title: e.target.value || null }); }}
              />
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 mt-1">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} style={{ color: '#9AA59B' }} />
                <input
                  type="date"
                  value={dateDraft}
                  onChange={e => setDateDraft(e.target.value)}
                  onBlur={e => onUpdateDay(day.id, { date: e.target.value || null })}
                  className="font-mono text-[11px] text-ink-soft bg-transparent border-none outline-none cursor-pointer"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <button
                onClick={() => onDeleteDay(day.id)}
                className="text-ink-mute hover:text-danger transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
                title="Delete day"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Summary with AI generate */}
          <div className="relative group/summary mt-1">
            <textarea
              value={summaryDraft}
              onChange={e => setSummaryDraft(e.target.value)}
              onBlur={() => onUpdateDay(day.id, { summary: summaryDraft || null })}
              placeholder="Add a brief overview of the day… or use AI to generate one →"
              className="w-full font-sans text-[13px] text-ink-soft bg-transparent border-none outline-none resize-none leading-relaxed pr-8"
              style={{ minHeight: 0 }}
              rows={2}
              disabled={generating}
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              title="Generate narrative with AI"
              className="absolute right-0 top-0.5 opacity-30 group-hover/summary:opacity-100 transition-opacity cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 2 }}
            >
              {generating
                ? <Loader2 size={14} style={{ color: '#A98B52' }} className="animate-spin" />
                : <Sparkles size={14} style={{ color: '#A98B52' }} />
              }
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(22,26,23,0.08)', marginBottom: 20 }} />

        {/* Blocks */}
        {day.blocks.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {day.blocks.map(block => (
              <BlockCard
                key={block.id}
                block={block}
                destinations={destinations}
                onSave={(id, content) => onUpdateBlock(id, content)}
                onDelete={onDeleteBlock}
              />
            ))}
          </div>
        )}

        {/* Add block row */}
        <div className="flex items-center gap-2 flex-wrap">
          {BLOCK_TYPES.filter(b => b.key !== 'hotel_ref').map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => onAddBlock(day.id, key as BlockTypeKey)}
              className="inline-flex items-center gap-1.5 font-sans text-[11px] px-2.5 py-[5px] rounded-[3px] cursor-pointer transition-colors"
              style={{
                background: 'rgba(22,26,23,0.04)',
                border: '1px solid rgba(22,26,23,0.1)',
                color: '#4A514B',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(22,26,23,0.2)'; e.currentTarget.style.color = '#161A17'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(22,26,23,0.1)'; e.currentTarget.style.color = '#4A514B'; }}
            >
              <Icon size={11} style={{ color }} /> {label}
            </button>
          ))}

          {/* Hotel ref — only if hotels exist */}
          {hotelItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHotelPicker(v => !v)}
                className="inline-flex items-center gap-1.5 font-sans text-[11px] px-2.5 py-[5px] rounded-[3px] cursor-pointer transition-colors"
                style={{
                  background: 'rgba(30,58,47,0.06)',
                  border: '1px solid rgba(30,58,47,0.14)',
                  color: '#1E3A2F',
                }}
              >
                <Building2 size={11} /> Hotel
              </button>
              {showHotelPicker && (
                <div
                  className="absolute left-0 top-full mt-1 bg-white rounded-[4px] z-50 py-1"
                  style={{ border: '1px solid rgba(22,26,23,0.12)', boxShadow: '0 4px 14px rgba(22,26,23,0.1)', minWidth: 200 }}
                >
                  {hotelItems.map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        fetch('/api/itinerary/blocks', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ dayId: day.id, type: 'hotel_ref', content: h.title, itemId: h.id, sortOrder: day.blocks.length }),
                        }).then(() => { setShowHotelPicker(false); });
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-paper transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <span className="font-sans text-[12px] text-ink block truncate">{h.title}</span>
                      <span className="font-sans text-[10px] text-ink-mute">{h.destName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ─── Main ItineraryBuilder ─────────────────────────────────────────────────── */

interface ItineraryBuilderProps {
  tripId: number;
  destinations: DestinationState[];
}

export function ItineraryBuilder({ tripId, destinations }: ItineraryBuilderProps) {
  const { data: days, mutate } = useSWR<ItineraryDay[]>(
    `/api/itinerary/days?tripId=${tripId}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [activeDayId, setActiveDayId] = useState<number | null>(null);

  const sortedDays = (days ?? []).slice().sort((a, b) =>
    a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.dayNumber - b.dayNumber
  );

  const activeDay = sortedDays.find(d => d.id === activeDayId) ?? sortedDays[0] ?? null;

  // Auto-select first day
  useEffect(() => {
    if (!activeDayId && sortedDays.length > 0) setActiveDayId(sortedDays[0].id);
  }, [days]);

  /* ── Day CRUD ────────────────────────────────────── */

  const handleAddDay = useCallback(async () => {
    const nextNum = sortedDays.length > 0 ? Math.max(...sortedDays.map(d => d.dayNumber)) + 1 : 1;
    const res = await fetch('/api/itinerary/days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, dayNumber: nextNum, sortOrder: nextNum - 1, title: `Day ${nextNum}` }),
    });
    if (res.ok) {
      const newDay: ItineraryDay = await res.json();
      await mutate();
      setActiveDayId(newDay.id);
    }
  }, [tripId, sortedDays, mutate]);

  const handleUpdateDay = useCallback(async (id: number, patch: Partial<ItineraryDay>) => {
    await fetch(`/api/itinerary/days/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    mutate(
      prev => prev?.map(d => d.id === id ? { ...d, ...patch } : d),
      { revalidate: false },
    );
  }, [mutate]);

  const handleDeleteDay = useCallback(async (id: number) => {
    await fetch(`/api/itinerary/days/${id}`, { method: 'DELETE' });
    await mutate();
    setActiveDayId(prev => {
      const remaining = sortedDays.filter(d => d.id !== id);
      if (prev === id) return remaining[0]?.id ?? null;
      return prev;
    });
  }, [sortedDays, mutate]);

  /* ── Auto-generate from destinations ──────────────── */

  const handleAutoGenerate = useCallback(async () => {
    const ops: Array<{ dayNumber: number; date: string; title: string; destinationId: number; sortOrder: number }> = [];
    let dayNum = 1;
    for (const dest of destinations) {
      if (!dest.checkin || !dest.checkout) continue;
      const start = new Date(dest.checkin);
      const end = new Date(dest.checkout);
      let cur = new Date(start);
      while (cur < end) {
        ops.push({
          dayNumber: dayNum++,
          date: cur.toISOString().slice(0, 10),
          title: `Day ${dayNum - 1} — ${dest.name}`,
          destinationId: dest.id,
          sortOrder: dayNum - 2,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }
    if (ops.length === 0) return;
    for (const op of ops) {
      await fetch('/api/itinerary/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, ...op }),
      });
    }
    const refreshed = await mutate();
    if (refreshed?.length) setActiveDayId(refreshed[0].id);
  }, [tripId, destinations, mutate]);

  const [waSummaryText, setWaSummaryText] = useState<string | null>(null);
  const [waGenerating, setWaGenerating] = useState(false);
  const [waCopied, setWaCopied] = useState(false);

  const handleWaSummary = useCallback(async () => {
    setWaGenerating(true);
    setWaSummaryText(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const { summary } = await res.json();
        setWaSummaryText(summary ?? null);
      }
    } finally {
      setWaGenerating(false);
    }
  }, [tripId]);

  /* ── Block CRUD ─────────────────────────────────── */

  const handleAddBlock = useCallback(async (dayId: number, type: BlockTypeKey) => {
    const day = sortedDays.find(d => d.id === dayId);
    const res = await fetch('/api/itinerary/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayId, type, sortOrder: day?.blocks.length ?? 0 }),
    });
    if (res.ok) {
      const newBlock: ItineraryBlock = await res.json();
      mutate(
        prev => prev?.map(d => d.id === dayId ? { ...d, blocks: [...d.blocks, newBlock] } : d),
        { revalidate: false },
      );
    }
  }, [sortedDays, mutate]);

  const handleUpdateBlock = useCallback(async (id: number, content: string) => {
    await fetch(`/api/itinerary/blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    mutate(
      prev => prev?.map(d => ({
        ...d,
        blocks: d.blocks.map(b => b.id === id ? { ...b, content } : b),
      })),
      { revalidate: false },
    );
  }, [mutate]);

  const handleDeleteBlock = useCallback(async (id: number) => {
    await fetch(`/api/itinerary/blocks/${id}`, { method: 'DELETE' });
    mutate(
      prev => prev?.map(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) })),
      { revalidate: false },
    );
  }, [mutate]);

  /* ── Loading ─────────────────────────────────────── */

  const canAutoGenerate = destinations.some(d => d.checkin && d.checkout);

  if (!days) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-3 w-64">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-glacier rounded-[4px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  /* ── Empty state ─────────────────────────────────── */

  if (sortedDays.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(30,58,47,0.08)' }}
        >
          <Map size={22} style={{ color: '#1E3A2F' }} />
        </div>
        <div>
          <p className="font-display text-[18px] text-ink mb-1">No itinerary yet</p>
          <p className="font-sans text-[12px] text-ink-mute max-w-[280px] leading-relaxed">
            Build a day-by-day guide for your client — notes, tips, restaurant suggestions, and hotel check-ins.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAddDay}
            className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium px-4 py-2 rounded-[4px] text-white bg-spruce hover:opacity-90 transition-opacity cursor-pointer"
            style={{ border: 'none' }}
          >
            <Plus size={13} /> Add first day
          </button>
          {canAutoGenerate && (
            <button
              onClick={handleAutoGenerate}
              className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium px-4 py-2 rounded-[4px] cursor-pointer transition-colors"
              style={{ border: '1px solid rgba(22,26,23,0.15)', background: 'white', color: '#4A514B' }}
            >
              <Calendar size={13} /> Generate from dates
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Main layout ─────────────────────────────────── */

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Left: days sidebar */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: 220, borderRight: '1px solid #C9D2CC', background: 'white', flexShrink: 0 }}
      >
        <div
          className="px-3 py-2.5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.07)', background: 'rgba(22,26,23,0.01)' }}
        >
          <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.09em] text-ink-mute">
            {sortedDays.length} day{sortedDays.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {canAutoGenerate && sortedDays.length === 0 && (
              <button
                onClick={handleAutoGenerate}
                className="text-[10px] font-sans text-ink-mute hover:text-brass transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
                title="Auto-generate from destination dates"
              >
                <Calendar size={12} />
              </button>
            )}
            {sortedDays.length > 0 && (
              <button
                onClick={handleWaSummary}
                disabled={waGenerating}
                className="text-ink-mute hover:text-brass transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
                title="Generate WhatsApp summary"
              >
                {waGenerating ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
              </button>
            )}
            <button
              onClick={handleAddDay}
              className="text-ink-mute hover:text-brass transition-colors cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0 }}
              title="Add day"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>
          {sortedDays.map(d => {
            const isActive = d.id === (activeDay?.id);
            const destName = d.destinationId ? destinations.find(dest => dest.id === d.destinationId)?.name : null;
            return (
              <button
                key={d.id}
                onClick={() => setActiveDayId(d.id)}
                className="w-full text-left px-3 py-2.5 transition-colors cursor-pointer block"
                style={{
                  background: isActive ? 'rgba(30,58,47,0.06)' : 'none',
                  borderBottom: '1px solid rgba(22,26,23,0.05)',
                  border: 'none',
                  borderLeft: `2px solid ${isActive ? '#1E3A2F' : 'transparent'}`,
                  paddingLeft: isActive ? 10 : 12,
                  outline: 'none',
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[9px] font-medium text-ink-mute">Day {d.dayNumber}</span>
                  {d.date && (
                    <span className="font-sans text-[9px] text-ink-mute">{formatDate(d.date)}</span>
                  )}
                </div>
                <p className="font-sans text-[12px] text-ink truncate leading-snug"
                  style={{ fontWeight: isActive ? 500 : 400 }}>
                  {d.title || <span className="text-ink-mute italic">Untitled</span>}
                </p>
                {destName && (
                  <p className="font-sans text-[10px] text-ink-mute truncate mt-0.5">{destName}</p>
                )}
                {d.blocks.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {d.blocks.slice(0, 5).map(b => (
                      <span key={b.id} style={{ color: BLOCK_TYPES.find(t => t.key === b.type)?.color ?? '#9AA59B' }}>
                        <BlockIcon type={b.type} size={9} />
                      </span>
                    ))}
                    {d.blocks.length > 5 && (
                      <span className="font-mono text-[9px] text-ink-mute">+{d.blocks.length - 5}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* Add day at bottom */}
          <button
            onClick={handleAddDay}
            className="w-full text-left px-3 py-2.5 transition-colors cursor-pointer"
            style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(22,26,23,0.05)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,26,23,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-ink-mute hover:text-brass transition-colors">
              <Plus size={11} /> Add day
            </span>
          </button>
        </div>

        {/* WA summary panel */}
        {waSummaryText && (
          <div
            className="px-3 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(22,26,23,0.09)', background: 'rgba(22,26,23,0.02)' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-sans font-semibold uppercase tracking-[0.09em] text-ink-mute">WA Summary</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { navigator.clipboard.writeText(waSummaryText); setWaCopied(true); setTimeout(() => setWaCopied(false), 2000); }}
                  className="text-ink-mute hover:text-brass transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  title="Copy to clipboard"
                >
                  {waCopied ? <Check size={12} style={{ color: '#2E6B45' }} /> : <Copy size={12} />}
                </button>
                <button
                  onClick={() => setWaSummaryText(null)}
                  className="text-ink-mute hover:text-danger transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  ×
                </button>
              </div>
            </div>
            <pre className="font-sans text-[10px] text-ink-soft whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'inherit' }}>
              {waSummaryText}
            </pre>
          </div>
        )}
      </div>

      {/* Right: day editing panel */}
      {activeDay ? (
        <DayPanel
          key={activeDay.id}
          day={activeDay}
          destinations={destinations}
          onUpdateDay={handleUpdateDay}
          onAddBlock={handleAddBlock}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
          onDeleteDay={handleDeleteDay}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-ink-mute font-sans text-[13px]">
          Select a day
        </div>
      )}
    </div>
  );
}
