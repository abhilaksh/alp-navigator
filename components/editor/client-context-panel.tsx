'use client';

import { useState } from 'react';

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

function parsePrefs(raw: string | null | undefined): ClientPreferences {
  const empty: ClientPreferences = {
    dietary: [], mobility: '', roomPref: '', airlineTier: '',
    commPref: '', decisionMaker: '', budgetTier: '',
    priorDestinations: [], disliked: '', customNote: '',
  };
  if (!raw) return empty;
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
  } catch { return empty; }
}

interface ClientContextPanelProps {
  clientId: number | null;
  clientName: string | null;
  clientPreferencesRaw: string | null;
  passportExpiry: string | null;
  nationality: string | null;
  onPreferencesSaved?: () => void;
}

export function ClientContextPanel({
  clientId,
  clientName,
  clientPreferencesRaw,
  passportExpiry,
  nationality,
  onPreferencesSaved,
}: ClientContextPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [newTag, setNewTag]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [localPrefs, setLocalPrefs] = useState<ClientPreferences>(() => parsePrefs(clientPreferencesRaw));

  if (!clientId) {
    return (
      <div
        className="rounded-[6px] px-4 py-3 text-[11px] font-sans text-ink-mute"
        style={{ background: 'rgba(22,26,23,0.04)', border: '1px solid rgba(22,26,23,0.08)' }}
      >
        No client linked to this trip.
      </div>
    );
  }

  const prefs = localPrefs;
  const prefRows: Array<{ label: string; value: string | string[] }> = [
    { label: 'Dietary', value: prefs.dietary },
    { label: 'Room pref', value: prefs.roomPref },
    { label: 'Airline', value: prefs.airlineTier },
    { label: 'Budget tier', value: prefs.budgetTier },
    { label: 'Decision maker', value: prefs.decisionMaker },
    { label: 'Mobility', value: prefs.mobility },
    { label: 'Prior destinations', value: prefs.priorDestinations },
    { label: 'Dislikes', value: prefs.disliked },
    { label: 'Note', value: prefs.customNote },
  ].filter(r => {
    const v = r.value;
    return Array.isArray(v) ? v.length > 0 : v !== '';
  });

  async function addCustomNote(note: string) {
    if (!note.trim() || !clientId) return;
    const updated = { ...localPrefs, customNote: localPrefs.customNote ? `${localPrefs.customNote}; ${note}` : note };
    setLocalPrefs(updated);
    setNewTag('');
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: JSON.stringify(updated) }),
      });
      onPreferencesSaved?.();
    } finally {
      setSaving(false);
    }
  }

  // Passport expiry check
  const passportWarning = (() => {
    if (!passportExpiry) return null;
    const expDate = new Date(passportExpiry + 'T12:00:00');
    const now = new Date();
    const days = Math.ceil((expDate.getTime() - now.getTime()) / 86400000);
    if (days < 0) return { text: 'Passport expired', level: 'red' };
    if (days < 180) return { text: `Passport expires in ${days} days`, level: 'amber' };
    return null;
  })();

  return (
    <div className="rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(22,26,23,0.09)', background: 'white', boxShadow: '0 1px 3px rgba(22,26,23,0.04)' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer text-left"
        style={{ background: 'none', border: 'none', borderBottom: expanded ? '1px solid rgba(22,26,23,0.07)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute">Client profile</span>
          {clientName && <span className="font-sans text-[11px] text-ink-soft">— {clientName}</span>}
        </div>
        <span className="font-mono text-[10px] text-ink-mute" style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="px-4 pt-3 pb-4 space-y-2">
          {/* Passport warning */}
          {passportWarning && (
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-[10px] font-mono mb-2"
              style={{
                background: passportWarning.level === 'red' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                color: passportWarning.level === 'red' ? '#b91c1c' : '#b45309',
                border: `1px solid ${passportWarning.level === 'red' ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}`,
              }}
            >
              ⚠ {passportWarning.text}
              {passportExpiry && <span className="opacity-60">· {passportExpiry}</span>}
            </div>
          )}

          {/* Nationality */}
          {nationality && (
            <div className="flex items-start gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute w-[90px] flex-shrink-0 pt-[1px]">Nationality</span>
              <span className="font-sans text-[11px] text-ink-soft">{nationality}</span>
            </div>
          )}

          {/* Preference rows */}
          {prefRows.map(row => {
            const display = Array.isArray(row.value) ? row.value.join(', ') : row.value;
            return (
              <div key={row.label} className="flex items-start gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute w-[90px] flex-shrink-0 pt-[1px]">
                  {row.label}
                </span>
                <span className="font-sans text-[11px] text-ink-soft leading-snug">{display}</span>
              </div>
            );
          })}

          {prefRows.length === 0 && !nationality && !passportWarning && (
            <p className="font-sans text-[11px] text-ink-mute italic">No preferences on file yet.</p>
          )}

          {/* Quick note add */}
          <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: '1px solid rgba(22,26,23,0.07)' }}>
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomNote(newTag)}
              placeholder="Add preference note…"
              className="flex-1 font-sans text-[11px] text-ink-soft bg-transparent outline-none"
              style={{ border: 'none', borderBottom: '1px solid rgba(22,26,23,0.12)' }}
            />
            <button
              onClick={() => addCustomNote(newTag)}
              disabled={!newTag.trim() || saving}
              className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded-[2px] cursor-pointer disabled:opacity-40"
              style={{ background: 'rgba(169,139,82,0.1)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.25)' }}
            >
              {saving ? '…' : '+ Save'}
            </button>
          </div>

          {/* Link to full client profile */}
          <div className="pt-1">
            <a
              href={`/clients/${clientId}`}
              className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-mute hover:text-brass transition-colors"
              style={{ textDecoration: 'none' }}
            >
              View full profile →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
