'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';

interface ClientOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function NewTripPage() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(res => (res.ok ? res.json() : []))
      .then((data: ClientOption[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setClientsLoaded(true));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filteredClients = clientQuery.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    : clients;

  function pickClient(c: ClientOption) {
    setSelectedClient(c);
    setClientQuery(c.name);
    setDropdownOpen(false);
  }

  function clearSelection() {
    setSelectedClient(null);
    setClientQuery('');
    setDropdownOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          clientId: selectedClient?.id,
          clientName: !selectedClient ? clientQuery.trim() || undefined : undefined,
          adults,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create trip');
      }

      const { id } = await res.json();
      router.push(`/trips/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 py-10">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink-soft mb-8 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to trips
      </Link>

      {/* Heading */}
      <h1 className="font-display text-3xl text-ink mb-8">New trip</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Trip label */}
        <div>
          <label
            htmlFor="label"
            className="block text-sm font-medium text-ink-soft mb-1.5"
          >
            Trip label
          </label>
          <input
            id="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Nikita: Greece, Aug 2026"
            className="w-full px-3.5 py-2.5 bg-white border border-glacier rounded-md text-sm text-ink placeholder:text-ink-mute/60 focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
          />
        </div>

        {/* Client picker */}
        <div ref={containerRef} className="relative">
          <label
            htmlFor="clientQuery"
            className="block text-sm font-medium text-ink-soft mb-1.5"
          >
            Client
            <span className="ml-1.5 text-ink-mute font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="clientQuery"
              type="text"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setSelectedClient(null);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search existing clients or type a new name"
              className="w-full px-3.5 py-2.5 pr-9 bg-white border border-glacier rounded-md text-sm text-ink placeholder:text-ink-mute/60 focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
            />
            {selectedClient ? (
              <button
                type="button"
                onClick={clearSelection}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-soft"
                aria-label="Clear selected client"
              >
                <Check size={16} className="text-spruce" />
              </button>
            ) : (
              <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
            )}
          </div>

          {dropdownOpen && clientsLoaded && !selectedClient && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-glacier rounded-md shadow-md max-h-56 overflow-y-auto">
              {filteredClients.length > 0 ? (
                filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickClient(c)}
                    className="w-full text-left px-3.5 py-2 text-sm hover:bg-paper-deep transition-colors flex flex-col"
                  >
                    <span className="text-ink">{c.name}</span>
                    {(c.email || c.phone) && (
                      <span className="text-xs text-ink-mute">{c.email || c.phone}</span>
                    )}
                  </button>
                ))
              ) : clientQuery.trim() ? (
                <div className="px-3.5 py-2.5 text-sm text-ink-mute">
                  No match — <span className="text-ink">&ldquo;{clientQuery.trim()}&rdquo;</span> will be created as a new client
                </div>
              ) : (
                <div className="px-3.5 py-2.5 text-sm text-ink-mute">No clients yet — type a name to create one</div>
              )}
            </div>
          )}
        </div>

        {/* Adults */}
        <div>
          <label
            htmlFor="adults"
            className="block text-sm font-medium text-ink-soft mb-1.5"
          >
            Adults
          </label>
          <input
            id="adults"
            type="number"
            min={1}
            max={20}
            required
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-28 px-3.5 py-2.5 bg-white border border-glacier rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !label.trim()}
            className="bg-spruce text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-spruce-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating…' : 'Create trip'}
          </button>
        </div>
      </form>
    </div>
  );
}
