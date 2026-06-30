'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MessageCircle, Plus, Map,
  Utensils, Accessibility, BedDouble, Plane, MapPin, ThumbsDown, Wallet, Users,
} from 'lucide-react';import type { Client, Trip } from '@/lib/db/schema';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface ClientPreferences {
  dietary: string[];
  mobility: string;
  roomPref: string;
  airlineTier: string;
  commPref: string;
  decisionMaker: string;
  budgetTier: string;
  priorDestinations: string[];
  disliked: string;
  customNote: string;
}

const EMPTY_PREFS: ClientPreferences = {
  dietary: [], mobility: '', roomPref: '', airlineTier: '',
  commPref: '', decisionMaker: '', budgetTier: '',
  priorDestinations: [], disliked: '', customNote: '',
};

function parsePrefs(raw: string | null | undefined): ClientPreferences {
  if (!raw) return { ...EMPTY_PREFS };
  try {
    const p = JSON.parse(raw);
    return {
      dietary:           Array.isArray(p.dietary) ? p.dietary : [],
      mobility:          p.mobility ?? '',
      roomPref:          p.roomPref ?? '',
      airlineTier:       p.airlineTier ?? '',
      commPref:          p.commPref ?? '',
      decisionMaker:     p.decisionMaker ?? '',
      budgetTier:        p.budgetTier ?? '',
      priorDestinations: Array.isArray(p.priorDestinations) ? p.priorDestinations : [],
      disliked:          p.disliked ?? '',
      customNote:        p.customNote ?? '',
    };
  } catch { return { ...EMPTY_PREFS }; }
}

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Kosher',
  'No shellfish', 'No pork', 'No nuts', 'Lactose-free',
];

const COMM_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
];

const DECISION_OPTIONS = [
  { value: 'solo', label: 'Solo decider' },
  { value: 'leads', label: 'Leads the decision' },
  { value: 'joint', label: 'Joint decision' },
  { value: 'follows', label: "Follows partner's lead" },
];

const BUDGET_OPTIONS = [
  { value: 'comfort', label: 'Comfort' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'ultra', label: 'Ultra-luxury' },
];

/* ─── Fetcher ────────────────────────────────────────────────────────────────── */

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type ClientDetail = Client & { trips: Trip[] };

