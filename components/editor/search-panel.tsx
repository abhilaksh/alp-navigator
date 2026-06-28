'use client';

import { useState } from 'react';
import { Search, Plus, Check, Loader2, AlertCircle } from 'lucide-react';

export interface SearchResult {
  id: string;
  name: string;
  stars: number;
  rating: number;
  reviews: number;
  googleRateInr: number | null;
  thumbnail: string | null;
  foraId: string | null;
  isForaPreferred?: boolean;
  isVirtuoso?: boolean;
  lat?: number;
  lng?: number;
}

interface SearchPanelProps {
  destinationName: string;
  tripId: number;
  destinationId: number | null;
  addedHotelIds: Set<string>; // serpapi IDs already added
  onAdd: (hotel: SearchResult) => Promise<void>;
  onAddManual: () => Promise<void>;
}

const STAR_FILTERS = [
  { value: 5, label: '5★' },
  { value: 4, label: '4★' },
  { value: 3, label: '3★' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'rating',    label: 'Highest rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
}

export function SearchPanel({ destinationName, tripId, destinationId, addedHotelIds, onAdd, onAddManual }: SearchPanelProps) {
  const [query, setQuery] = useState(`${destinationName} luxury hotels`);
  const [checkin, setCheckin] = useState(() => localDate(1));
  const [checkout, setCheckout] = useState(() => localDate(4));
  const [starFilters, setStarFilters] = useState<Set<number>>(new Set([5, 4]));
  const [sort, setSort] = useState('relevance');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Set<string>>(new Set());

  function handleCheckinChange(val: string) {
    setCheckin(val);
    if (checkout && checkout <= val) {
      // push checkout to at least 1 day after new checkin
      const next = new Date(val);
      next.setDate(next.getDate() + 1);
      setCheckout(next.toLocaleDateString('en-CA'));
    }
  }

  function toggleStar(n: number) {
    setStarFilters(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function doSearch() {
    if (!query.trim() || !checkin || !checkout) return;
    setStatus('loading');
    setError(null);
    try {
      const sortBy = sort === 'rating' ? '8' : sort === 'price_asc' ? '3' : undefined;
      const body: Record<string, unknown> = {
        query,
        checkin,
        checkout,
        filters: {
          ...(starFilters.size > 0 && { hotel_class: [...starFilters].join(',') }),
          ...(sortBy && { sort_by: sortBy }),
        },
      };
      const res = await fetch('/api/search/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const mapped: SearchResult[] = (data.results ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.serpIdx ?? r.name ?? Math.random()),
        name: String(r.name ?? ''),
        stars: (r.stars as number) ?? 0,
        rating: (r.rating as number) ?? 0,
        reviews: (r.reviews as number) ?? 0,
        googleRateInr: (r.rate_inr as number) ?? null,
        thumbnail: (r.thumbnail as string) ?? null,
        foraId: null,
        isForaPreferred: false,
        isVirtuoso: false,
        lat: (r.gps_coordinates as { latitude: number; longitude: number } | null)?.latitude,
        lng: (r.gps_coordinates as { latitude: number; longitude: number } | null)?.longitude,
      }));
      setResults(mapped);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setStatus('error');
    }
  }

  async function handleAdd(hotel: SearchResult) {
    if (adding.has(hotel.id)) return;
    setAdding(prev => new Set(prev).add(hotel.id));
    try {
      await onAdd(hotel);
    } finally {
      setAdding(prev => { const n = new Set(prev); n.delete(hotel.id); return n; });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="sticky top-0 bg-white px-4 pt-4 pb-3 z-10"
        style={{ borderBottom: '1px solid rgba(22,26,23,0.06)' }}
      >
        <div className="text-[10px] font-semibold tracking-[0.09em] uppercase text-ink-mute mb-2.5">
          Find hotels for <span className="text-spruce">{destinationName || 'this destination'}</span>
        </div>

        {/* Search bar */}
        <div className="flex gap-[5px] mb-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search Google Hotels…"
            className="flex-1 px-2.5 py-[7px] border border-glacier rounded-sm font-sans text-xs text-ink bg-paper outline-none transition-colors"
            style={{}}
            onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
            onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
          />
          <button
            onClick={doSearch}
            disabled={status === 'loading' || !checkin || !checkout}
            className="flex items-center gap-[5px] px-3 py-[7px] bg-spruce hover:bg-spruce-light text-white border-none rounded-sm font-sans text-xs font-medium flex-shrink-0 cursor-pointer transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
            Search
          </button>
        </div>

        {/* Date row */}
        <div className="flex gap-[5px] mb-2">
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Check-in</label>
            <input
              type="date"
              value={checkin}
              min={localDate(1)}
              onChange={e => handleCheckinChange(e.target.value)}
              className="w-full px-2 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none transition-colors"
              onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
              onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Check-out</label>
            <input
              type="date"
              value={checkout}
              min={checkin ? (() => { const d = new Date(checkin); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })() : localDate(2)}
              onChange={e => setCheckout(e.target.value)}
              className="w-full px-2 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none transition-colors"
              onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
              onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
            />
          </div>
        </div>

        {/* Star filters */}
        <div className="flex gap-1 flex-wrap">
          {STAR_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => toggleStar(f.value)}
              className={`text-[10px] px-2 py-[3px] rounded-full border font-sans cursor-pointer transition-all ${
                starFilters.has(f.value)
                  ? 'bg-spruce border-spruce text-white'
                  : 'border-glacier text-ink-soft hover:border-spruce hover:text-spruce'
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="ml-auto text-[10px] text-ink-soft bg-paper border border-glacier rounded-sm px-1.5 py-[3px] font-sans outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Alt search divider */}
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
        <span className="flex-1 h-px bg-glacier" />
        <span className="text-[9px] text-ink-mute uppercase tracking-[0.09em] font-medium flex-shrink-0">or</span>
        <span className="flex-1 h-px bg-glacier" />
      </div>

      {/* Manual add button */}
      <button
        onClick={onAddManual}
        className="flex items-center gap-[5px] mx-4 mb-2 px-3 py-[6px] text-[11px] text-ink-mute border border-dashed border-glacier rounded-sm cursor-pointer hover:text-spruce hover:border-spruce transition-colors font-sans"
        style={{ background: 'none' }}
      >
        <Plus size={12} />
        Add hotel manually
      </button>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-3 pb-5">
        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-10 text-ink-mute text-[13px] font-sans text-center">
            <Loader2 size={24} className="spin text-brass" />
            <span>Searching Google Hotels…</span>
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="mx-1 mt-3 p-4 rounded" style={{ background: 'rgba(139,47,47,0.05)', border: '1px solid rgba(139,47,47,0.2)' }}>
            <div className="flex items-center gap-2 text-danger text-[13px] font-sans mb-2.5">
              <AlertCircle size={14} /> {error}
            </div>
            <button
              onClick={doSearch}
              className="px-3.5 py-1.5 bg-danger text-paper border-none rounded-sm text-xs cursor-pointer font-sans"
            >
              Retry
            </button>
          </div>
        )}

        {/* Idle — prompt */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <Search size={32} className="text-glacier mb-3" />
            <p className="font-display text-base text-ink-soft mb-1">Search for hotels</p>
            <p className="text-xs text-ink-mute leading-relaxed">
              Set your dates and search to see live Google Hotels rates.
            </p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="font-display text-base text-ink-soft mb-1">No results</p>
            <p className="text-xs text-ink-mute">Try a different search or add a hotel manually.</p>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <div className="flex flex-col gap-[7px] pt-1.5">
            {results.map(hotel => {
              const isAdded = addedHotelIds.has(hotel.id);
              const isAdding = adding.has(hotel.id);
              return (
                <ResultCard
                  key={hotel.id}
                  hotel={hotel}
                  isAdded={isAdded}
                  isAdding={isAdding}
                  onAdd={() => handleAdd(hotel)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Result card ─────────────────────────────────────────────────────────── */
interface ResultCardProps {
  hotel: SearchResult;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
}

function ResultCard({ hotel, isAdded, isAdding, onAdd }: ResultCardProps) {
  const stars = '★'.repeat(Math.min(hotel.stars, 5));

  return (
    <div
      className="flex gap-[9px] p-[9px] rounded-[4px] border border-transparent bg-paper cursor-pointer transition-all group/result"
      style={{ transition: 'border-color 0.14s, transform 0.14s, box-shadow 0.14s' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(169,139,82,0.4)';
        e.currentTarget.style.background = 'rgba(169,139,82,0.03)';
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(22,26,23,0.07)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.background = '#F6F4EE';
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Thumbnail */}
      {hotel.thumbnail ? (
        <img
          src={hotel.thumbnail}
          alt={hotel.name}
          className="w-[68px] h-[54px] object-cover rounded-sm flex-shrink-0 bg-glacier"
        />
      ) : (
        <div className="w-[68px] h-[54px] rounded-sm flex-shrink-0 bg-glacier" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-display text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">
          {hotel.name}
        </div>
        {hotel.stars > 0 && (
          <div className="text-[9px] text-brass tracking-[-0.5px] mb-0.5">{stars}</div>
        )}
        <div className="flex items-center gap-[5px]">
          <span className="font-mono text-[10px] text-ink-soft px-[5px] py-px rounded-[2px] bg-paper-deep">
            {hotel.rating.toFixed(1)}
          </span>
          {hotel.googleRateInr && (
            <span className="font-mono text-[11px] text-ink-soft ml-auto">
              ₹{Math.round(hotel.googleRateInr / 1000)}k/n
            </span>
          )}
        </div>
        <div className="flex gap-[3px] flex-wrap mt-1">
          {hotel.isForaPreferred && (
            <span className="text-[9px] font-sans px-[5px] py-px rounded-sm" style={{ background: 'rgba(30,58,47,0.08)', color: '#1E3A2F' }}>
              Fora Preferred
            </span>
          )}
          {hotel.isVirtuoso && (
            <span className="text-[9px] font-sans px-[5px] py-px rounded-sm" style={{ background: 'rgba(169,139,82,0.1)', color: '#A98B52' }}>
              Virtuoso
            </span>
          )}
        </div>
      </div>

      {/* Add / Added */}
      <div className="self-center flex-shrink-0">
        {isAdded ? (
          <div
            className="flex items-center gap-[5px] px-2.5 py-[5px] text-success text-xs font-sans rounded-sm"
            style={{ background: 'rgba(46,107,69,0.08)', border: '1px solid rgba(46,107,69,0.25)' }}
          >
            <Check size={12} /> Added
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            disabled={isAdding}
            className="flex items-center gap-1 px-[9px] py-[5px] bg-spruce hover:bg-spruce-light text-white border-none rounded-sm text-[11px] font-medium cursor-pointer opacity-0 group-hover/result:opacity-100 transition-all disabled:opacity-50"
          >
            {isAdding ? <Loader2 size={11} className="spin" /> : <Plus size={11} />}
            Add
          </button>
        )}
      </div>
    </div>
  );
}
