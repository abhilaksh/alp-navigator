'use client';

import { useState, useMemo } from 'react';
import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';

interface ChecklistPanelProps {
  tripLabel: string;
  clientName: string | null;
  adults: number;
  destinations: DestinationState[];
}

type CheckItem = { id: string; text: string; group: string; done: boolean };

function buildChecklist(
  tripLabel: string,
  clientName: string | null,
  adults: number,
  destinations: DestinationState[],
): CheckItem[] {
  const items: CheckItem[] = [];
  let idx = 0;
  const add = (group: string, text: string) => {
    items.push({ id: String(idx++), text, group, done: false });
  };

  // ── Documents ──────────────────────────────────────────────────────────────
  add('Documents', `Valid passport (check expiry — must be valid 6+ months past return date)`);
  add('Documents', `${adults > 1 ? `${adults} copies of ` : ''}Travel insurance policy document`);

  // Visa requirements per destination
  const visaDests = destinations.filter(d => d.visaInfo?.required);
  if (visaDests.length) {
    for (const d of visaDests) {
      add('Documents', `${d.name} visa — ${d.visaInfo?.category ?? 'apply in advance'}`);
    }
  }

  // ── Flights ────────────────────────────────────────────────────────────────
  const flightItems = destinations.flatMap(d =>
    d.items.filter(i => !isHotelItem(i) && i.type === 'flight')
  );
  if (flightItems.length) {
    for (const f of flightItems) {
      add('Flights', `Web check-in for ${f.title}`);
    }
  } else {
    add('Flights', `Complete web check-in (opens 24–48h before departure)`);
  }
  add('Flights', `Download airline apps + save boarding pass to phone`);

  // ── Hotels ─────────────────────────────────────────────────────────────────
  for (const dest of destinations) {
    const hotels = dest.items.filter(isHotelItem);
    for (const h of hotels) {
      if (h.bookingStatus === 'confirmed' && h.bookingRef) {
        add('Accommodations', `${h.title} — confirmation ref: ${h.bookingRef}`);
      } else if (h.bookingStatus === 'confirmed') {
        add('Accommodations', `${h.title} — confirmed`);
      }
    }
  }

  // Special requests
  for (const dest of destinations) {
    for (const item of dest.items) {
      if (!isHotelItem(item) || !item.specialRequests) continue;
      try {
        const reqs: Array<{ type: string; text: string; status: string }> = JSON.parse(item.specialRequests);
        for (const r of reqs) {
          if (r.status !== 'delivered') {
            add('Special Requests', `${item.title}: ${r.text}`);
          }
        }
      } catch { /* skip */ }
    }
  }

  // ── Money ──────────────────────────────────────────────────────────────────
  add('Money & Cards', `Notify bank of travel dates (to prevent card blocks)`);
  add('Money & Cards', `Carry some local currency for tips and small payments`);
  add('Money & Cards', `Check if your credit card charges foreign transaction fees`);

  // ── Health & Safety ────────────────────────────────────────────────────────
  add('Health & Safety', `Travel insurance purchased and policy saved`);
  add('Health & Safety', `Emergency contacts shared with someone at home`);

  // Destination-specific health
  const tropicalDests = destinations.filter(d =>
    ['India', 'Thailand', 'Indonesia', 'Vietnam', 'Cambodia', 'Kenya', 'Tanzania', 'Maldives', 'Sri Lanka', 'Morocco']
      .some(c => (d.country ?? '').toLowerCase().includes(c.toLowerCase()) || d.name.toLowerCase().includes(c.toLowerCase()))
  );
  if (tropicalDests.length) {
    add('Health & Safety', `Check required/recommended vaccinations for ${tropicalDests.map(d => d.name).join(', ')}`);
  }

  // ── Packing ────────────────────────────────────────────────────────────────
  add('Packing', `Adaptor plug (check voltage for ${destinations.map(d => d.country ?? d.name).filter(Boolean).join(', ')})`);
  add('Packing', `Medications and prescriptions — carry in hand luggage`);
  add('Packing', `Download offline maps for each destination`);

  // ── Final ──────────────────────────────────────────────────────────────────
  const firstCheckin = destinations.find(d => d.checkin)?.checkin;
  if (firstCheckin) {
    add('Final Checks', `Confirm transport to airport (depart ${firstCheckin})`);
  } else {
    add('Final Checks', `Confirm transport to airport`);
  }
  add('Final Checks', `Check destination entry requirements (up to date)`);
  add('Final Checks', `Charge all devices and portable battery banks`);
  add('Final Checks', `Share itinerary with family/emergency contact`);

  return items;
}

