'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Loader2, AlertCircle, ArrowLeft, Repeat, ArrowRight } from 'lucide-react';

export interface FlightLeg {
  airline: string | null;
  flight_number: string | null;
  from: string | null;
  to: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  duration: string | null;
  durationMinutes: number | null;
  stops: number;
}

export interface FlightItinerary {
  ignavId: string | null;
  cabinClass: string | null;
  priceAmount: number | null;
  currency: string | null;
  outbound: FlightLeg;
  inbound: FlightLeg | null;
}

interface AirportOption { code: string; name: string; city: string; country: string; }

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
}

function AirportInput({ value, onChange, placeholder }: { value: string; onChange: (code: string) => void; placeholder: string }) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(value), [value]);

  function handleInput(v: string) {
    setQuery(v);
    onChange(v.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setOptions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/airports?q=${encodeURIComponent(v)}`);
        const data = await res.json();
        setOptions(data.results ?? []);
        setOpen(true);
      } catch { /* ignore */ }
    }, 300);
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-2.5 py-[7px] border border-glacier rounded-sm font-mono text-xs uppercase text-ink bg-paper outline-none transition-colors"
      />
      {open && options.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-glacier rounded-sm shadow-lg max-h-[180px] overflow-y-auto">
          {options.map(a => (
            <button
              key={a.code}
              onMouseDown={() => { onChange(a.code); setQuery(a.code); setOpen(false); }}
              className="w-full text-left px-2.5 py-[6px] text-[11px] font-sans hover:bg-paper transition-colors cursor-pointer flex items-center gap-2"
            >
              <span className="font-mono text-[11px] text-spruce font-semibold">{a.code}</span>
              <span className="text-ink-soft truncate">{a.city}, {a.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FlightSearchPanelProps {
  destinations: { id: number; name: string }[];
  activeDestinationId: number;
  destCheckin?: string | null;
  destCheckout?: string | null;
  defaultAdults?: number;
  onAddOneWay: (itin: FlightItinerary, destinationId: number, passengerCount: number) => Promise<void>;
  onAddRoundTrip: (itin: FlightItinerary, outboundDestinationId: number, inboundDestinationId: number, passengerCount: number) => Promise<void>;
  onClose: () => void;
}

export function FlightSearchPanel({
  destinations, activeDestinationId, destCheckin, destCheckout, defaultAdults,
  onAddOneWay, onAddRoundTrip, onClose,
}: FlightSearchPanelProps) {
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(() => destCheckin || localDate(1));
  const [returnDate, setReturnDate] = useState(() => destCheckout || localDate(4));
  const [adults, setAdults] = useState(defaultAdults ?? 1);
  const [children, setChildren] = useState(0);
  const [cabinClass, setCabinClass] = useState('economy');
  const [maxStops, setMaxStops] = useState<string>('any');
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'stops'>('price');
  const [results, setResults] = useState<FlightItinerary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmingRoundTrip, setConfirmingRoundTrip] = useState<FlightItinerary | null>(null);
  const [outboundDestId, setOutboundDestId] = useState(activeDestinationId);
  const [inboundDestId, setInboundDestId] = useState(activeDestinationId);

  const sortedResults = useMemo(() => {
    const totalMinutes = (itin: FlightItinerary) =>
      (itin.outbound.durationMinutes ?? 0) + (itin.inbound?.durationMinutes ?? 0);
    const totalStops = (itin: FlightItinerary) =>
      itin.outbound.stops + (itin.inbound?.stops ?? 0);
    const sorted = [...results];
    if (sortBy === 'price') {
      sorted.sort((a, b) => (a.priceAmount ?? Infinity) - (b.priceAmount ?? Infinity));
    } else if (sortBy === 'duration') {
      sorted.sort((a, b) => totalMinutes(a) - totalMinutes(b));
    } else {
      sorted.sort((a, b) => totalStops(a) - totalStops(b));
    }
    return sorted;
  }, [results, sortBy]);

  async function doSearch() {
    if (!origin || !destination || !departureDate) return;
    if (tripType === 'round_trip' && !returnDate) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/search/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin, destination, departureDate,
          returnDate: tripType === 'round_trip' ? returnDate : undefined,
          adults, children, cabinClass,
          maxStops: maxStops === 'any' ? undefined : Number(maxStops),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.requiresApiKey) {
          throw new Error('An Ignav API key is required for flight search. Add one in Settings → Integrations.');
        }
        throw new Error(body?.error ?? 'Search failed');
      }
      const data = await res.json();
      setResults(data.results ?? []);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setStatus('error');
    }
  }

  async function handleAddOneWay(itin: FlightItinerary) {
    const key = itin.ignavId ?? Math.random().toString();
    setAdding(key);
    try {
      await onAddOneWay(itin, activeDestinationId, adults + children);
    } finally {
      setAdding(null);
    }
  }

  async function handleConfirmRoundTrip() {
    if (!confirmingRoundTrip) return;
    const key = confirmingRoundTrip.ignavId ?? Math.random().toString();
    setAdding(key);
    try {
      await onAddRoundTrip(confirmingRoundTrip, outboundDestId, inboundDestId, adults + children);
      setConfirmingRoundTrip(null);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-white px-4 pt-4 pb-3 z-10" style={{ borderBottom: '1px solid rgba(22,26,23,0.06)' }}>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-[10px] font-sans text-ink-mute hover:text-spruce transition-colors mb-2.5 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <ArrowLeft size={11} /> Back to hotel search
        </button>

        <div className="text-[10px] font-semibold tracking-[0.09em] uppercase text-ink-mute mb-2.5">
          Search flights <span className="text-spruce">(Ignav)</span>
        </div>

        <div className="flex gap-[2px] mb-2.5">
          {(['one_way', 'round_trip'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTripType(t); setResults([]); setStatus('idle'); }}
              className="text-[10px] font-sans px-2.5 py-[4px] rounded-sm transition-colors cursor-pointer"
              style={{
                background: tripType === t ? '#1E3A2F' : 'transparent',
                color: tripType === t ? '#F6F4EE' : '#4A514B',
                border: `1px solid ${tripType === t ? '#1E3A2F' : '#C9D2CC'}`,
              }}
            >
              {t === 'one_way' ? 'One-way' : 'Round trip'}
            </button>
          ))}
        </div>

        <div className="flex gap-[5px] mb-2 items-center">
          <AirportInput value={origin} onChange={setOrigin} placeholder="From (e.g. DEL)" />
          <ArrowRight size={12} className="text-ink-mute flex-shrink-0" />
          <AirportInput value={destination} onChange={setDestination} placeholder="To (e.g. ATH)" />
        </div>

        <div className="flex gap-[5px] mb-2">
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Departure</label>
            <input
              type="date" value={departureDate} min={localDate(1)}
              onChange={e => setDepartureDate(e.target.value)}
              className="w-full px-2 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none"
            />
          </div>
          {tripType === 'round_trip' && (
            <div className="flex-1">
              <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Return</label>
              <input
                type="date" value={returnDate} min={departureDate}
                onChange={e => setReturnDate(e.target.value)}
                className="w-full px-2 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex gap-[5px] mb-2">
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Adults</label>
            <input
              type="number" min={1} max={9} value={adults}
              onChange={e => setAdults(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-2 py-[5px] border border-glacier rounded-sm font-mono text-[11px] text-ink bg-paper outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Children</label>
            <input
              type="number" min={0} max={8} value={children}
              onChange={e => setChildren(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-2 py-[5px] border border-glacier rounded-sm font-mono text-[11px] text-ink bg-paper outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Cabin</label>
            <select
              value={cabinClass} onChange={e => setCabinClass(e.target.value)}
              className="w-full px-1.5 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none cursor-pointer"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Stops</label>
            <select
              value={maxStops} onChange={e => setMaxStops(e.target.value)}
              className="w-full px-1.5 py-[5px] border border-glacier rounded-sm font-sans text-[11px] text-ink bg-paper outline-none cursor-pointer"
            >
              <option value="any">Any</option>
              <option value="0">Nonstop</option>
              <option value="1">1 stop max</option>
              <option value="2">2 stops max</option>
            </select>
          </div>
        </div>

        <button
          onClick={doSearch}
          disabled={status === 'loading' || !origin || !destination || !departureDate}
          className="w-full flex items-center justify-center gap-[5px] px-3 py-[7px] bg-spruce hover:bg-spruce-light text-white border-none rounded-sm font-sans text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
          Search flights
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-5">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-10 text-ink-mute text-[13px] font-sans text-center">
            <Loader2 size={24} className="spin text-brass" />
            <span>Searching Ignav…</span>
          </div>
        )}

        {status === 'error' && error && (
          <div className="mx-1 mt-3 p-4 rounded" style={{ background: 'rgba(139,47,47,0.05)', border: '1px solid rgba(139,47,47,0.2)' }}>
            <div className="flex items-center gap-2 text-danger text-[13px] font-sans mb-2.5">
              <AlertCircle size={14} /> {error}
            </div>
            <button onClick={doSearch} className="px-3.5 py-1.5 bg-danger text-paper border-none rounded-sm text-xs cursor-pointer font-sans">
              Retry
            </button>
          </div>
        )}

        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <Repeat size={32} className="text-glacier mb-3" />
            <p className="font-display text-base text-ink-soft mb-1">Search for flights</p>
            <p className="text-xs text-ink-mute leading-relaxed">
              Enter route and dates to see live Ignav fares. Note: Ignav returns one blended fare for the passengers searched — it doesn&apos;t break out adult/child/infant pricing separately. Paste an airline confirmation into a rate card afterward for that breakdown.
            </p>
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="font-display text-base text-ink-soft mb-1">No results</p>
            <p className="text-xs text-ink-mute">Try different dates or airports.</p>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <div className="flex flex-col gap-[7px] pt-1.5">
            <div className="flex items-center gap-[6px] px-1 mb-0.5">
              <span className="text-[9px] uppercase tracking-[0.07em] text-ink-mute">Sort</span>
              {(['price', 'duration', 'stops'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className="text-[10px] font-sans px-2 py-[3px] rounded-full border cursor-pointer transition-all"
                  style={{
                    background: sortBy === s ? '#1E3A2F' : 'transparent',
                    color: sortBy === s ? '#F6F4EE' : '#4A514B',
                    borderColor: sortBy === s ? '#1E3A2F' : '#C9D2CC',
                  }}
                >
                  {s === 'price' ? 'Price' : s === 'duration' ? 'Duration' : 'Fewest stops'}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-ink-mute font-mono">{sortedResults.length} results</span>
            </div>
            {sortedResults.map((itin, idx) => (
              <ItineraryCard
                key={itin.ignavId ?? idx}
                itin={itin}
                isAdding={adding === (itin.ignavId ?? String(idx))}
                onAdd={() => itin.inbound ? setConfirmingRoundTrip(itin) : handleAddOneWay(itin)}
              />
            ))}
          </div>
        )}
      </div>

      {confirmingRoundTrip && (
        <div className="fixed inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(22,26,23,0.35)' }}>
          <div className="bg-white rounded-[6px] p-5 w-[320px]" style={{ boxShadow: '0 8px 30px rgba(22,26,23,0.2)' }}>
            <div className="font-display text-[15px] text-ink mb-1">Assign each leg to a destination</div>
            <p className="text-[11px] text-ink-mute mb-3">Round-trip flights are added as two separate items.</p>
            <div className="mb-3">
              <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Outbound leg → destination</label>
              <select
                value={outboundDestId} onChange={e => setOutboundDestId(Number(e.target.value))}
                className="w-full px-2 py-[6px] border border-glacier rounded-sm font-sans text-[12px] text-ink bg-paper outline-none cursor-pointer"
              >
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-[9px] font-medium uppercase tracking-[0.07em] text-ink-mute mb-[3px]">Inbound leg → destination</label>
              <select
                value={inboundDestId} onChange={e => setInboundDestId(Number(e.target.value))}
                className="w-full px-2 py-[6px] border border-glacier rounded-sm font-sans text-[12px] text-ink bg-paper outline-none cursor-pointer"
              >
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmingRoundTrip(null)}
                className="px-3 py-[6px] text-[12px] font-sans text-ink-mute border border-glacier rounded-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRoundTrip}
                disabled={adding !== null}
                className="px-3 py-[6px] text-[12px] font-sans font-medium text-white bg-spruce rounded-sm cursor-pointer disabled:opacity-50"
              >
                Add both legs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegRow({ leg }: { leg: FlightLeg }) {
  return (
    <div className="flex items-center gap-[7px] text-[11px] font-sans text-ink-soft">
      <span className="font-mono text-[10px] text-spruce font-semibold">{leg.flight_number ?? '—'}</span>
      <span className="truncate">{leg.airline}</span>
      <span className="ml-auto flex items-center gap-[5px] font-mono text-[10px] text-ink-mute">
        <span>{leg.from}</span>
        {leg.departure_datetime?.slice(11, 16)}
        <span>→</span>
        <span>{leg.to}</span>
        {leg.arrival_datetime?.slice(11, 16)}
      </span>
    </div>
  );
}

function ItineraryCard({ itin, isAdding, onAdd }: { itin: FlightItinerary; isAdding: boolean; onAdd: () => void }) {
  const stopsLabel = (n: number) => n === 0 ? 'Nonstop' : `${n} stop${n > 1 ? 's' : ''}`;
  return (
    <div className="p-[10px] rounded-[4px] border border-transparent bg-paper transition-all group/result" style={{ transition: 'border-color 0.14s' }}>
      <div className="flex flex-col gap-1.5">
        <LegRow leg={itin.outbound} />
        {itin.inbound && <LegRow leg={itin.inbound} />}
      </div>
      <div className="flex items-center gap-[7px] mt-2">
        <span className="text-[9px] px-[5px] py-px rounded-sm bg-paper-deep text-ink-mute font-sans">
          {stopsLabel(itin.outbound.stops)}{itin.inbound ? ` out · ${stopsLabel(itin.inbound.stops)} back` : ''}
        </span>
        <span className="text-[9px] px-[5px] py-px rounded-sm bg-paper-deep text-ink-mute font-sans">{itin.outbound.duration}</span>
        {itin.cabinClass && (
          <span className="text-[9px] px-[5px] py-px rounded-sm bg-paper-deep text-ink-mute font-sans capitalize">{itin.cabinClass.replace('_', ' ')}</span>
        )}
        {itin.priceAmount != null && (
          <span className="font-mono text-[12px] text-ink ml-auto">
            {itin.currency === 'INR' ? '₹' : `${itin.currency} `}{itin.priceAmount.toLocaleString('en-IN')}
          </span>
        )}
        <button
          onClick={onAdd}
          disabled={isAdding}
          className="flex items-center gap-1 px-[9px] py-[5px] bg-spruce hover:bg-spruce-light text-white border-none rounded-sm text-[11px] font-medium cursor-pointer transition-all disabled:opacity-50"
        >
          {isAdding ? <Loader2 size={11} className="spin" /> : <Plus size={11} />}
          Add
        </button>
      </div>
    </div>
  );
}
