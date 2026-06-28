'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { UserPlus, Search, ChevronRight, Phone, Mail } from 'lucide-react';
import type { Client } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClientsPage() {
  const { data: clients, mutate } = useSWR<Client[]>('/api/clients', fetcher);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);

  const filtered = (clients ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-glacier bg-white">
        <h1 className="font-display text-xl text-ink">Clients</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-spruce hover:bg-spruce-light text-white text-sm rounded transition-colors"
        >
          <UserPlus size={15} />
          <span className="hidden sm:inline">New client</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-glacier rounded focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {!clients && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-paper-deep rounded animate-pulse" />
            ))}
          </div>
        )}

        {clients && filtered.length === 0 && (
          <div className="text-center py-20 text-ink-mute">
            {query ? (
              <p className="text-sm">No clients match &ldquo;{query}&rdquo;</p>
            ) : (
              <>
                <p className="font-display text-xl text-ink mb-2">No clients yet</p>
                <p className="text-sm mb-6">Add your first client to get started.</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="px-4 py-2 bg-spruce text-white text-sm rounded hover:bg-spruce-light transition-colors"
                >
                  Add client
                </button>
              </>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="divide-y divide-glacier">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between py-4 hover:bg-paper-deep -mx-2 px-2 rounded transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-spruce/10 flex items-center justify-center text-spruce font-display text-sm flex-shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{client.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {client.email && (
                        <span className="text-xs text-ink-mute flex items-center gap-1">
                          <Mail size={11} />
                          {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="text-xs text-ink-mute flex items-center gap-1">
                          <Phone size={11} />
                          {client.phone}
                        </span>
                      )}
                      {client.nationality && (
                        <span className="text-xs text-ink-mute">{client.nationality}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className="text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity"
                  size={16}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New client modal */}
      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreated={() => { mutate(); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    nationality: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-glacier flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">New client</h2>
          <button onClick={onClose} className="text-ink-mute hover:text-ink text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">
              Name <span className="text-danger">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Nikita Sharma"
              className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="nikita@example.com"
                className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">Nationality</label>
              <input
                value={form.nationality}
                onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                placeholder="Indian"
                className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Dietary preferences, travel style, anything useful…"
              className="w-full px-3 py-2 border border-glacier rounded text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass resize-none"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-ink-soft hover:text-ink border border-glacier rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm bg-spruce hover:bg-spruce-light text-white rounded disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
