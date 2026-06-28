'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageCircle, Plus, Map } from 'lucide-react';
import type { Client, Trip } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ClientDetail = Client & { trips: Trip[] };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, mutate } = useSWR<ClientDetail>(`/api/clients/${params.id}`, fetcher);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data) {
    return (
      <div className="flex-1 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-paper-deep rounded" />
          <div className="h-32 bg-paper-deep rounded" />
        </div>
      </div>
    );
  }

  async function saveField(field: keyof Client, value: string) {
    setSaving(true);
    try {
      await fetch(`/api/clients/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      mutate();
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Topbar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-glacier bg-white">
        <Link href="/clients" className="text-ink-mute hover:text-ink transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-spruce/10 flex items-center justify-center text-spruce font-display text-sm flex-shrink-0">
            {data.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-lg text-ink leading-tight">{data.name}</h1>
            {data.nationality && (
              <p className="text-xs text-ink-mute">{data.nationality}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Contact info */}
        <section>
          <h2 className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-3">Contact</h2>
          <div className="bg-white rounded-lg border border-glacier divide-y divide-glacier">
            <EditableField label="Email" icon={<Mail size={14} />} value={data.email ?? ''} field="email" editing={editing} setEditing={setEditing} onSave={saveField} />
            <EditableField label="Phone" icon={<Phone size={14} />} value={data.phone ?? ''} field="phone" editing={editing} setEditing={setEditing} onSave={saveField} />
            <EditableField label="WhatsApp" icon={<MessageCircle size={14} />} value={data.whatsapp ?? ''} field="whatsapp" editing={editing} setEditing={setEditing} onSave={saveField} />
            {data.whatsapp && (
              <div className="px-4 py-3">
                <a
                  href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brass hover:text-brass-light transition-colors"
                >
                  Open WhatsApp conversation ↗
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Travel profile */}
        <section>
          <h2 className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-3">Travel profile</h2>
          <div className="bg-white rounded-lg border border-glacier divide-y divide-glacier">
            <EditableField label="Nationality" value={data.nationality ?? ''} field="nationality" editing={editing} setEditing={setEditing} onSave={saveField} />
            <EditableField label="Passport expiry" value={data.passportExpiry ?? ''} field="passportExpiry" editing={editing} setEditing={setEditing} onSave={saveField} />
            <EditableTextarea label="Preferences" value={data.preferences ?? ''} field="preferences" onSave={saveField} />
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-3">Notes</h2>
          <EditableTextarea label="Notes" value={data.notes ?? ''} field="notes" onSave={saveField} standalone />
        </section>

        {/* Trips */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-ink-soft uppercase tracking-wide">Trips</h2>
            <Link
              href={`/trips/new?clientId=${data.id}`}
              className="flex items-center gap-1 text-xs text-brass hover:text-brass-light transition-colors"
            >
              <Plus size={13} />
              New trip
            </Link>
          </div>
          {data.trips?.length > 0 ? (
            <div className="space-y-2">
              {data.trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between bg-white rounded-lg border border-glacier px-4 py-3 hover:border-brass transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Map size={15} className="text-ink-mute" />
                    <div>
                      <p className="text-sm font-medium text-ink">{trip.label}</p>
                      <p className="text-xs text-ink-mute capitalize">{trip.status}</p>
                    </div>
                  </div>
                  <span className="text-xs text-ink-mute group-hover:text-ink transition-colors">
                    {new Date(trip.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-mute italic">No trips yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function EditableField({
  label,
  icon,
  value,
  field,
  editing,
  setEditing,
  onSave,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  field: keyof Client;
  editing: string | null;
  setEditing: (f: string | null) => void;
  onSave: (field: keyof Client, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const isEditing = editing === field;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {icon && <span className="text-ink-mute">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-mute mb-0.5">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave(field, draft);
                if (e.key === 'Escape') setEditing(null);
              }}
              className="flex-1 text-sm border-b border-brass focus:outline-none bg-transparent"
            />
            <button onClick={() => onSave(field, draft)} className="text-xs text-brass">Save</button>
            <button onClick={() => setEditing(null)} className="text-xs text-ink-mute">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(value); setEditing(field as string); }}
            className="text-sm text-ink hover:text-brass transition-colors text-left w-full truncate"
          >
            {value || <span className="text-ink-mute italic">Add {label.toLowerCase()}</span>}
          </button>
        )}
      </div>
    </div>
  );
}

function EditableTextarea({
  label,
  value,
  field,
  onSave,
  standalone = false,
}: {
  label: string;
  value: string;
  field: keyof Client;
  onSave: (field: keyof Client, value: string) => void;
  standalone?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  const inner = (
    <div className="flex-1">
      {!standalone && <p className="text-xs text-ink-mute mb-1">{label}</p>}
      {isEditing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            rows={3}
            className="w-full text-sm border border-brass rounded p-2 focus:outline-none resize-none bg-transparent"
          />
          <div className="flex gap-2 mt-1">
            <button onClick={() => { onSave(field, draft); setIsEditing(false); }} className="text-xs text-brass">Save</button>
            <button onClick={() => setIsEditing(false)} className="text-xs text-ink-mute">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(value); setIsEditing(true); }}
          className="text-sm text-ink hover:text-brass transition-colors text-left w-full"
        >
          {value || <span className="text-ink-mute italic">Add {label.toLowerCase()}…</span>}
        </button>
      )}
    </div>
  );

  if (standalone) {
    return (
      <div className={`bg-white rounded-lg border border-glacier px-4 py-3 ${isEditing ? 'border-brass' : ''}`}>
        {inner}
      </div>
    );
  }

  return <div className="px-4 py-3">{inner}</div>;
}
