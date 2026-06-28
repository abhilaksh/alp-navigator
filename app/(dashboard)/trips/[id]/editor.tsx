'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { Topbar, type SaveStatus, type WorkflowStatus } from '@/components/editor/topbar';
import { HotelCard, type HotelItemState } from '@/components/editor/hotel-card';
import { SearchPanel, type SearchResult } from '@/components/editor/search-panel';
import type { ParsedRate } from '@/lib/db/schema';
import type { TripFull, DestinationState, RateRow } from './types';
import { mapDestinations, updateDest, updateItem, updateRate } from './editor-utils';

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps { trip: TripFull; }

export function Editor({ trip: initialTrip }: EditorProps) {
  const id = initialTrip.id;

  const [label, setLabel]           = useState(initialTrip.label);
  const [adults]                    = useState(initialTrip.adults);
  const [status, setStatus]         = useState<WorkflowStatus>(initialTrip.status as WorkflowStatus);
  const [destinations, setDests]    = useState<DestinationState[]>(() => mapDestinations(initialTrip.destinations));
  const [activeDestId, setActiveDest] = useState<number | null>(initialTrip.destinations[0]?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDest  = destinations.find(d => d.id === activeDestId) ?? null;
  const hotelItems  = activeDest?.items ?? [];
  const clientName  = initialTrip.client?.name ?? null;

  // ─── Auto-save (debounced 1 s) ──────────────────────────────────────────────
  const scheduleSave = useCallback((patch: object) => {
    clearTimeout(saveTimer.current ?? undefined);
    setSaveStatus('unsaved');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/trips/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch { setSaveStatus('error'); }
    }, 1000);
  }, [id]);

  function handleLabelChange(v: string) {
    setLabel(v);
    scheduleSave({ label: v });
  }

  async function handleStatusChange(s: WorkflowStatus) {
    setStatus(s);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch { setSaveStatus('error'); }
  }

  // ─── WhatsApp copy ──────────────────────────────────────────────────────────
  function handleWhatsApp() {
    const lines: string[] = [`*${label}*`, ''];
    destinations.forEach(d => {
      lines.push(`📍 *${d.name}*`);
      if (d.checkin && d.checkout) lines.push(`${d.checkin} → ${d.checkout}`);
      d.items.forEach((item, i) => {
        const badge = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] ?? String(i + 1);
        lines.push(`\n${badge}. ${item.title}`);
        const detail = item.hotelDetails;
        if (detail) {
          const done = detail.rates.find(r => r.status === 'done');
          if (done?.parsedData) {
            try {
              const p: ParsedRate = JSON.parse(done.parsedData);
              if (p.room_type) lines.push(`   Room: ${p.room_type}`);
              if (p.total_inr) lines.push(`   Total: ₹${p.total_inr.toLocaleString('en-IN')}`);
              if (p.cancellation_free) lines.push(`   ✅ Free cancellation${p.cancellation_deadline ? ` until ${p.cancellation_deadline}` : ''}`);
              if (p.perks?.length) lines.push(`   ⭐ ${p.perks.join(' · ')}`);
            } catch { /* skip */ }
          }
        }
      });
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }

  // ─── Preview ────────────────────────────────────────────────────────────────
  async function handlePreview() {
    try {
      const res = await fetch(`/api/trips/${id}/preview`, { method: 'POST' });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      }
    } catch { /* no-op */ }
  }

  // ─── Destination mutations ───────────────────────────────────────────────────
  async function handleAddDestination() {
    const name = 'New destination';
    try {
      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: id, name }),
      });
      if (res.ok) {
        const dest = await res.json();
        const newDest: DestinationState = {
          id: dest.id, name, country: null, checkin: null, checkout: null, nights: null,
          sortOrder: destinations.length, items: [],
        };
        setDests(prev => [...prev, newDest]);
        setActiveDest(dest.id);
      }
    } catch { /* no-op */ }
  }

  function handleDestNameChange(destId: number, name: string) {
    setDests(prev => updateDest(prev, destId, d => ({ ...d, name })));
    scheduleSave({ destinations: true }); // trigger save indicator; real API on blur
  }

  async function handleDestNameBlur(destId: number, name: string) {
    await fetch(`/api/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  }

  // ─── Hotel mutations ─────────────────────────────────────────────────────────
  async function handleAddHotelFromSearch(hotel: SearchResult) {
    if (!activeDestId) return;
    const res = await fetch('/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: id, destinationId: activeDestId,
        name: hotel.name, stars: hotel.stars, rating: hotel.rating,
        thumbnail: hotel.thumbnail, googleRateInr: hotel.googleRateInr,
        foraId: hotel.foraId, lat: hotel.lat, lng: hotel.lng,
        serpId: hotel.id,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const newItem: HotelItemState = {
        id: data.item.id, type: 'hotel', title: hotel.name,
        bookingStatus: 'researching', sortOrder: hotelItems.length,
        hotelDetails: {
          id: data.hotelDetail.id, itemId: data.item.id,
          stars: hotel.stars, rating: hotel.rating, locationScore: null,
          recommendation: null, foraId: hotel.foraId, hotelWebsite: null,
          thumbnail: hotel.thumbnail, lat: hotel.lat ?? null,
          lng: hotel.lng ?? null, googleRateInr: hotel.googleRateInr,
          rates: [],
        },
      };
      setDests(prev => updateDest(prev, activeDestId, d => ({ ...d, items: [...d.items, newItem] })));
    }
  }

  async function handleAddManualHotel() {
    if (!activeDestId) return;
    const res = await fetch('/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: id, destinationId: activeDestId, name: 'New hotel' }),
    });
    if (res.ok) {
      const data = await res.json();
      const newItem: HotelItemState = {
        id: data.item.id, type: 'hotel', title: 'New hotel',
        bookingStatus: 'researching', sortOrder: hotelItems.length,
        hotelDetails: {
          id: data.hotelDetail.id, itemId: data.item.id,
          stars: null, rating: null, locationScore: null,
          recommendation: null, foraId: null, hotelWebsite: null,
          thumbnail: null, lat: null, lng: null, googleRateInr: null,
          rates: [],
        },
      };
      setDests(prev => updateDest(prev, activeDestId, d => ({ ...d, items: [...d.items, newItem] })));
    }
  }

  async function handleRemoveHotel(itemId: number) {
    await fetch(`/api/hotels/${itemId}`, { method: 'DELETE' }).catch(() => {});
    setDests(prev => prev.map(d => ({ ...d, items: d.items.filter(i => i.id !== itemId) })));
  }

  function handleHotelTitleChange(itemId: number, title: string) {
    setDests(prev => updateItem(prev, itemId, i => ({ ...i, title })));
    scheduleSave({ hotels: true });
  }

  function handleRecommendationChange(itemId: number, value: string) {
    setDests(prev => updateItem(prev, itemId, i => ({
      ...i,
      hotelDetails: i.hotelDetails ? { ...i.hotelDetails, recommendation: value } : null,
    })));
    scheduleSave({ hotels: true });
  }

  function handleLocationScoreChange(itemId: number, value: string) {
    const score = parseFloat(value) || null;
    setDests(prev => updateItem(prev, itemId, i => ({
      ...i,
      hotelDetails: i.hotelDetails ? { ...i.hotelDetails, locationScore: score } : null,
    })));
    scheduleSave({ hotels: true });
  }

  // ─── Rate mutations ──────────────────────────────────────────────────────────
  async function handleAddRate(hotelDetailId: number) {
    const res = await fetch('/api/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelDetailId, source: 'fora' }),
    });
    if (res.ok) {
      const rate: RateRow = await res.json();
      setDests(prev => prev.map(d => ({
        ...d,
        items: d.items.map(i => i.hotelDetails?.id === hotelDetailId
          ? { ...i, hotelDetails: { ...i.hotelDetails!, rates: [...i.hotelDetails!.rates, rate] } }
          : i),
      })));
    }
  }

  async function handleRemoveRate(rateId: number) {
    await fetch(`/api/rates/${rateId}`, { method: 'DELETE' }).catch(() => {});
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.hotelDetails
        ? { ...i, hotelDetails: { ...i.hotelDetails, rates: i.hotelDetails.rates.filter(r => r.id !== rateId) } }
        : i),
    })));
  }

  async function handleParseRate(rateId: number, rawText: string) {
    // Optimistically mark as parsing
    setDests(prev => updateRate(prev, rateId, r => ({ ...r, status: 'parsing', rawText })));
    try {
      const res = await fetch(`/api/rates/${rateId}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      if (res.ok) {
        const updated: RateRow = await res.json();
        setDests(prev => updateRate(prev, rateId, () => updated));
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Parse failed' }));
        setDests(prev => updateRate(prev, rateId, r => ({ ...r, status: 'error', errorMessage: error })));
      }
    } catch {
      setDests(prev => updateRate(prev, rateId, r => ({ ...r, status: 'error', errorMessage: 'Network error' })));
    }
  }

  function handleSourceChange(rateId: number, source: string) {
    setDests(prev => updateRate(prev, rateId, r => ({ ...r, source })));
    fetch(`/api/rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    }).catch(() => {});
  }

  function handleSelectProposal(rateId: number, proposal: ParsedRate) {
    setDests(prev => updateRate(prev, rateId, r => ({
      ...r,
      status: 'done',
      parsedData: JSON.stringify(proposal),
      proposals: null,
    })));
    fetch(`/api/rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', parsedData: JSON.stringify(proposal), proposals: null }),
    }).catch(() => {});
  }

  // ─── Computed ───────────────────────────────────────────────────────────────
  const addedHotelIds = new Set(
    hotelItems.flatMap(i => {
      const d = i.hotelDetails;
      return d?.foraId ? [d.foraId] : [];
    })
  );

  const nightsCalc = (() => {
    if (!activeDest?.checkin || !activeDest?.checkout) return null;
    try {
      const diff = new Date(activeDest.checkout).getTime() - new Date(activeDest.checkin).getTime();
      return Math.round(diff / 86400000);
    } catch { return null; }
  })();

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>

      {/* Topbar */}
      <Topbar
        label={label}
        onLabelChange={handleLabelChange}
        clientName={clientName}
        adults={adults}
        status={status}
        onStatusChange={handleStatusChange}
        saveStatus={saveStatus}
        onWhatsApp={handleWhatsApp}
        onPreview={handlePreview}
        totalFromInr={initialTrip.totalFromInr}
      />

      {/* Tab strip */}
      <nav
        className="flex items-stretch flex-shrink-0 px-4 bg-white z-[90]"
        style={{ height: 44, borderBottom: '1px solid #C9D2CC' }}
      >
        {destinations.map(dest => {
          const isActive = dest.id === activeDestId;
          const hasHotels = dest.items.length > 0;
          const hasDoneRate = dest.items.some(i => i.hotelDetails?.rates.some(r => r.status === 'done'));
          return (
            <button
              key={dest.id}
              onClick={() => setActiveDest(dest.id)}
              className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
              style={{
                color: isActive ? '#161A17' : '#4A514B',
                fontWeight: isActive ? 500 : 400,
                background: 'none',
              }}
            >
              {/* Status dot */}
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{
                  background: hasDoneRate ? '#A98B52' : isActive ? '#1E3A2F' : hasHotels ? '#4A514B' : '#C9D2CC',
                  border: !hasDoneRate && !isActive && !hasHotels ? '1px solid #8A9189' : 'none',
                }}
              />
              {dest.name}
              {/* Active underline */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-[2px] bg-brass"
                />
              )}
            </button>
          );
        })}

        {/* Add destination */}
        <button
          onClick={handleAddDestination}
          className="flex items-center px-2 font-sans text-[20px] font-light text-ink-mute bg-none border-none cursor-pointer leading-none transition-colors hover:text-brass"
          style={{ background: 'none' }}
          title="Add destination"
        >
          +
        </button>
      </nav>

      {/* Main editor body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: hotels column */}
        <div
          className="overflow-y-auto bg-paper"
          style={{
            flex: '0 0 65%',
            padding: '28px 24px 120px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#C9D2CC transparent',
          }}
        >
          {activeDest ? (
            <>
              {/* Destination heading */}
              <div className="mb-[22px]">
                <input
                  type="text"
                  value={activeDest.name}
                  onChange={e => handleDestNameChange(activeDest.id, e.target.value)}
                  onBlur={e => handleDestNameBlur(activeDest.id, e.target.value)}
                  className="font-display text-[28px] font-normal text-ink bg-transparent border-none border-b border-b-transparent outline-none w-full tracking-tight leading-[1.2] p-0"
                  style={{ letterSpacing: '-0.02em', borderBottom: '1px solid transparent', transition: 'border-color 0.14s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderBottomColor = 'rgba(22,26,23,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                  onBlurCapture={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                />

                {/* Date row */}
                <div className="flex items-center gap-2.5 mt-[5px]">
                  <input
                    type="text"
                    defaultValue={activeDest.checkin ?? ''}
                    placeholder="Check-in"
                    className="font-mono text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-0.5 transition-colors"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                  <span className="text-ink-mute text-[11px]">→</span>
                  <input
                    type="text"
                    defaultValue={activeDest.checkout ?? ''}
                    placeholder="Check-out"
                    className="font-mono text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-0.5 transition-colors"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                  {nightsCalc != null && (
                    <span className="font-mono text-[11px] text-ink-mute">· {nightsCalc} nights</span>
                  )}
                </div>
              </div>

              {/* Hotels count row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-ink-mute">
                  Selected hotels {hotelItems.length}
                </span>
              </div>

              {/* Hotel cards */}
              {hotelItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MapPin size={36} className="text-glacier mb-4" />
                  <p className="font-display text-lg text-ink-soft mb-2">No hotels yet</p>
                  <p className="text-sm text-ink-mute max-w-xs leading-relaxed">
                    Search for hotels in the panel on the right, or add one manually.
                  </p>
                </div>
              ) : (
                hotelItems.map((item, i) => (
                  <HotelCard
                    key={item.id}
                    item={item}
                    index={i}
                    onRemove={handleRemoveHotel}
                    onAddRate={handleAddRate}
                    onRemoveRate={handleRemoveRate}
                    onParseRate={handleParseRate}
                    onSourceChange={handleSourceChange}
                    onSelectProposal={handleSelectProposal}
                    onTitleChange={handleHotelTitleChange}
                    onRecommendationChange={handleRecommendationChange}
                    onLocationScoreChange={handleLocationScoreChange}
                  />
                ))
              )}

              {/* Add hotel button */}
              <button
                onClick={handleAddManualHotel}
                className="flex items-center gap-[7px] w-full px-3.5 py-[11px] mt-1 text-xs text-ink-mute border border-dashed border-glacier rounded-[4px] cursor-pointer hover:text-spruce hover:border-spruce transition-colors font-sans"
                style={{ background: 'none' }}
              >
                <Plus size={14} />
                Add hotel to {activeDest.name}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
              <p className="font-display text-xl text-ink-soft mb-2">No destinations</p>
              <p className="text-sm text-ink-mute mb-5">Add a destination tab to get started.</p>
              <button
                onClick={handleAddDestination}
                className="inline-flex items-center gap-2 bg-spruce hover:bg-spruce-light text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
              >
                <Plus size={14} /> Add destination
              </button>
            </div>
          )}
        </div>

        {/* Right: search column */}
        <div
          className="bg-white overflow-hidden flex flex-col"
          style={{ flex: '0 0 35%', borderLeft: '1px solid #C9D2CC' }}
        >
          <SearchPanel
            destinationName={activeDest?.name ?? ''}
            tripId={id}
            destinationId={activeDestId}
            addedHotelIds={addedHotelIds}
            onAdd={handleAddHotelFromSearch}
            onAddManual={handleAddManualHotel}
          />
        </div>
      </div>

      {/* Status bar */}
      <footer
        className="flex items-center flex-shrink-0 px-4 gap-2.5 z-[80]"
        style={{
          height: 40,
          background: '#EDEAE1',
          borderTop: '1px solid #C9D2CC',
        }}
      >
        {initialTrip.previewKey ? (
          <>
            <a
              href={`/preview/${initialTrip.previewKey}`}
              target="_blank"
              rel="noopener"
              className="font-mono text-[10px] text-ink-mute hover:text-brass transition-colors overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]"
            >
              {typeof window !== 'undefined' ? window.location.hostname : 'alptravel.co'}/preview/{initialTrip.previewKey}
            </a>
            <span className="w-px h-3.5 bg-glacier flex-shrink-0" />
            <button
              onClick={() => {
                if (initialTrip.previewKey) {
                  navigator.clipboard.writeText(`${window.location.origin}/preview/${initialTrip.previewKey}`).catch(() => {});
                }
              }}
              className="text-[11px] font-sans text-ink-soft border border-glacier px-2.5 py-1 rounded-sm hover:text-spruce hover:border-spruce transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              style={{ background: 'none' }}
            >
              Copy link
            </button>
          </>
        ) : (
          <span className="font-mono text-[10px] text-ink-mute">No preview link — click Preview to generate</span>
        )}

        <div className="flex-1" />

        <button
          onClick={handleWhatsApp}
          className="text-[11px] font-sans text-ink-soft border border-glacier px-2.5 py-1 rounded-sm hover:text-spruce hover:border-spruce transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ background: 'none' }}
        >
          Copy WA
        </button>
        {clientName && (
          <button
            className="text-[11px] font-sans text-ink-soft border border-glacier px-2.5 py-1 rounded-sm hover:text-spruce hover:border-spruce transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{ background: 'none' }}
          >
            Email to {clientName.split(' ')[0]}
          </button>
        )}
      </footer>
    </div>
  );
}
