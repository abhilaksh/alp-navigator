'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';
import type { ParsedRate } from '@/lib/db/schema';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripLabel: string;
  clientName: string | null;
  clientWa: string | null;
  clientEmail: string | null;
  previewKey: string | null;
  destinations: DestinationState[];
  totalFromInr: number | null;
  personalNote?: string | null;
}

function buildWaMessage(
  tripLabel: string,
  clientName: string | null,
  previewUrl: string,
  destinations: DestinationState[],
  totalFromInr: number | null,
): string {
  const firstName = clientName?.split(' ')[0] ?? 'there';
  const lines: string[] = [
    `Hi ${firstName}! Your travel quote for *${tripLabel}* is ready.`,
    '',
  ];

  for (const dest of destinations) {
    const hotels = dest.items.filter(isHotelItem);
    if (!hotels.length) continue;
    lines.push(`📍 *${dest.name}*${dest.checkin ? ` — ${dest.checkin}${dest.checkout ? ` to ${dest.checkout}` : ''}` : ''}`);
    for (const h of hotels) {
      lines.push(`  • ${h.title}`);
      const done = h.hotelDetails?.rates.find(r => r.status === 'done');
      if (done?.parsedData) {
        try {
          const p = JSON.parse(done.parsedData) as ParsedRate;
          if (p.room_type) lines.push(`    ${p.room_type}`);
          if (p.total_inr) lines.push(`    ₹${p.total_inr.toLocaleString('en-IN')} total`);
          if (p.cancellation_free) lines.push(`    ✅ Free cancellation${p.cancellation_deadline ? ` until ${p.cancellation_deadline}` : ''}`);
          if (p.perks?.length) lines.push(`    ⭐ ${p.perks.slice(0, 2).join(' · ')}`);
        } catch { /* skip */ }
      }
    }
    lines.push('');
  }

  if (totalFromInr) {
    lines.push(`💰 *Trip from ₹${totalFromInr.toLocaleString('en-IN')}* (subject to availability)`);
    lines.push('');
  }

  lines.push(`View the full quote here:`);
  lines.push(previewUrl);
  lines.push('');
  lines.push(`_This quote is valid for 30 days. Let me know if you'd like to adjust anything!_`);

  return lines.join('\n');
}

function buildEmailDraft(
  tripLabel: string,
  clientName: string | null,
  previewUrl: string,
  destinations: DestinationState[],
  totalFromInr: number | null,
): string {
  const firstName = clientName?.split(' ')[0] ?? 'there';
  const lines: string[] = [
    `Subject: Your travel quote — ${tripLabel}`,
    '',
    `Hi ${firstName},`,
    '',
    `I've put together your travel proposal for ${tripLabel}. You can view the full interactive quote here:`,
    '',
    previewUrl,
    '',
  ];

  for (const dest of destinations) {
    const hotels = dest.items.filter(isHotelItem);
    if (!hotels.length) continue;
    lines.push(`${dest.name}${dest.checkin ? ` (${dest.checkin}${dest.checkout ? ` – ${dest.checkout}` : ''})` : ''}:`);
    for (const h of hotels) {
      lines.push(`  ${h.title}`);
      const done = h.hotelDetails?.rates.find(r => r.status === 'done');
      if (done?.parsedData) {
        try {
          const p = JSON.parse(done.parsedData) as ParsedRate;
          const details: string[] = [];
          if (p.room_type) details.push(p.room_type);
          if (p.total_inr) details.push(`₹${p.total_inr.toLocaleString('en-IN')}`);
          if (details.length) lines.push(`  ${details.join(' · ')}`);
          if (p.cancellation_free) lines.push(`  Free cancellation${p.cancellation_deadline ? ` until ${p.cancellation_deadline}` : ''}`);
        } catch { /* skip */ }
      }
    }
    lines.push('');
  }

  if (totalFromInr) {
    lines.push(`This trip is from ₹${totalFromInr.toLocaleString('en-IN')} (subject to final availability).`);
    lines.push('');
  }

  lines.push(`This quote is valid for 30 days. Feel free to reply to this email or message me directly if you'd like to make any changes.`);
  lines.push('');
  lines.push(`Best,`);
  lines.push(`Abhilaksh`);
  lines.push(`Alp Travel Co.`);
  lines.push(`WhatsApp: +91 98704 00235`);

  return lines.join('\n');
}