/* ─── Main page ────────────────────────────────────────────────────────────────── */

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, mutate } = useSWR<ClientDetail>(`/api/clients/${params.id}`, fetcher);
  const [saving, setSaving] = useState<string | null>(null);

  const prefs = parsePrefs(data?.preferences);

  const saveField = useCallback(async (field: keyof Client, value: string) => {
    setSaving(field as string);
    try {
      await fetch(`/api/clients/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      mutate();
    } finally {
      setSaving(null);
    }
  }, [params.id, mutate]);

  const savePrefs = useCallback(async (next: Partial<ClientPreferences>) => {
    const merged = { ...prefs, ...next };
    setSaving('preferences');
    try {
      await fetch(`/api/clients/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: JSON.stringify(merged) }),
      });
      mutate();
    } finally {
      setSaving(null);
    }
  }, [params.id, prefs, mutate]);

  if (!data) {
    return (
      <div className="flex-1 p-6">
        <div className="space-y-4">
          <div className="h-14 w-64 bg-paper-deep rounded-lg animate-pulse" />
          <div className="h-48 bg-paper-deep rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const initials = data.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto bg-paper" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>

      {/* Topbar */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white" style={{ borderBottom: '1px solid rgba(22,26,23,0.09)' }}>
        <Link href="/clients" className="text-ink-mute hover:text-ink transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-display text-sm flex-shrink-0"
            style={{ background: 'rgba(30,58,47,0.1)', color: '#1E3A2F' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <InlineEdit
              value={data.name}
              onSave={v => saveField('name', v)}
              className="font-display text-lg text-ink leading-tight"
            />
            {data.nationality && (
              <p className="text-xs text-ink-mute">{data.nationality}</p>
            )}
          </div>
        </div>
        <Link
          href={`/trips/new?clientId=${data.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-sans font-medium text-white bg-spruce px-3 py-[6px] rounded-[4px] hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={12} /> New trip
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-7 space-y-7">

        {/* ── LTV Stats ─────────────────────────────────────────────── */}
        {data.trips && data.trips.length > 0 && (() => {
          const tripList = data.trips as Trip[];
          const totalQuoted = tripList.reduce((s, t) => s + (t.totalFromInr ?? 0), 0);
          const bookedCount = tripList.filter(t => t.status === 'booked').length;
          const sentCount = tripList.filter(t => t.status === 'sent').length;
          const acceptedCount = tripList.filter(t => t.status === 'accepted').length;

          function inr(n: number) {
            if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
            if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
            if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
            return `₹${n.toLocaleString('en-IN')}`;
          }

          return (
            <div
              className="grid grid-cols-4 gap-2 mb-1"
            >
              {[
                { label: 'Total trips', value: String(tripList.length) },
                { label: 'Total quoted', value: totalQuoted > 0 ? inr(totalQuoted) : '—' },
                { label: 'Booked', value: String(bookedCount) },
                { label: 'Awaiting', value: String(sentCount + acceptedCount) },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-[5px] px-3.5 py-3 bg-white"
                  style={{ border: '1px solid rgba(22,26,23,0.08)' }}
                >
                  <div className="font-mono text-[18px] text-ink leading-none mb-[3px]">{stat.value}</div>
                  <div className="font-sans text-[9px] uppercase tracking-[0.1em] text-ink-mute">{stat.label}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Contact ─────────────────────────────────────────────── */}
        <ProfileSection title="Contact">
          <ProfileRow icon={<Mail size={13} />} label="Email">
            <InlineEdit value={data.email ?? ''} placeholder="Add email" onSave={v => saveField('email', v)} />
          </ProfileRow>
          <ProfileRow icon={<Phone size={13} />} label="Phone">
            <InlineEdit value={data.phone ?? ''} placeholder="Add phone" onSave={v => saveField('phone', v)} />
          </ProfileRow>
          <ProfileRow icon={<MessageCircle size={13} />} label="WhatsApp">
            <div className="flex items-center gap-3">
              <InlineEdit value={data.whatsapp ?? ''} placeholder="Add WhatsApp" onSave={v => saveField('whatsapp', v)} />
              {data.whatsapp && (
                <a
                  href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-brass hover:underline flex-shrink-0"
                >
                  Open ↗
                </a>
              )}
            </div>
          </ProfileRow>
          <ProfileRow label="Communication preference">
            <ChipSelect
              options={COMM_OPTIONS}
              value={prefs.commPref}
              onSelect={v => savePrefs({ commPref: v })}
            />
          </ProfileRow>
          <ProfileRow label="Decision dynamic">
            <ChipSelect
              options={DECISION_OPTIONS}
              value={prefs.decisionMaker}
              onSelect={v => savePrefs({ decisionMaker: v })}
            />
          </ProfileRow>
        </ProfileSection>

        {/* ── Travel identity ─────────────────────────────────────── */}
        <ProfileSection title="Travel identity">
          <ProfileRow icon={<MapPin size={13} />} label="Nationality">
            <InlineEdit value={data.nationality ?? ''} placeholder="Add nationality" onSave={v => saveField('nationality', v)} />
          </ProfileRow>
          <ProfileRow label="Passport expiry">
            <InlineEdit value={data.passportExpiry ?? ''} placeholder="YYYY-MM-DD" onSave={v => saveField('passportExpiry', v)} mono />
          </ProfileRow>
          <ProfileRow icon={<Wallet size={13} />} label="Budget tier">
            <ChipSelect
              options={BUDGET_OPTIONS}
              value={prefs.budgetTier}
              onSelect={v => savePrefs({ budgetTier: v })}
            />
          </ProfileRow>
        </ProfileSection>

        {/* ── Preferences ─────────────────────────────────────────── */}
        <ProfileSection title="Preferences">
          <ProfileRow icon={<Utensils size={13} />} label="Dietary restrictions">
            <TagCheckboxes
              options={DIETARY_OPTIONS}
              selected={prefs.dietary}
              onChange={v => savePrefs({ dietary: v })}
            />
          </ProfileRow>
          <ProfileRow icon={<BedDouble size={13} />} label="Room preference">
            <InlineEdit
              value={prefs.roomPref}
              placeholder="e.g. high floor, sea view, king bed"
              onSave={v => savePrefs({ roomPref: v })}
            />
          </ProfileRow>
          <ProfileRow icon={<Plane size={13} />} label="Airline / cabin tier">
            <InlineEdit
              value={prefs.airlineTier}
              placeholder="e.g. Business class, Air India preferred"
              onSave={v => savePrefs({ airlineTier: v })}
            />
          </ProfileRow>
          <ProfileRow icon={<Accessibility size={13} />} label="Mobility / special needs">
            <InlineEdit
              value={prefs.mobility}
              placeholder="Any mobility limitations or special requirements"
              onSave={v => savePrefs({ mobility: v })}
            />
          </ProfileRow>
        </ProfileSection>

        {/* ── History ─────────────────────────────────────────────── */}
        <ProfileSection title="Trip history">
          <ProfileRow icon={<Map size={13} />} label="Prior destinations">
            <TagInput
              tags={prefs.priorDestinations}
              placeholder="Type a destination + Enter"
              onChange={v => savePrefs({ priorDestinations: v })}
            />
          </ProfileRow>
          <ProfileRow icon={<ThumbsDown size={13} />} label="What they disliked on past trips">
            <InlineEdit
              value={prefs.disliked}
              placeholder="e.g. too regimented, shared excursions, poor transfer vehicles"
              onSave={v => savePrefs({ disliked: v })}
              multiline
            />
          </ProfileRow>
        </ProfileSection>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <ProfileSection title="Advisor notes">
          <div className="px-4 py-3">
            <InlineEdit
              value={data.notes ?? ''}
              placeholder="Private advisor notes — never shown to client"
              onSave={v => saveField('notes', v)}
              multiline
            />
          </div>
        </ProfileSection>

        {/* ── Trips ────────────────────────────────────────────────── */}
        <ProfileSection title={`Trips (${data.trips?.length ?? 0})`} noChildren>
          {data.trips?.length > 0 ? (
            <div className="divide-y" style={{ borderTop: '1px solid rgba(22,26,23,0.06)' }}>
              {data.trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors group"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[13px] font-display text-ink group-hover:text-spruce truncate transition-colors">{trip.label}</span>
                    <span className="text-[11px] text-ink-mute capitalize">{trip.status}</span>
                  </div>
                  <span className="text-[11px] text-ink-mute font-sans flex-shrink-0 ml-3">
                    {new Date(trip.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-ink-mute">
              No trips yet.{' '}
              <Link href={`/trips/new?clientId=${data.id}`} className="text-brass hover:underline">Create one →</Link>
            </div>
          )}
        </ProfileSection>
      </div>

      {saving && (
        <div className="fixed bottom-5 right-5 text-[11px] font-sans text-ink-mute bg-white border border-glacier rounded-md px-3 py-1.5 shadow-sm">
          Saving…
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function ProfileSection({ title, children, noChildren = false }: { title: string; children?: React.ReactNode; noChildren?: boolean }) {
  return (
    <div className="bg-white rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(22,26,23,0.09)', boxShadow: '0 1px 3px rgba(22,26,23,0.04)' }}>
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(22,26,23,0.06)', background: 'rgba(22,26,23,0.02)' }}>
        <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.09em] text-ink-mute">{title}</span>
      </div>
      {!noChildren && (
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          {children}
        </div>
      )}
      {noChildren && children}
    </div>
  );
}

function ProfileRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(22,26,23,0.05)' }}>
      <div className="flex items-center gap-1.5 w-[140px] flex-shrink-0 pt-0.5">
        {icon && <span className="text-ink-mute">{icon}</span>}
        <span className="text-[11px] text-ink-soft font-sans">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function InlineEdit({
  value, placeholder, onSave, className = '', mono = false, multiline = false,
}: {
  value: string; placeholder?: string; onSave: (v: string) => void;
  className?: string; mono?: boolean; multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      autoFocus: true,
      className: `w-full bg-transparent outline-none text-ink border-b border-brass ${mono ? 'font-mono text-[11px]' : 'font-sans text-[13px]'} ${className}`,
      onBlur: () => { onSave(draft); setEditing(false); },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) { onSave(draft); setEditing(false); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      },
    };
    return multiline
      ? <textarea {...shared} rows={3} style={{ resize: 'none' }} />
      : <input {...shared} type="text" />;
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`text-left w-full hover:text-brass transition-colors ${mono ? 'font-mono text-[11px]' : 'font-sans text-[13px]'} ${className}`}
      style={{ color: value ? undefined : undefined }}
    >
      {value || <span className="text-ink-mute italic text-[12px]">{placeholder ?? 'Add…'}</span>}
    </button>
  );
}

function ChipSelect({ options, value, onSelect }: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onSelect(value === o.value ? '' : o.value)}
          className="text-[11px] font-sans px-2.5 py-[3px] rounded-sm transition-colors cursor-pointer"
          style={{
            background: value === o.value ? 'rgba(30,58,47,0.1)' : 'rgba(22,26,23,0.05)',
            color: value === o.value ? '#1E3A2F' : '#4A514B',
            border: `1px solid ${value === o.value ? 'rgba(30,58,47,0.25)' : 'rgba(22,26,23,0.1)'}`,
            fontWeight: value === o.value ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TagCheckboxes({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => toggle(opt)}
          className="text-[11px] font-sans px-2.5 py-[3px] rounded-sm transition-colors cursor-pointer"
          style={{
            background: selected.includes(opt) ? 'rgba(169,139,82,0.1)' : 'rgba(22,26,23,0.05)',
            color: selected.includes(opt) ? '#A98B52' : '#4A514B',
            border: `1px solid ${selected.includes(opt) ? 'rgba(169,139,82,0.3)' : 'rgba(22,26,23,0.1)'}`,
            fontWeight: selected.includes(opt) ? 600 : 400,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function TagInput({ tags, placeholder, onChange }: {
  tags: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-[11px] font-sans px-2.5 py-[3px] rounded-sm"
            style={{ background: 'rgba(30,58,47,0.08)', color: '#1E3A2F', border: '1px solid rgba(30,58,47,0.18)' }}
          >
            {t}
            <button
              onClick={() => onChange(tags.filter(x => x !== t))}
              className="text-ink-mute hover:text-danger transition-colors ml-0.5 leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type + Enter'}
          className="text-[12px] font-sans text-ink bg-transparent border-b border-glacier outline-none py-0.5 flex-1 placeholder:text-ink-mute"
          onFocus={e => (e.currentTarget.style.borderBottomColor = '#A98B52')}
          onBlur={e => { e.currentTarget.style.borderBottomColor = '#C9D2CC'; if (input.trim()) add(); }}
        />
      </div>
    </div>
  );
}
