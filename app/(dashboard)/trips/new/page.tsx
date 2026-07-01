'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ClientPicker, type ClientSelection } from '@/components/shared/client-picker';

export default function NewTripPage() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [clientSelection, setClientSelection] = useState<ClientSelection>({});
  const [adults, setAdults] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          clientId: clientSelection.clientId,
          clientName: clientSelection.clientName,
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
        <ClientPicker onChange={setClientSelection} />

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
