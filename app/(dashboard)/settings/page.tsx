'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdvisorProfile {
  displayName: string | null;
  agencyName: string | null;
  tagline: string | null;
  email: string | null;
  whatsappNumber: string | null;
  foraAdvisorId: string | null;
  virtuosoMembership: string | null;
  iataNumber: string | null;
  quoteFooter: string | null;
}

const EMPTY: AdvisorProfile = {
  displayName: null, agencyName: null, tagline: null,
  email: null, whatsappNumber: null, foraAdvisorId: null,
  virtuosoMembership: null, iataNumber: null, quoteFooter: null,
};

function Field({
  label, value, onChange, placeholder, hint, mono = false, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; mono?: boolean; multiline?: boolean;
}) {
  const cls = `w-full rounded-[4px] border border-ink/12 bg-transparent px-3 py-2 text-[13px] text-ink outline-none focus:border-brass/60 focus:ring-0 transition-colors placeholder:text-ink/30 ${mono ? 'font-mono' : 'font-sans'}`;
  return (
    <div>
      <label className="block font-sans text-[11px] font-medium text-ink-soft uppercase tracking-[0.08em] mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          className={`${cls} resize-none min-h-[80px]`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          className={cls}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && <p className="mt-1 font-sans text-[11px] text-ink/40">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-ink/8 bg-white p-6 space-y-5">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-brass mb-1">{title}</div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<AdvisorProfile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/advisor-profile')
      .then(r => r.json())
      .then(data => {
        if (data) setProfile(prev => ({ ...prev, ...data }));
      })
      .finally(() => setLoading(false));
  }, []);

  const field = useCallback((key: keyof AdvisorProfile) => ({
    value: profile[key] ?? '',
    onChange: (v: string) => setProfile(prev => ({ ...prev, [key]: v })),
  }), [profile]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/advisor-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="font-mono text-[11px] text-ink/30 uppercase tracking-widest">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-2xl text-ink tracking-tight">Settings</h1>
          <p className="font-sans text-[13px] text-ink/50 mt-0.5">Your advisor profile and credentials</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[4px] px-4 py-2 font-sans text-[13px] font-medium transition-colors disabled:opacity-60"
          style={{
            background: saved ? '#2E6B45' : '#1E3A2F',
            color: 'white',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Display name"
            placeholder="Abhilaksh Lalwani"
            hint="Your name as shown on quotes and preview pages"
            {...field('displayName')}
          />
          <Field
            label="Agency name"
            placeholder="Alp Travel Co."
            {...field('agencyName')}
          />
        </div>
        <Field
          label="Tagline"
          placeholder="Independent Fora Pro advisor · Virtuoso"
          hint="Appears in the quote preview header"
          {...field('tagline')}
        />
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            placeholder="abhilaksh@alptravel.co"
            hint="Used in quote email templates"
            {...field('email')}
          />
          <Field
            label="WhatsApp number"
            placeholder="+919870400235"
            hint="Used in CTA buttons across quotes"
            mono
            {...field('whatsappNumber')}
          />
        </div>
      </Section>

      {/* Credentials */}
      <Section title="Travel credentials">
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="IATA number"
            placeholder="33520476"
            mono
            {...field('iataNumber')}
          />
          <Field
            label="Fora advisor ID"
            placeholder="42fa9698-…"
            mono
            hint="UUID from Fora portal"
            {...field('foraAdvisorId')}
          />
          <Field
            label="Virtuoso membership"
            placeholder="VIR-XXXXXX"
            mono
            {...field('virtuosoMembership')}
          />
        </div>
      </Section>

      {/* Quote footer */}
      <Section title="Quote footer">
        <Field
          label="Footer text"
          placeholder="Alp Travel Co. · Independent Fora Pro advisor · IATA #33520476 · Affiliated with Virtuoso"
          hint="Appears at the bottom of every client preview page"
          multiline
          {...field('quoteFooter')}
        />
      </Section>
    </div>
  );
}
