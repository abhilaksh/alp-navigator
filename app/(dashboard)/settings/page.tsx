'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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

interface IntegrationKeys {
  serpapiKey: string; ignavApiKey: string; pexelsApiKey: string; hapuppyApiKey: string;
  cloudflareAccountId: string; cloudflareImagesApiToken: string;
  r2AccountId: string; r2AccessKeyId: string; r2SecretAccessKey: string;
  r2BucketName: string; r2PublicUrlBase: string;
}

const EMPTY_KEYS: IntegrationKeys = {
  serpapiKey: '', ignavApiKey: '', pexelsApiKey: '', hapuppyApiKey: '',
  cloudflareAccountId: '', cloudflareImagesApiToken: '',
  r2AccountId: '', r2AccessKeyId: '', r2SecretAccessKey: '',
  r2BucketName: '', r2PublicUrlBase: '',
};

function Field({
  label, value, onChange, placeholder, hint, mono = false, multiline = false, secret = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; mono?: boolean; multiline?: boolean; secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const cls = `w-full rounded-[4px] border border-ink/12 bg-transparent px-3 py-2 text-[13px] text-ink outline-none focus:border-brass/60 focus:ring-0 transition-colors placeholder:text-ink/30 ${mono ? 'font-mono' : 'font-sans'} ${secret ? 'pr-9' : ''}`;
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
        <div className="relative">
          <input
            className={cls}
            type={secret && !revealed ? 'password' : 'text'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60 transition-colors"
              tabIndex={-1}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
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
  const [keys, setKeys] = useState<IntegrationKeys>(EMPTY_KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/advisor-profile').then(r => r.json()),
      fetch('/api/integration-settings').then(r => r.json()),
    ])
      .then(([profileData, keysData]) => {
        if (profileData) setProfile(prev => ({ ...prev, ...profileData }));
        if (keysData) setKeys(prev => ({ ...prev, ...keysData }));
      })
      .finally(() => setLoading(false));
  }, []);

  const field = useCallback((key: keyof AdvisorProfile) => ({
    value: profile[key] ?? '',
    onChange: (v: string) => setProfile(prev => ({ ...prev, [key]: v })),
  }), [profile]);

  const keyField = useCallback((key: keyof IntegrationKeys) => ({
    value: keys[key] ?? '',
    onChange: (v: string) => setKeys(prev => ({ ...prev, [key]: v })),
  }), [keys]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        fetch('/api/advisor-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        }),
        fetch('/api/integration-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keys),
        }),
      ]);
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

      {/* Integrations */}
      <Section title="Integrations">
        <p className="font-sans text-[12px] text-ink/45 -mt-1">
          Overrides the shared defaults for your team only. Leave blank to keep using the default.
        </p>

        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/40">Content sourcing</p>
          <div className="grid grid-cols-1 gap-4">
            <Field label="SerpApi key" placeholder="Used for live Google Hotels search" secret mono {...keyField('serpapiKey')} />
            <Field label="Ignav API key" placeholder="Required for live flight fare search — get one at ignav.com" secret mono {...keyField('ignavApiKey')} />
            <Field label="Pexels API key" placeholder="Used for destination and itinerary photo search" secret mono {...keyField('pexelsApiKey')} />
            <Field label="Hapuppy API key" placeholder="Used for AI narrative generation and rate parsing" secret mono {...keyField('hapuppyApiKey')} />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/40">Media uploads</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cloudflare account ID" secret mono {...keyField('cloudflareAccountId')} />
            <Field label="Cloudflare Images token" secret mono {...keyField('cloudflareImagesApiToken')} />
            <Field label="R2 account ID" secret mono {...keyField('r2AccountId')} />
            <Field label="R2 access key ID" secret mono {...keyField('r2AccessKeyId')} />
            <Field label="R2 secret access key" secret mono {...keyField('r2SecretAccessKey')} />
            <Field label="R2 bucket name" mono {...keyField('r2BucketName')} />
          </div>
          <Field
            label="R2 public URL base"
            placeholder="https://pub-xxxx.r2.dev"
            mono
            hint="The public base URL uploaded PDFs are served from"
            {...keyField('r2PublicUrlBase')}
          />
        </div>
      </Section>
    </div>
  );
}