const GROUP_ORDER = ['Documents', 'Flights', 'Accommodations', 'Special Requests', 'Money & Cards', 'Health & Safety', 'Packing', 'Final Checks'];

export function ChecklistPanel({ tripLabel, clientName, adults, destinations }: ChecklistPanelProps) {
  const base = useMemo(() => buildChecklist(tripLabel, clientName, adults, destinations), [tripLabel, clientName, adults, destinations]);
  const [items, setItems]     = useState<CheckItem[]>(base);
  const [copied, setCopied]   = useState(false);

  function toggle(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function copyForWhatsApp() {
    const groups = GROUP_ORDER.filter(g => items.some(i => i.group === g));
    const lines: string[] = [`*Pre-departure checklist — ${tripLabel}*`, ''];
    for (const g of groups) {
      lines.push(`*${g}*`);
      for (const item of items.filter(i => i.group === g)) {
        lines.push(`${item.done ? '✅' : '⬜'} ${item.text}`);
      }
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const doneCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  const groups = GROUP_ORDER.filter(g => items.some(i => i.group === g));

  return (
    <div className="flex-1 overflow-y-auto bg-paper" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>
      <div className="max-w-2xl mx-auto px-6 py-7">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-[15px] text-ink mb-[2px]" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}>
              Pre-departure checklist
            </h2>
            <p className="font-sans text-[11px] text-ink-mute">
              {clientName ? `For ${clientName} · ` : ''}{doneCount}/{totalCount} items complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress ring */}
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(22,26,23,0.08)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="#A98B52" strokeWidth="3"
                  strokeDasharray={`${pct * 0.942} 94.2`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px]" style={{ color: '#A98B52' }}>
                {pct}%
              </span>
            </div>
            <button
              onClick={copyForWhatsApp}
              className="flex items-center gap-[6px] font-mono text-[9px] uppercase tracking-[0.08em] px-[10px] py-[5px] rounded-[3px] cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'rgba(169,139,82,0.1)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.25)' }}
            >
              {copied ? '✓ Copied' : '⎘ Copy for WhatsApp'}
            </button>
          </div>
        </div>

        {/* Groups */}
        {groups.map(group => {
          const groupItems = items.filter(i => i.group === group);
          const groupDone = groupItems.every(i => i.done);
          return (
            <div key={group} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: groupDone ? '#A98B52' : '#8A9189' }}
                >
                  {group}
                </span>
                {groupDone && <span className="text-[9px]" style={{ color: '#A98B52' }}>✓</span>}
              </div>
              <div className="rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(22,26,23,0.08)', background: 'white', boxShadow: '0 1px 3px rgba(22,26,23,0.03)' }}>
                {groupItems.map((item, ri) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer group hover:bg-paper transition-colors"
                    style={{ borderBottom: ri < groupItems.length - 1 ? '1px solid rgba(22,26,23,0.05)' : 'none' }}
                  >
                    <div className="flex-shrink-0 mt-[2px]">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggle(item.id)}
                        className="sr-only"
                      />
                      <div
                        className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center transition-all"
                        style={{
                          background: item.done ? '#A98B52' : 'transparent',
                          border: item.done ? '1px solid #A98B52' : '1px solid rgba(22,26,23,0.2)',
                        }}
                      >
                        {item.done && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span
                      className="font-sans text-[12px] leading-snug select-none"
                      style={{ color: item.done ? '#8A9189' : '#4A514B', textDecoration: item.done ? 'line-through' : 'none' }}
                    >
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* Reset */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setItems(base)}
            className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-mute hover:text-ink-soft transition-colors cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            Reset checklist
          </button>
        </div>

      </div>
    </div>
  );
}
