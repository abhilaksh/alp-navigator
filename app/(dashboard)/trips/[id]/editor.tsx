'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Sparkles, Loader2 } from 'lucide-react';
import { Topbar, type SaveStatus, type WorkflowStatus, type IntakeStatus } from '@/components/editor/topbar';
import { HotelCard, type HotelItemState } from '@/components/editor/hotel-card';
import { LineItemCard, type LineItemState } from '@/components/editor/line-item-card';
import { SearchPanel, type SearchResult } from '@/components/editor/search-panel';
import { FlightSearchPanel, type FlightItinerary, type FlightLeg } from '@/components/editor/flight-search-panel';
import type { ParsedRate, ParsedItemRate } from '@/lib/db/schema';
import type { TripFull, DestinationState, RateRow, VisaInfoState } from './types';
import { mapDestinations, updateDest, updateItem, updateLineItem, updateRate, updateItemRate, isHotelItem } from './editor-utils';
import { ItineraryBuilder } from '@/components/editor/itinerary-builder';
import { BookingsPanel } from '@/components/editor/bookings-panel';
import { ChecklistPanel } from '@/components/editor/checklist-panel';
import { ShareModal } from '@/components/editor/share-modal';
import { ClientContextPanel } from '@/components/editor/client-context-panel';
import { PaymentPanel } from '@/components/editor/payment-panel';
import { PhotoPicker } from '@/components/editor/photo-picker';
import { VersionHistoryPanel } from '@/components/editor/version-history-panel';
import { ChangeRequestsPanel } from '@/components/editor/change-requests-panel';
import { IntakePanel } from '@/components/editor/intake-panel';
import { ResearchPanel } from '@/components/editor/research-panel';
import { EngagementPanel } from '@/components/editor/engagement-panel';

// ─── NarrativeBlock ───────────────────────────────────────────────────────────

interface NarrativeBlockProps {
  destId: number;
  narrative: string | null;
  destName: string;
  nights: number | null;
  hotelNames: string[];
  clientName: string | null;
  onSave: (narrative: string) => void;
}

function NarrativeBlock({ destId, narrative, destName, nights, hotelNames, clientName, onSave }: NarrativeBlockProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(narrative ?? '');
  const [generating, setGen]  = useState(false);

  async function generate() {
    setGen(true);
    try {
      const res = await fetch(`/api/destinations/${destId}/narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelNames: hotelNames.length ? hotelNames : undefined,
          nights: nights ?? undefined,
          clientContext: clientName ?? undefined,
        }),
      });
      if (res.ok) {
        const { narrative: gen } = await res.json() as { narrative: string };
        setValue(gen);
        onSave(gen);
      }
    } finally {
      setGen(false);
    }
  }

  async function save(text: string) {
    await fetch(`/api/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narrative: text }),
    }).catch(() => {});
    onSave(text);
  }

  if (editing) {
    return (
      <div className="mb-[18px] relative">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          rows={3}
          autoFocus
          className="w-full font-sans text-[13px] text-ink-soft bg-transparent outline-none resize-none py-1 leading-relaxed"
          style={{ borderBottom: '1px solid #A98B52' }}
          onBlur={async () => {
            setEditing(false);
            await save(value);
          }}
        />
        <div className="flex items-center gap-2 mt-1">
          <button
            onMouseDown={e => { e.preventDefault(); }}
            onClick={generate}
            disabled={generating}
            className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded-[2px] cursor-pointer transition-opacity disabled:opacity-50"
            style={{ background: 'rgba(169,139,82,0.1)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.25)' }}
          >
            {generating ? 'Writing…' : '✦ Regenerate'}
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); }}
            onClick={async () => { setEditing(false); await save(''); setValue(''); }}
            className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded-[2px] cursor-pointer transition-opacity"
            style={{ background: 'transparent', color: '#8A9189' }}
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  if (value) {
    return (
      <div
        className="mb-[18px] group cursor-text relative"
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setEditing(true)}
      >
        <p
          className="font-serif text-[13px] text-ink-soft leading-[1.65] italic transition-opacity group-hover:opacity-80"
          style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, borderLeft: '2px solid rgba(169,139,82,0.35)', paddingLeft: 10 }}
        >
          {value}
        </p>
        <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 font-mono text-[8px] text-ink-mute transition-opacity">
          edit
        </span>
      </div>
    );
  }

  return (
    <div className="mb-[16px]">
      <button
        onClick={generate}
        disabled={generating}
        className="inline-flex items-center gap-[6px] font-mono text-[9px] uppercase tracking-[0.08em] px-[10px] py-[5px] rounded-[3px] cursor-pointer transition-opacity disabled:opacity-50 hover:opacity-80"
        style={{ background: 'rgba(169,139,82,0.08)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.2)' }}
      >
        {generating ? (
          <><span className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: '#A98B52', animation: 'pulse 1s infinite' }} /> Writing narrative…</>
        ) : (
          <>✦ Generate destination narrative</>
        )}
      </button>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps { trip: TripFull; }

