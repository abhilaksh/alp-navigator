'use client';

import { useState } from 'react';
import type { DestinationState } from '@/app/(dashboard)/trips/[id]/types';
import { isHotelItem } from '@/app/(dashboard)/trips/[id]/editor-utils';
import type { ParsedRate } from '@/lib/db/schema';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripLabel: string;
  clientName: string | null;
  clientWa: string | null;
  clientEmail: string | null;
  previewKey: string | null;
  destinations: DestinationState[];
  totalFromInr: number | null;
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
  tripLabel, clientName, clientWa, clientEmail,
  previewKey, destinations, totalFromInr,
}: ShareModalProps) {
  const [tab, setTab] = useState<'wa' | 'email'>('wa');
  const [copied, setCopied] = useState<'wa' | 'email' | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://navigator.alptravel.co';
  const previewUrl = previewKey ? `${origin}/preview/${previewKey}` : '';

  const waMessage = buildWaMessage(tripLabel, clientName, previewUrl, destinations, totalFromInr);
  const emailDraft = buildEmailDraft(tripLabel, clientName, previewUrl, destinations, totalFromInr);

  function copy(type: 'wa' | 'email') {
    const text = type === 'wa' ? waMessage : emailDraft;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  function sendWa() {
    const num = clientWa ? clientWa.replace(/\D/g, '') : '919870400235';
    const url = `https://wa.me/${num}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
  }

  const tabs = [
    { id: 'wa' as const, label: 'WhatsApp' },
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