export function ShareModal({
  isOpen, onClose,
  tripId, tripLabel, clientName, clientWa, clientEmail,
  previewKey, destinations, totalFromInr, personalNote,
}: ShareModalProps) {
  const [tab, setTab] = useState<'wa' | 'email' | 'ai'>('wa');
  const [copied, setCopied] = useState<'wa' | 'email' | 'ai' | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://navigator.alptravel.co';
  const previewUrl = previewKey ? `${origin}/preview/${previewKey}` : '';

  const waMessage = buildWaMessage(tripLabel, clientName, previewUrl, destinations, totalFromInr);
  const emailDraft = buildEmailDraft(tripLabel, clientName, previewUrl, destinations, totalFromInr);

  function copy(type: 'wa' | 'email' | 'ai') {
    const text = type === 'wa' ? waMessage : type === 'email' ? emailDraft : aiSummary;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  async function handleGenerateAI() {
    setGenerating(true);
    try {
      const destPayload = destinations.map(d => ({
        name: d.name,
        checkin: d.checkin,
        checkout: d.checkout,
        nights: d.nights,
        hotels: d.items.filter(isHotelItem).map(h => h.title),
      }));
      const res = await fetch(`/api/trips/${tripId}/wa-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripLabel, clientName, destinations: destPayload,
          totalFromInr, previewUrl: previewUrl || null, personalNote: personalNote ?? null,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { text?: string };
        if (data.text) setAiSummary(data.text);
      }
    } finally {
      setGenerating(false);
    }
  }

  function sendWa() {
    const num = clientWa ? clientWa.replace(/\D/g, '') : '919870400235';
    const url = `https://wa.me/${num}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
  }

  const tabs = [
    { id: 'wa' as const, label: 'WhatsApp' },
    { id: 'ai' as const, label: 'AI summary' },
    { id: 'email' as const, label: 'Email draft' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(22,26,23,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[560px] max-h-[80vh] flex flex-col rounded-[8px] shadow-xl overflow-hidden"
        style={{ background: '#F6F4EE', border: '1px solid rgba(22,26,23,0.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(22,26,23,0.08)' }}>
          <div>
            <h2 className="font-display text-[16px] text-ink" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}>
              Share quote
            </h2>
            {!previewKey && (
              <p className="font-mono text-[10px] mt-0.5" style={{ color: '#b45309' }}>
                ⚠ No preview link yet — click Preview to generate one first
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-paper-deep transition-colors text-ink-mute cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(22,26,23,0.08)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative px-5 py-3 font-sans text-[12px] cursor-pointer transition-colors"
              style={{
                background: 'none', border: 'none',
                color: tab === t.id ? '#161A17' : '#8A9189',
                fontWeight: tab === t.id ? 500 : 400,
              }}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px]" style={{ background: '#A98B52' }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C9D2CC transparent' }}>
          {tab === 'ai' ? (
            <div>
              {!aiSummary ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'rgba(169,139,82,0.1)' }}
                  >
                    <Sparkles size={18} style={{ color: '#A98B52' }} />
                  </div>
                  <p className="font-sans text-[13px] text-ink mb-1">Generate a conversational summary</p>
                  <p className="font-sans text-[11px] text-ink-mute max-w-xs leading-relaxed mb-5">
                    5–8 lines that capture the trip essence. A warm intro, not a rate sheet.
                  </p>
                  <button
                    onClick={handleGenerateAI}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-[12px] font-medium cursor-pointer disabled:opacity-40 transition-opacity"
                    style={{ background: '#A98B52', color: 'white', border: 'none' }}
                  >
                    {generating ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                    {generating ? 'Generating…' : 'Generate with AI'}
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    value={aiSummary}
                    onChange={e => setAiSummary(e.target.value)}
                    className="w-full font-sans text-[12px] leading-relaxed bg-white rounded-[4px] p-4 resize-none outline-none"
                    style={{ border: '1px solid rgba(22,26,23,0.1)', minHeight: 220, color: '#4A514B' }}
                    rows={12}
                  />
                  <button
                    onClick={handleGenerateAI}
                    disabled={generating}
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] px-2 py-[3px] rounded-[2px] cursor-pointer disabled:opacity-40 transition-opacity"
                    style={{ background: 'rgba(169,139,82,0.08)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.22)' }}
                  >
                    {generating ? <Loader2 size={9} className="spin" /> : <Sparkles size={9} />}
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={tab === 'wa' ? waMessage : emailDraft}
              readOnly
              className="w-full font-mono text-[11px] leading-relaxed bg-white rounded-[4px] p-4 resize-none outline-none"
              style={{
                border: '1px solid rgba(22,26,23,0.1)',
                minHeight: 280,
                color: '#4A514B',
              }}
              rows={16}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(22,26,23,0.08)' }}>
          {tab === 'wa' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={sendWa}
                disabled={!previewKey}
                className="inline-flex items-center gap-[6px] px-4 py-2 rounded-[4px] text-[12px] font-sans font-medium text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: '#25D366', border: 'none' }}
              >
                Open in WhatsApp
                {clientWa && <span className="opacity-70 text-[10px]">{clientWa}</span>}
              </button>
              <button
                onClick={() => copy('wa')}
                className="inline-flex items-center gap-[6px] px-3 py-2 rounded-[4px] text-[11px] font-mono cursor-pointer transition-colors"
                style={{ background: 'rgba(22,26,23,0.05)', border: '1px solid rgba(22,26,23,0.1)', color: '#4A514B' }}
              >
                {copied === 'wa' ? '✓ Copied' : '⎘ Copy text'}
              </button>
            </div>
          ) : tab === 'ai' ? (
            aiSummary ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const num = clientWa ? clientWa.replace(/\D/g, '') : '919870400235';
                    window.open(`https://wa.me/${num}?text=${encodeURIComponent(aiSummary)}`, '_blank');
                  }}
                  disabled={!previewKey}
                  className="inline-flex items-center gap-[6px] px-4 py-2 rounded-[4px] text-[12px] font-sans font-medium text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#25D366', border: 'none' }}
                >
                  Send via WhatsApp
                </button>
                <button
                  onClick={() => copy('ai')}
                  className="inline-flex items-center gap-[6px] px-3 py-2 rounded-[4px] text-[11px] font-mono cursor-pointer transition-colors"
                  style={{ background: 'rgba(22,26,23,0.05)', border: '1px solid rgba(22,26,23,0.1)', color: '#4A514B' }}
                >
                  {copied === 'ai' ? '✓ Copied' : '⎘ Copy'}
                </button>
              </div>
            ) : null
          ) : (
            <div className="flex items-center gap-2">
              {clientEmail && (
                <a
                  href={`mailto:${clientEmail}?subject=${encodeURIComponent(`Your travel quote — ${tripLabel}`)}&body=${encodeURIComponent(emailDraft)}`}
                  className="inline-flex items-center gap-[6px] px-4 py-2 rounded-[4px] text-[12px] font-sans font-medium cursor-pointer transition-opacity hover:opacity-90"
                  style={{ background: '#1E3A2F', color: 'white', textDecoration: 'none' }}
                >
                  Open in email app
                </a>
              )}
              <button
                onClick={() => copy('email')}
                className="inline-flex items-center gap-[6px] px-3 py-2 rounded-[4px] text-[11px] font-mono cursor-pointer transition-colors"
                style={{ background: 'rgba(22,26,23,0.05)', border: '1px solid rgba(22,26,23,0.1)', color: '#4A514B' }}
              >
                {copied === 'email' ? '✓ Copied' : '⎘ Copy draft'}
              </button>
            </div>
          )}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-ink-mute hover:text-brass transition-colors truncate max-w-[200px]"
              style={{ textDecoration: 'none' }}
            >
              {previewUrl.replace('https://', '')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