export function Editor({ trip: initialTrip }: EditorProps) {
  const id = initialTrip.id;
  const router = useRouter();

  const [label, setLabel]           = useState(initialTrip.label);
  const [notes, setNotes]           = useState(initialTrip.notes ?? '');
  const [personalNote, setPersonalNote] = useState((initialTrip as { personalNote?: string | null }).personalNote ?? '');
  const [journeyOverview, setJourneyOverview] = useState((initialTrip as { journeyOverview?: string | null }).journeyOverview ?? '');
  const [generatingOverview, setGeneratingOverview] = useState(false);
  const [adults]                    = useState(initialTrip.adults);
  const [status, setStatus]         = useState<WorkflowStatus>(initialTrip.status as WorkflowStatus);
  const [isBlueprint, setIsBlueprint] = useState(Boolean((initialTrip as { isBlueprint?: number | boolean }).isBlueprint));
  const [togglingBlueprint, setTogglingBlueprint] = useState(false);
  const [destinations, setDests]    = useState<DestinationState[]>(() => mapDestinations(initialTrip.destinations));
  const [activeDestId, setActiveDest] = useState<number | null>(initialTrip.destinations[0]?.id ?? null);
  const [activeView, setActiveView]   = useState<'editor' | 'overview' | 'itinerary' | 'bookings' | 'checklist' | 'payment' | 'changes' | 'research' | 'engagement'>('editor');
  const [changeRequestOpenCount, setChangeRequestOpenCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [showShare, setShowShare]   = useState(false);
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());
  const [flightSearchOpen, setFlightSearchOpen] = useState(false);
  const saveTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated                    = useRef(false);

  const [fxDate, setFxDate]         = useState<string | null>((initialTrip as { fxDate?: string | null }).fxDate ?? null);
  const [fxSource, setFxSource]     = useState<string | null>((initialTrip as { fxSource?: string | null }).fxSource ?? null);
  const [fxBufferPct, setFxBuf]     = useState<number | null>((initialTrip as { fxBufferPct?: number | null }).fxBufferPct ?? null);
  const [fxUsdToInr, setFxRate]     = useState<number | null>((initialTrip as { fxUsdToInr?: number | null }).fxUsdToInr ?? null);
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus>(
    ((initialTrip as { intakeStatus?: string | null }).intakeStatus as IntakeStatus | null) ?? 'new_inquiry'
  );
  const [budgetStatedInr] = useState<number | null>((initialTrip as { budgetStatedInr?: number | null }).budgetStatedInr ?? null);
  const [budgetEstimatedInr] = useState<number | null>((initialTrip as { budgetEstimatedInr?: number | null }).budgetEstimatedInr ?? null);
  const [urgencyFlag] = useState<'standard' | 'urgent' | 'very_urgent'>(
    ((initialTrip as { urgencyFlag?: string | null }).urgencyFlag as 'standard' | 'urgent' | 'very_urgent' | null) ?? 'standard'
  );
  const clarificationFlagsRaw = (initialTrip as { clarificationFlags?: string | null }).clarificationFlags ?? null;

  // Computed client-side only (post-mount) so server and first client render both
  // produce `null` -- avoids a hydration mismatch when the value sits right at a
  // day/hour threshold between server-render time and client-hydrate time.
  const [followUpWarning, setFollowUpWarning] = useState<'amber' | 'red' | null>(null);
  useEffect(() => {
    if (status !== 'sent') { setFollowUpWarning(null); return; }
    const fv = (initialTrip as { firstViewedAt?: number | null }).firstViewedAt;
    if (fv != null) { setFollowUpWarning(null); return; }
    const msSinceSent = Date.now() - new Date(initialTrip.updatedAt).getTime();
    setFollowUpWarning(msSinceSent > 5 * 24 * 3600000 ? 'red' : msSinceSent > 48 * 3600000 ? 'amber' : null);
  }, [status, initialTrip]);

  const activeDest  = destinations.find(d => d.id === activeDestId) ?? null;
  const hotelItems  = (activeDest?.items ?? []).filter(isHotelItem);
  const clientName  = initialTrip.client?.name ?? null;
  const clientEmail = (initialTrip.client as { email?: string | null } | null)?.email ?? null;
  const clientWa    = (initialTrip.client as { whatsapp?: string | null } | null)?.whatsapp ?? null;
  const clientId    = initialTrip.client?.id ?? null;
  const clientPreferencesRaw = (initialTrip.client as { preferences?: string | null } | null)?.preferences ?? null;
  const clientPassportExpiry = (initialTrip.client as { passportExpiry?: string | null } | null)?.passportExpiry ?? null;
  const clientNationality    = (initialTrip.client as { nationality?: string | null } | null)?.nationality ?? null;

  const expiringHolds = hotelItems.filter(h => {
    const exp = h.hotelDetails?.holdExpiresAt;
    if (!exp) return false;
    const msLeft = new Date(exp + 'T23:59:59').getTime() - Date.now();
    return msLeft < 48 * 60 * 60 * 1000;
  });

  const expiredRates = useMemo(() => {
    const now = Date.now();
    const results: { hotelTitle: string; rateLabel: string }[] = [];
    for (const dest of destinations) {
      for (const item of dest.items) {
        if (!isHotelItem(item) || !item.hotelDetails) continue;
        for (let i = 0; i < item.hotelDetails.rates.length; i++) {
          const r = item.hotelDetails.rates[i];
          if (r.status !== 'done') continue;
          if (!r.expiresAt) continue;
          if (new Date(r.expiresAt + 'T23:59:59').getTime() < now) {
            results.push({ hotelTitle: item.title, rateLabel: `Rate ${i + 1}` });
          }
        }
      }
    }
    return results;
  }, [destinations]);

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

  async function handleToggleBlueprint() {
    const next = !isBlueprint;
    if (next && !confirm('Save this trip as a reusable blueprint? Its client and fixed dates will be cleared — destinations keep their relative day offsets instead.')) {
      return;
    }
    setTogglingBlueprint(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlueprint: next }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
      if (res.ok) {
        setIsBlueprint(next);
        // Server-side conversion rewrites destination dates/offsets — refetch rather than
        // reconcile that client-side.
        router.refresh();
        if (next) router.push('/trips');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setTogglingBlueprint(false);
    }
  }

  function handleNotesChange(v: string) {
    setNotes(v);
    scheduleSave({ notes: v });
  }

  function handlePersonalNoteChange(v: string) {
    setPersonalNote(v);
    scheduleSave({ personalNote: v });
  }

  function handleJourneyOverviewChange(v: string) {
    setJourneyOverview(v);
    scheduleSave({ journeyOverview: v });
  }

  async function handleGenerateOverview() {
    setGeneratingOverview(true);
    try {
      const destNames = destinations.map(d => d.name).join(', ');
      const hotelList = destinations.flatMap(d => d.items.filter(isHotelItem).map(h => h.title)).join(', ');
      const res = await fetch(`/api/trips/${id}/generate-overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinations: destNames, hotels: hotelList || null, clientName }),
      });
      if (res.ok) {
        const data = await res.json() as { text?: string };
        if (data.text) {
          setJourneyOverview(data.text.trim());
          scheduleSave({ journeyOverview: data.text.trim() });
        }
      }
    } finally {
      setGeneratingOverview(false);
    }
  }

  async function handleFxSave(fx: { fxDate: string; fxSource: string; fxBufferPct: number; fxUsdToInr: number } | null) {
    if (fx) {
      setFxDate(fx.fxDate); setFxSource(fx.fxSource);
      setFxBuf(fx.fxBufferPct); setFxRate(fx.fxUsdToInr);
    } else {
      setFxDate(null); setFxSource(null); setFxBuf(null); setFxRate(null);
    }
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fx ?? { fxDate: null, fxSource: null, fxBufferPct: null, fxUsdToInr: null }),
    }).catch(() => {});
  }

  async function handleIntakeStatusChange(s: IntakeStatus) {
    setIntakeStatus(s);
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intakeStatus: s }),
    }).catch(() => {});
  }

  // ─── WhatsApp / Share modal ─────────────────────────────────────────────────
  function handleWhatsApp() {
    setShowShare(true);
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
          sortOrder: destinations.length, narrative: null, heroImage: null, items: [], visaInfo: null,
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

  function handleDestCheckinChange(destId: number, checkin: string) {
    setDests(prev => updateDest(prev, destId, d => {
      const checkout = d.checkout;
      if (checkout && checkout <= checkin) {
        const next = new Date(checkin);
        next.setDate(next.getDate() + 1);
        return { ...d, checkin, checkout: next.toLocaleDateString('en-CA') };
      }
      return { ...d, checkin };
    }));
  }

  function handleDestCheckoutChange(destId: number, checkout: string) {
    setDests(prev => updateDest(prev, destId, d => ({ ...d, checkout })));
  }

  async function handleDestDateBlur(destId: number) {
    const dest = destinations.find(d => d.id === destId);
    if (!dest) return;
    await fetch(`/api/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkin: dest.checkin, checkout: dest.checkout }),
    }).catch(() => {});
  }

  function handleDestCountryChange(destId: number, country: string) {
    setDests(prev => updateDest(prev, destId, d => ({ ...d, country })));
  }

  async function handleDestCountryBlur(destId: number, country: string) {
    await fetch(`/api/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country }),
    }).catch(() => {});
    if (country.trim()) {
      try {
        const res = await fetch(`/api/visa-lookup?country=${encodeURIComponent(country.trim())}`);
        if (res.ok) {
          const visaInfo: VisaInfoState | null = await res.json();
          setDests(prev => updateDest(prev, destId, d => ({ ...d, visaInfo })));
        }
      } catch { /* no-op */ }
    }
  }

  async function handleHeroImageChange(destId: number, url: string | null) {
    setDests(prev => updateDest(prev, destId, d => ({ ...d, heroImage: url })));
    await fetch(`/api/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroImage: url }),
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
      // Look up Fora partner data for this hotel
      let foraPartner = null;
      if (hotel.foraId) {
        try {
          const fp = await fetch(`/api/fora-lookup?id=${encodeURIComponent(hotel.foraId)}`);
          if (fp.ok) foraPartner = await fp.json();
        } catch { /* no-op */ }
      }
      const newItem: HotelItemState = {
        id: data.item.id, type: 'hotel', title: hotel.name,
        bookingStatus: 'researching', sortOrder: hotelItems.length,
        bookingRef: null, cancellationFreeUntil: null, visaRequired: 0, specialRequests: null,
        hotelDetails: {
          id: data.hotelDetail.id, itemId: data.item.id,
          stars: hotel.stars, rating: hotel.rating, locationScore: null,
          recommendation: null, foraId: hotel.foraId, hotelWebsite: null,
          thumbnail: hotel.thumbnail, lat: hotel.lat ?? null,
          lng: hotel.lng ?? null, googleRateInr: hotel.googleRateInr,
          holdExpiresAt: null, preferredStatus: null, eliminationNote: null,
          familiarityScore: null, familiarityDate: null,
          commissionPct: null, commissionAmountInr: null, commissionPaidAt: null,
          foraPartner, rates: [],
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
        bookingRef: null, cancellationFreeUntil: null, visaRequired: 0, specialRequests: null,
        hotelDetails: {
          id: data.hotelDetail.id, itemId: data.item.id,
          stars: null, rating: null, locationScore: null,
          recommendation: null, foraId: null, hotelWebsite: null,
          thumbnail: null, lat: null, lng: null, googleRateInr: null,
          holdExpiresAt: null, preferredStatus: null, eliminationNote: null,
          familiarityScore: null, familiarityDate: null,
          commissionPct: null, commissionAmountInr: null, commissionPaidAt: null,
          rates: [],
        },
      };
      setDests(prev => updateDest(prev, activeDestId, d => ({ ...d, items: [...d.items, newItem] })));
    }
  }

  async function handleRemoveHotel(itemId: number) {
    // /api/hotels/[id] keys off hotelDetails.id, not the tripItems id -- resolve it
    // before calling DELETE (was previously sending itemId, which always 404'd and
    // silently left the row in the database, so it reappeared on refresh).
    const hotelDetailId = destinations
      .flatMap(d => d.items)
      .filter(isHotelItem)
      .find(i => i.id === itemId)?.hotelDetails?.id;
    if (hotelDetailId != null) {
      await fetch(`/api/hotels/${hotelDetailId}`, { method: 'DELETE' }).catch(() => {});
    }
    setDests(prev => prev.map(d => ({ ...d, items: d.items.filter(i => i.id !== itemId) })));
  }

  function handleMoveHotel(destId: number, fromIndex: number, toIndex: number) {
    setDests(prev => prev.map(d => {
      if (d.id !== destId) return d;
      const items = [...d.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      const reordered = items.map((item, idx) => ({ ...item, sortOrder: idx }));
      reordered.forEach(item => {
        if (isHotelItem(item) && item.hotelDetails) {
          fetch(`/api/hotels/${item.hotelDetails.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: item.sortOrder }),
          }).catch(() => {});
        }
      });
      return { ...d, items: reordered };
    }));
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
  }

  function handleRecommendationBlur(hotelDetailId: number, value: string) {
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation: value }),
    }).catch(() => {});
  }

  function handleLocationScoreChange(itemId: number, value: string) {
    const score = parseFloat(value) || null;
    setDests(prev => updateItem(prev, itemId, i => ({
      ...i,
      hotelDetails: i.hotelDetails ? { ...i.hotelDetails, locationScore: score } : null,
    })));
  }

  function handleLocationScoreBlur(hotelDetailId: number, value: string) {
    const score = parseFloat(value) || null;
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationScore: score }),
    }).catch(() => {});
  }

  function handleHoldExpiryChange(hotelDetailId: number, date: string | null) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => {
        if (!isHotelItem(i) || i.hotelDetails?.id !== hotelDetailId) return i;
        return { ...i, hotelDetails: { ...i.hotelDetails!, holdExpiresAt: date } };
      }),
    })));
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdExpiresAt: date }),
    }).catch(() => {});
  }

  function handlePreferredStatusChange(hotelDetailId: number, status: string) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => {
        if (!isHotelItem(i) || i.hotelDetails?.id !== hotelDetailId) return i;
        return { ...i, hotelDetails: { ...i.hotelDetails!, preferredStatus: status } };
      }),
    })));
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredStatus: status }),
    }).catch(() => {});
  }

  function handleEliminationNoteChange(hotelDetailId: number, note: string | null) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => {
        if (!isHotelItem(i) || i.hotelDetails?.id !== hotelDetailId) return i;
        return { ...i, hotelDetails: { ...i.hotelDetails!, eliminationNote: note } };
      }),
    })));
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eliminationNote: note }),
    }).catch(() => {});
  }

  function handleFamiliarityChange(hotelDetailId: number, score: number | null, date: string | null) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => {
        if (!isHotelItem(i) || i.hotelDetails?.id !== hotelDetailId) return i;
        return { ...i, hotelDetails: { ...i.hotelDetails!, familiarityScore: score, familiarityDate: date } };
      }),
    })));
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familiarityScore: score, familiarityDate: date }),
    }).catch(() => {});
  }

  function handleCommissionChange(hotelDetailId: number, pct: number | null, amountInr: number | null, paidAt: string | null) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => {
        if (!isHotelItem(i) || i.hotelDetails?.id !== hotelDetailId) return i;
        return { ...i, hotelDetails: { ...i.hotelDetails!, commissionPct: pct, commissionAmountInr: amountInr, commissionPaidAt: paidAt } };
      }),
    })));
    fetch(`/api/hotels/${hotelDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionPct: pct, commissionAmountInr: amountInr, commissionPaidAt: paidAt }),
    }).catch(() => {});
  }

  function handleCancellationFreeUntilChange(itemId: number, date: string | null) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : { ...i, cancellationFreeUntil: date }),
    })));
    fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationFreeUntil: date }),
    }).catch(() => {});
  }

  function handleVisaRequiredChange(itemId: number, value: number) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : { ...i, visaRequired: value }),
    })));
    fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visaRequired: value }),
    }).catch(() => {});
  }

  function handleSpecialRequestsChange(itemId: number, json: string) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : { ...i, specialRequests: json }),
    })));
    // PATCH is already fired inside SpecialRequestsPanel; this just syncs local state
  }

  async function handleBookingStatusChange(itemId: number, newStatus: string) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : { ...i, bookingStatus: newStatus }),
    })));
    await fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingStatus: newStatus }),
    }).catch(() => {});
  }

  async function handleBookingRefChange(itemId: number, ref: string) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : { ...i, bookingRef: ref }),
    })));
    await fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingRef: ref }),
    }).catch(() => {});
  }

  function handleBookingConfirmed(itemId: number, data: {
    bookingRef?: string; bookingStatus?: string;
    confirmedTotalInr?: number; cancellationFreeUntil?: string;
  }) {
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => i.id !== itemId ? i : {
        ...i,
        ...(data.bookingRef && { bookingRef: data.bookingRef }),
        ...(data.bookingStatus && { bookingStatus: data.bookingStatus }),
        ...(data.confirmedTotalInr && { confirmedTotalInr: data.confirmedTotalInr }),
        ...(data.cancellationFreeUntil && { cancellationFreeUntil: data.cancellationFreeUntil }),
      }),
    })));
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
        items: d.items.map(i => (isHotelItem(i) && i.hotelDetails?.id === hotelDetailId)
          ? { ...i, hotelDetails: { ...i.hotelDetails!, rates: [...i.hotelDetails!.rates, rate] } }
          : i),
      })));
    }
  }

  async function handleRemoveRate(rateId: number) {
    await fetch(`/api/rates/${rateId}`, { method: 'DELETE' }).catch(() => {});
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => (isHotelItem(i) && i.hotelDetails)
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

  function handleRateExpiryChange(rateId: number, expiresAt: string | null) {
    setDests(prev => updateRate(prev, rateId, r => ({ ...r, expiresAt: expiresAt ?? null })));
    fetch(`/api/rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt }),
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

  // ─── Item rate mutations (flights/transfers/activities) ─────────────────────
  async function handleAddItemRate(itemId: number) {
    const res = await fetch('/api/item-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, source: 'direct' }),
    });
    if (res.ok) {
      const rate = await res.json();
      setDests(prev => prev.map(d => ({
        ...d,
        items: d.items.map(i => (!isHotelItem(i) && i.id === itemId)
          ? { ...i, itemRates: [...i.itemRates, rate] }
          : i),
      })));
    }
  }

  async function handleRemoveItemRate(rateId: number) {
    await fetch(`/api/item-rates/${rateId}`, { method: 'DELETE' }).catch(() => {});
    setDests(prev => prev.map(d => ({
      ...d,
      items: d.items.map(i => isHotelItem(i) ? i : { ...i, itemRates: i.itemRates.filter(r => r.id !== rateId) }),
    })));
  }

  async function handleParseItemRate(rateId: number, rawText: string) {
    setDests(prev => updateItemRate(prev, rateId, r => ({ ...r, status: 'parsing', rawText })));
    try {
      const res = await fetch(`/api/item-rates/${rateId}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDests(prev => updateItemRate(prev, rateId, () => updated));
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Parse failed' }));
        setDests(prev => updateItemRate(prev, rateId, r => ({ ...r, status: 'error', errorMessage: error })));
      }
    } catch {
      setDests(prev => updateItemRate(prev, rateId, r => ({ ...r, status: 'error', errorMessage: 'Network error' })));
    }
  }

  function handleItemRateSourceChange(rateId: number, source: string) {
    setDests(prev => updateItemRate(prev, rateId, r => ({ ...r, source })));
    fetch(`/api/item-rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    }).catch(() => {});
  }

  function handleItemRateExpiryChange(rateId: number, expiresAt: string | null) {
    setDests(prev => updateItemRate(prev, rateId, r => ({ ...r, expiresAt: expiresAt ?? null })));
    fetch(`/api/item-rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt }),
    }).catch(() => {});
  }

  async function handleRefreshBookingLink(rateId: number) {
    try {
      const res = await fetch(`/api/item-rates/${rateId}/booking-link`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setDests(prev => updateItemRate(prev, rateId, () => updated));
      }
    } catch { /* no-op */ }
  }

  function handleSelectItemRateProposal(rateId: number, proposal: ParsedItemRate) {
    setDests(prev => updateItemRate(prev, rateId, r => ({
      ...r,
      status: 'done',
      parsedData: JSON.stringify(proposal),
      proposals: null,
    })));
    fetch(`/api/item-rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', parsedData: JSON.stringify(proposal), proposals: null }),
    }).catch(() => {});
  }

  // ─── Line item mutations ─────────────────────────────────────────────────────
  async function handleAddLineItem(type: LineItemState['type']) {
    if (!activeDestId) return;
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: id, destinationId: activeDestId, type, title: type.charAt(0).toUpperCase() + type.slice(1) }),
    });
    if (res.ok) {
      const data = await res.json();
      const newItem: LineItemState = {
        id: data.id, type, title: data.title,
        bookingStatus: 'researching', bookingRef: null,
        confirmedTotalInr: null, startDate: null, endDate: null,
        cancellationFreeUntil: null, visaRequired: 0,
        detailsJson: null, sortOrder: (activeDest?.items.length ?? 0),
        itemRates: [],
      };
      setDests(prev => updateDest(prev, activeDestId, d => ({ ...d, items: [...d.items, newItem] })));
      setNewItemIds(prev => new Set(prev).add(data.id));
    }
  }

  async function addFlightLeg(itin: FlightItinerary, destinationId: number, leg: FlightLeg, includePrice: boolean, passengerCount: number) {
    const res = await fetch('/api/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: id, destinationId, leg,
        ignavId: itin.ignavId, cabinClass: itin.cabinClass,
        priceAmount: includePrice ? itin.priceAmount : null,
        currency: itin.currency,
        passengerCount,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const destItems = destinations.find(d => d.id === destinationId)?.items ?? [];
    const newItem: LineItemState = {
      id: data.item.id, type: 'flight', title: data.item.title,
      bookingStatus: 'researching', bookingRef: null,
      confirmedTotalInr: null, startDate: null, endDate: null,
      cancellationFreeUntil: null, visaRequired: 0,
      detailsJson: data.item.detailsJson ? JSON.parse(data.item.detailsJson) : null,
      sortOrder: destItems.length,
      itemRates: [data.itemRate],
    };
    setDests(prev => updateDest(prev, destinationId, d => ({ ...d, items: [...d.items, newItem] })));
  }

  async function handleAddFlightFromSearch(itin: FlightItinerary, destinationId: number, passengerCount: number) {
    await addFlightLeg(itin, destinationId, itin.outbound, true, passengerCount);
  }

  async function handleAddRoundTripFromSearch(itin: FlightItinerary, outboundDestId: number, inboundDestId: number, passengerCount: number) {
    await addFlightLeg(itin, outboundDestId, itin.outbound, true, passengerCount);
    if (itin.inbound) await addFlightLeg(itin, inboundDestId, itin.inbound, false, passengerCount);
  }

  async function handleUpdateLineItem(itemId: number, patch: Partial<LineItemState>) {
    await fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
    setDests(prev => updateLineItem(prev, itemId, i => ({ ...i, ...patch })));
    setNewItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  async function handleDeleteLineItem(itemId: number) {
    await fetch(`/api/items/${itemId}`, { method: 'DELETE' }).catch(() => {});
    setDests(prev => prev.map(d => ({ ...d, items: d.items.filter(i => i.id !== itemId) })));
    setNewItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  // ─── Computed ───────────────────────────────────────────────────────────────
  const { totalFromInr, isFromPrice } = useMemo(() => {
    let total = 0;
    let hasEstimated = false;
    for (const dest of destinations) {
      for (const item of dest.items) {
        if (!isHotelItem(item)) {
          if (item.confirmedTotalInr) total += item.confirmedTotalInr;
          if ((item.detailsJson as { isEstimated?: boolean } | null)?.isEstimated) hasEstimated = true;
          continue;
        }
        const rates = item.hotelDetails?.rates?.filter(r => r.status === 'done' && r.parsedData) ?? [];
        if (rates.length === 0) continue;
        const totals = rates.map(r => {
          try { return (JSON.parse(r.parsedData!) as ParsedRate).total_inr ?? null; }
          catch { return null; }
        }).filter((n): n is number => n != null);
        if (totals.length > 0) total += Math.min(...totals);
      }
    }
    return { totalFromInr: total > 0 ? total : null, isFromPrice: hasEstimated };
  }, [destinations]);

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalFromInr }),
    }).catch(() => {});
  }, [totalFromInr, id]);

  const commissionSummary = useMemo(() => {
    let expected = 0;
    let received = 0;
    let count = 0;
    for (const dest of destinations) {
      for (const item of dest.items) {
        if (!isHotelItem(item) || !item.hotelDetails) continue;
        const d = item.hotelDetails;
        if (d.commissionAmountInr) {
          expected += d.commissionAmountInr;
          count++;
          if (d.commissionPaidAt) received += d.commissionAmountInr;
        }
      }
    }
    return count > 0 ? { expected, received, count } : null;
  }, [destinations]);

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

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        tripId={id}
        tripLabel={label}
        clientName={clientName}
        clientWa={clientWa}
        clientEmail={clientEmail}
        previewKey={initialTrip.previewKey ?? null}
        destinations={destinations}
        totalFromInr={totalFromInr}
        personalNote={personalNote}
      />
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
        totalFromInr={totalFromInr}
        isFromPrice={isFromPrice}
        fxDate={fxDate}
        fxSource={fxSource}
        fxBufferPct={fxBufferPct}
        fxUsdToInr={fxUsdToInr}
        onFxSave={handleFxSave}
        firstViewedAt={(initialTrip as { firstViewedAt?: number | null }).firstViewedAt ?? null}
        viewCount={(initialTrip as { viewCount?: number | null }).viewCount ?? null}
        intakeStatus={intakeStatus}
        onIntakeStatusChange={handleIntakeStatusChange}
        createdAt={initialTrip.createdAt}
        isBlueprint={isBlueprint}
        onToggleBlueprint={togglingBlueprint ? undefined : handleToggleBlueprint}
        followUpWarning={followUpWarning}
      />

      {/* Tab strip */}
      <nav
        className="flex items-stretch flex-shrink-0 px-4 bg-white z-[90]"
        style={{ height: 44, borderBottom: '1px solid #C9D2CC' }}
      >
        {destinations.map(dest => {
          const isActive = dest.id === activeDestId;
          const hasHotels = dest.items.length > 0;
          const hasDoneRate = dest.items.some(i => isHotelItem(i) && i.hotelDetails?.rates.some(r => r.status === 'done'));
          return (
            <button
              key={dest.id}
              onClick={() => { setActiveDest(dest.id); setActiveView('editor'); }}
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

        {/* Separator */}
        <div className="mx-2 my-2.5" style={{ width: 1, background: '#C9D2CC', flexShrink: 0 }} />

        {/* Overview tab */}
        <button
          onClick={() => setActiveView(v => v === 'overview' ? 'editor' : 'overview')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'overview' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'overview' ? 500 : 400,
            background: 'none',
          }}
        >
          Overview
          {activeView === 'overview' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Research tab */}
        <button
          onClick={() => setActiveView(v => v === 'research' ? 'editor' : 'research')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'research' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'research' ? 500 : 400,
            background: 'none',
          }}
        >
          Research
          {activeView === 'research' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Itinerary tab */}
        <button
          onClick={() => setActiveView(v => v === 'itinerary' ? 'editor' : 'itinerary')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'itinerary' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'itinerary' ? 500 : 400,
            background: 'none',
          }}
        >
          Itinerary
          {activeView === 'itinerary' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Bookings tab */}
        <button
          onClick={() => setActiveView(v => v === 'bookings' ? 'editor' : 'bookings')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'bookings' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'bookings' ? 500 : 400,
            background: 'none',
          }}
        >
          Bookings
          {activeView === 'bookings' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Checklist tab */}
        <button
          onClick={() => setActiveView(v => v === 'checklist' ? 'editor' : 'checklist')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'checklist' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'checklist' ? 500 : 400,
            background: 'none',
          }}
        >
          Checklist
          {activeView === 'checklist' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Payment tab */}
        <button
          onClick={() => setActiveView(v => v === 'payment' ? 'editor' : 'payment')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'payment' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'payment' ? 500 : 400,
            background: 'none',
          }}
        >
          Payment
          {activeView === 'payment' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Changes tab */}
        <button
          onClick={() => setActiveView(v => v === 'changes' ? 'editor' : 'changes')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'changes' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'changes' ? 500 : 400,
            background: 'none',
          }}
        >
          Revisions
          {changeRequestOpenCount > 0 && (
            <span
              className="font-mono text-[9px] px-[5px] py-[1px] rounded-full"
              style={{ background: 'rgba(169,139,82,0.15)', color: '#A98B52' }}
            >
              {changeRequestOpenCount}
            </span>
          )}
          {activeView === 'changes' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>

        {/* Engagement tab */}
        <button
          onClick={() => setActiveView(v => v === 'engagement' ? 'editor' : 'engagement')}
          className="relative inline-flex items-center gap-[7px] px-4 font-sans text-[13px] border-none bg-none cursor-pointer whitespace-nowrap transition-colors"
          style={{
            color: activeView === 'engagement' ? '#161A17' : '#4A514B',
            fontWeight: activeView === 'engagement' ? 500 : 400,
            background: 'none',
          }}
        >
          Engagement
          {activeView === 'engagement' && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px]" style={{ background: '#A98B52' }} />
          )}
        </button>
      </nav>

      {/* Main editor body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Itinerary view */}
        {activeView === 'itinerary' && (
          <ItineraryBuilder tripId={id} destinations={destinations} />
        )}

        {/* Research view */}
        {activeView === 'research' && (
          <ResearchPanel
            destinations={destinations}
            onPreferredStatusChange={handlePreferredStatusChange}
            onEliminationNoteChange={handleEliminationNoteChange}
            onFamiliarityChange={handleFamiliarityChange}
          />
        )}

        {/* Bookings view */}
        {activeView === 'bookings' && (
          <BookingsPanel
            destinations={destinations}
            onStatusChange={handleBookingStatusChange}
            onBookingRefChange={handleBookingRefChange}
            onBookingConfirmed={handleBookingConfirmed}
          />
        )}

        {/* Checklist view */}
        {activeView === 'checklist' && (
          <ChecklistPanel
            tripLabel={label}
            clientName={clientName}
            adults={adults}
            destinations={destinations}
          />
        )}

        {/* Payment view */}
        {activeView === 'payment' && (
          <div className="flex-1 overflow-y-auto" style={{ background: '#F6F4EE', padding: '28px 32px 80px' }}>
            <div className="max-w-[520px]">
              <h2 className="font-display text-[20px] font-normal text-ink tracking-tight mb-1" style={{ letterSpacing: '-0.01em' }}>
                Payment Tracking
              </h2>
              <p className="font-sans text-[11px] text-ink-mute mb-6">
                Deposit and balance status for {label}.
              </p>
              <PaymentPanel
                tripId={id}
                totalFromInr={totalFromInr}
                paymentDataRaw={(initialTrip as { paymentData?: string | null }).paymentData ?? null}
              />

              {/* Commission summary */}
              {commissionSummary && (
                <div className="mt-6 rounded-[6px] p-5" style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.08)' }}>
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute mb-4">Commission summary</div>
                  <div className="flex gap-8">
                    <div>
                      <div className="font-mono text-[11px] text-ink-mute mb-[3px]">Expected</div>
                      <div className="font-mono text-[18px] text-ink">
                        ₹{commissionSummary.expected.toLocaleString('en-IN')}
                      </div>
                      <div className="font-sans text-[10px] text-ink-mute mt-[2px]">
                        across {commissionSummary.count} hotel{commissionSummary.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[11px] text-ink-mute mb-[3px]">Received</div>
                      <div
                        className="font-mono text-[18px]"
                        style={{ color: commissionSummary.received > 0 ? '#2E6B45' : '#8A9189' }}
                      >
                        ₹{commissionSummary.received.toLocaleString('en-IN')}
                      </div>
                      {commissionSummary.received < commissionSummary.expected && (
                        <div className="font-sans text-[10px] mt-[2px]" style={{ color: '#A98B52' }}>
                          ₹{(commissionSummary.expected - commissionSummary.received).toLocaleString('en-IN')} pending
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Changes (revision requests) view */}
        {activeView === 'changes' && (
          <div className="flex-1 overflow-y-auto" style={{ background: '#F6F4EE' }}>
            <ChangeRequestsPanel
              tripId={id}
              openCount={setChangeRequestOpenCount}
            />
          </div>
        )}

        {/* Engagement view */}
        {activeView === 'engagement' && (
          <div className="flex-1 overflow-y-auto" style={{ background: '#F6F4EE' }}>
            <EngagementPanel
              tripId={id}
              tripLabel={label}
              status={(initialTrip as { status: string }).status}
              createdAt={initialTrip.createdAt}
              updatedAt={initialTrip.updatedAt}
              firstViewedAt={(initialTrip as { firstViewedAt?: number | null }).firstViewedAt ?? null}
              viewCount={(initialTrip as { viewCount?: number }).viewCount ?? 0}
              clientAcceptedAt={(initialTrip as { clientAcceptedAt?: number | null }).clientAcceptedAt ?? null}
              previewKey={initialTrip.previewKey ?? null}
              clientName={clientName}
              clientWa={clientWa}
            />
          </div>
        )}

        {/* Overview view — trip-wide content, not tied to any single destination */}
        {activeView === 'overview' && (
          <div className="flex-1 overflow-y-auto" style={{ background: '#F6F4EE' }}>
            <div className="max-w-2xl mx-auto px-6 py-8">

              {/* Trip notes */}
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Internal notes…"
                rows={notes ? undefined : 1}
                className="w-full font-sans text-[12px] text-ink-soft bg-transparent border-none outline-none resize-none py-0 mb-[18px] leading-relaxed placeholder:text-ink-mute"
                style={{ minHeight: 20 }}
                onFocus={e => (e.currentTarget.rows = 3)}
                onBlur={e => { if (!e.currentTarget.value) e.currentTarget.rows = 1; }}
              />

              {/* Proposal sections — personal note + journey overview */}
              <div className="mb-[18px] rounded-[4px] overflow-hidden" style={{ border: '1px solid rgba(201,210,204,0.7)' }}>
                <div className="px-3 py-2" style={{ background: '#F6F4EE', borderBottom: '1px solid rgba(201,210,204,0.7)' }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">Proposal copy</p>
                </div>

                {/* Personal note */}
                <div className="px-3 pt-2.5 pb-2" style={{ borderBottom: '1px solid rgba(201,210,204,0.5)' }}>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.08em] mb-[6px]" style={{ color: '#A98B52' }}>
                    Personal note <span className="normal-case ml-1 opacity-60" style={{ fontFamily: 'inherit' }}>— your words, not AI</span>
                  </label>
                  <textarea
                    value={personalNote}
                    onChange={e => handlePersonalNoteChange(e.target.value)}
                    placeholder={`Dear ${clientName ?? 'traveller'}, based on what you shared…`}
                    rows={2}
                    className="w-full font-sans text-[12px] text-ink bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-ink-mute"
                    style={{ minHeight: 40 }}
                    onFocus={e => (e.currentTarget.rows = 4)}
                    onBlur={e => { if (!e.currentTarget.value) e.currentTarget.rows = 2; }}
                  />
                </div>

                {/* Journey overview */}
                <div className="px-3 pt-2.5 pb-3">
                  <div className="flex items-center justify-between mb-[6px]">
                    <label className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: '#4A514B' }}>
                      Journey overview
                    </label>
                    <button
                      onClick={handleGenerateOverview}
                      disabled={generatingOverview}
                      className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] px-2 py-[3px] rounded-[2px] cursor-pointer disabled:opacity-40 transition-opacity"
                      style={{ background: 'rgba(169,139,82,0.08)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.22)' }}
                    >
                      {generatingOverview ? <Loader2 size={9} className="spin" /> : <Sparkles size={9} />}
                      {generatingOverview ? 'Generating…' : 'Generate'}
                    </button>
                  </div>
                  <textarea
                    value={journeyOverview}
                    onChange={e => handleJourneyOverviewChange(e.target.value)}
                    placeholder="The emotional arc of this journey…"
                    rows={journeyOverview ? undefined : 2}
                    className="w-full font-sans text-[12px] text-ink bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-ink-mute"
                    style={{ minHeight: 40 }}
                    onFocus={e => (e.currentTarget.rows = 4)}
                    onBlur={e => { if (!e.currentTarget.value) e.currentTarget.rows = 2; }}
                  />
                </div>
              </div>

              {/* Version history */}
              <div className="mb-[18px]">
                <VersionHistoryPanel
                  tripId={id}
                  tripStatus={status}
                />
              </div>

              {/* Intake brief: budget, urgency, clarification flags */}
              <IntakePanel
                tripId={id}
                budgetStatedInr={budgetStatedInr}
                budgetEstimatedInr={budgetEstimatedInr}
                urgencyFlag={urgencyFlag}
                clarificationFlagsRaw={clarificationFlagsRaw}
              />

              {/* Client context (preferences + passport) */}
              {clientId && (
                <div className="mb-[18px]">
                  <ClientContextPanel
                    clientId={clientId}
                    clientName={clientName}
                    clientPreferencesRaw={clientPreferencesRaw}
                    passportExpiry={clientPassportExpiry}
                    nationality={clientNationality}
                  />
                </div>
              )}

            </div>
          </div>
        )}

        {/* Editor view */}
        {activeView === 'editor' && (<>

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

                {/* Country + Date row */}
                <div className="flex items-center gap-2.5 mt-[5px]">
                  <input
                    type="text"
                    value={activeDest.country ?? ''}
                    onChange={e => handleDestCountryChange(activeDest.id, e.target.value)}
                    onBlur={e => { handleDestCountryBlur(activeDest.id, e.target.value); e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    placeholder="Country"
                    className="font-sans text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-0.5 transition-colors w-[90px]"
                    style={{ borderBottom: '1px solid transparent' }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                  />
                  <span className="text-ink-mute text-[11px] opacity-40">·</span>
                  <input
                    type="date"
                    value={activeDest.checkin ?? ''}
                    onChange={e => handleDestCheckinChange(activeDest.id, e.target.value)}
                    onBlur={e => { handleDestDateBlur(activeDest.id); e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    className="font-mono text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-0.5 transition-colors"
                    style={{ borderBottom: '1px solid transparent', width: 118 }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                  />
                  <span className="text-ink-mute text-[11px]">→</span>
                  <input
                    type="date"
                    value={activeDest.checkout ?? ''}
                    onChange={e => handleDestCheckoutChange(activeDest.id, e.target.value)}
                    onBlur={e => { handleDestDateBlur(activeDest.id); e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    className="font-mono text-[11px] text-ink-soft bg-transparent border-none border-b border-b-transparent outline-none py-0.5 transition-colors"
                    style={{ borderBottom: '1px solid transparent', width: 118 }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
                  />
                  {nightsCalc != null && (
                    <span className="font-mono text-[11px] text-ink-mute">· {nightsCalc} nights</span>
                  )}
                  {activeDest.visaInfo && (
                    <span
                      title={`${activeDest.visaInfo.category}${activeDest.visaInfo.processingTime ? ` · ${activeDest.visaInfo.processingTime}` : ''}${activeDest.visaInfo.fee ? ` · ${activeDest.visaInfo.fee}` : ''}`}
                      className="ml-1 text-[9px] font-sans font-semibold px-[5px] py-[2px] rounded-sm tracking-[0.04em]"
                      style={
                        activeDest.visaInfo.required
                          ? { background: 'rgba(220,38,38,0.09)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.22)' }
                          : { background: 'rgba(30,58,47,0.08)', color: '#1E3A2F', border: '1px solid rgba(30,58,47,0.18)' }
                      }
                    >
                      {activeDest.visaInfo.required ? `Visa req.` : 'Visa free'}
                    </span>
                  )}
                </div>
              </div>

              {/* Destination narrative */}
              <NarrativeBlock
                key={activeDest.id}
                destId={activeDest.id}
                narrative={activeDest.narrative ?? null}
                destName={activeDest.name}
                nights={activeDest.nights}
                hotelNames={activeDest.items.filter(isHotelItem).map(h => h.title)}
                clientName={clientName}
                onSave={narrative => setDests(prev => prev.map(d =>
                  d.id === activeDest.id ? { ...d, narrative } : d
                ))}
              />

              {/* Destination photo */}
              <div className="mb-[18px]">
                <PhotoPicker
                  currentUrl={activeDest.heroImage ?? null}
                  onSelect={url => handleHeroImageChange(activeDest.id, url)}
                  placeholder={`${activeDest.name ?? 'destination'} travel photo`}
                />
              </div>

              {/* Hold expiry warning banner */}
              {expiringHolds.length > 0 && (
                <div className="mb-3 px-3 py-2 rounded-[4px] text-xs font-sans" style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', color: '#b91c1c' }}>
                  <span className="font-semibold">⚠ Hold expiring soon</span>
                  {' — '}
                  {expiringHolds.map(h => h.title).join(', ')}
                  {' hold'}
                  {expiringHolds.length > 1 ? 's expire' : ' expires'} within 48 hours. Confirm or release with the property.
                </div>
              )}

              {/* Expired rates banner */}
              {expiredRates.length > 0 && (
                <div className="mb-3 px-3 py-2 rounded-[4px] text-xs font-sans" style={{ background: 'rgba(139,47,47,0.07)', border: '1px solid rgba(139,47,47,0.2)', color: '#7f1d1d' }}>
                  <span className="font-semibold">Quoted rates expired</span>
                  {' — '}
                  {expiredRates.map(r => `${r.hotelTitle} (${r.rateLabel})`).join(', ')}
                  {'. Re-check pricing before sending the proposal.'}
                </div>
              )}

              {/* Hotels + line items count row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-ink-mute">
                  Selected hotels {hotelItems.length}
                </span>
              </div>

              {/* Hotel + line item cards */}
              {(activeDest?.items ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MapPin size={36} className="text-glacier mb-4" />
                  <p className="font-display text-lg text-ink-soft mb-2">No hotels yet</p>
                  <p className="text-sm text-ink-mute max-w-xs leading-relaxed">
                    Search for hotels in the panel on the right, or add one manually.
                  </p>
                </div>
              ) : (
                (activeDest?.items ?? []).map((item, i) => {
                  if (isHotelItem(item)) {
                    const hotelIdx = hotelItems.indexOf(item);
                    return (
                      <HotelCard
                        key={item.id}
                        item={item}
                        index={hotelIdx}
                        onRemove={handleRemoveHotel}
                        onMoveUp={hotelIdx > 0 ? () => handleMoveHotel(activeDest!.id, hotelIdx, hotelIdx - 1) : undefined}
                        onMoveDown={hotelIdx < hotelItems.length - 1 ? () => handleMoveHotel(activeDest!.id, hotelIdx, hotelIdx + 1) : undefined}
                        onAddRate={handleAddRate}
                        onRemoveRate={handleRemoveRate}
                        onParseRate={handleParseRate}
                        onSourceChange={handleSourceChange}
                        onSelectProposal={handleSelectProposal}
                        onTitleChange={handleHotelTitleChange}
                        onRecommendationChange={handleRecommendationChange}
                        onRecommendationBlur={handleRecommendationBlur}
                        onLocationScoreChange={handleLocationScoreChange}
                        onLocationScoreBlur={handleLocationScoreBlur}
                        onHoldExpiryChange={handleHoldExpiryChange}
                        onPreferredStatusChange={handlePreferredStatusChange}
                        onEliminationNoteChange={handleEliminationNoteChange}
                        onFamiliarityChange={handleFamiliarityChange}
                        onCommissionChange={handleCommissionChange}
                        onCancellationFreeUntilChange={handleCancellationFreeUntilChange}
                        onVisaRequiredChange={handleVisaRequiredChange}
                        onSpecialRequestsChange={handleSpecialRequestsChange}
                        onBookingStatusChange={handleBookingStatusChange}
                        onBookingRefChange={handleBookingRefChange}
                        onRateExpiryChange={handleRateExpiryChange}
                      />
                    );
                  }
                  return (
                    <LineItemCard
                      key={item.id}
                      item={item as LineItemState}
                      defaultOpen={newItemIds.has(item.id)}
                      onUpdate={handleUpdateLineItem}
                      onDelete={handleDeleteLineItem}
                      onAddRate={handleAddItemRate}
                      onRemoveRate={handleRemoveItemRate}
                      onParseRate={handleParseItemRate}
                      onRateSourceChange={handleItemRateSourceChange}
                      onSelectRateProposal={handleSelectItemRateProposal}
                      onRateExpiryChange={handleItemRateExpiryChange}
                      onRefreshBookingLink={handleRefreshBookingLink}
                    />
                  );
                })
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

              {/* Add line item buttons */}
              <div className="flex gap-2 mt-2">
                {(['flight', 'transfer', 'activity'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handleAddLineItem(type)}
                    className="flex items-center gap-[6px] flex-1 px-2.5 py-[9px] text-[11px] text-ink-mute border border-dashed border-glacier rounded-[4px] cursor-pointer hover:text-spruce hover:border-spruce transition-colors font-sans justify-center"
                    style={{ background: 'none' }}
                  >
                    <span>{type === 'flight' ? '✈' : type === 'transfer' ? '🚗' : '🎭'}</span>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setFlightSearchOpen(true)}
                className="flex items-center justify-center gap-[6px] w-full px-2.5 py-[9px] mt-2 text-[11px] text-brass border border-dashed rounded-[4px] cursor-pointer hover:opacity-80 transition-colors font-sans"
                style={{ background: 'none', borderColor: 'rgba(169,139,82,0.4)' }}
              >
                ✦ Search flights (Ignav)
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
          {flightSearchOpen ? (
            <FlightSearchPanel
              destinations={destinations.map(d => ({ id: d.id, name: d.name }))}
              activeDestinationId={activeDestId ?? destinations[0]?.id ?? 0}
              destCheckin={activeDest?.checkin ?? null}
              destCheckout={activeDest?.checkout ?? null}
              defaultAdults={adults}
              onAddOneWay={handleAddFlightFromSearch}
              onAddRoundTrip={handleAddRoundTripFromSearch}
              onClose={() => setFlightSearchOpen(false)}
            />
          ) : (
            <SearchPanel
              destinationName={activeDest?.name ?? ''}
              tripId={id}
              destinationId={activeDestId}
              destCheckin={activeDest?.checkin ?? null}
              destCheckout={activeDest?.checkout ?? null}
              addedHotelIds={addedHotelIds}
              onAdd={handleAddHotelFromSearch}
              onAddManual={handleAddManualHotel}
            />
          )}
        </div>
        </>)}
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
            onClick={() => {
              const previewUrl = initialTrip.previewKey
                ? `${window.location.origin}/preview/${initialTrip.previewKey}`
                : '';
              const firstName = clientName.split(' ')[0];
              const subject = encodeURIComponent(`Your travel quote: ${label}`);
              const body = encodeURIComponent(
                `Hi ${firstName},\n\nYour travel quote is ready${previewUrl ? `:\n${previewUrl}` : '.'}\n\nLet me know if you'd like to adjust anything.\n\nBest,\nAbhilaksh`
              );
              const href = clientEmail
                ? `mailto:${clientEmail}?subject=${subject}&body=${body}`
                : `mailto:?subject=${subject}&body=${body}`;
              window.location.href = href;
            }}
            className="text-[11px] font-sans text-ink-soft border border-glacier px-2.5 py-1 rounded-sm hover:text-spruce hover:border-spruce transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{ background: 'none' }}
          >
            Email to {clientName.split(' ')[0]}
          </button>
        )}
        {clientWa && initialTrip.previewKey && (
          <button
            onClick={() => {
              const previewUrl = `${window.location.origin}/preview/${initialTrip.previewKey}`;
              const msg = encodeURIComponent(`Hi ${clientName?.split(' ')[0]}, your travel quote is ready: ${previewUrl}`);
              window.open(`https://wa.me/${clientWa.replace(/\D/g, '')}?text=${msg}`, '_blank');
            }}
            className="text-[11px] font-sans text-ink-soft border border-glacier px-2.5 py-1 rounded-sm hover:text-spruce hover:border-spruce transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{ background: 'none' }}
          >
            WA {clientName?.split(' ')[0]}
          </button>
        )}
      </footer>
    </div>
  );
}
