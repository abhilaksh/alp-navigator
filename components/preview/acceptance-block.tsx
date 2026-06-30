'use client';

import { useState } from 'react';

interface Props {
  previewKey: string;
  waLink: string;
  tripLabel: string;
  alreadyAccepted: boolean;
  expiresAt: number | null;
}

export function AcceptanceBlock({ previewKey, waLink, tripLabel, alreadyAccepted, expiresAt }: Props) {
  const [state, setState] = useState<'idle' | 'form' | 'loading' | 'done' | 'error'>(
    alreadyAccepted ? 'done' : 'idle'
  );
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Expiry countdown
  let expiryLine: string | null = null;
  let expiryUrgent = false;
  if (expiresAt) {
    const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000);
    if (daysLeft <= 0) {
      expiryLine = 'This proposal has expired.';
      expiryUrgent = true;
    } else if (daysLeft === 1) {
      expiryLine = 'Proposal expires today.';
      expiryUrgent = true;
    } else if (daysLeft <= 7) {
      expiryLine = `Proposal expires in ${daysLeft} days.`;
      expiryUrgent = daysLeft <= 3;
    } else {
      // format date
      expiryLine = `Valid until ${new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }

  async function handleAccept() {
    setState('loading');
    try {
      const res = await fetch(`/api/proposals/${previewKey}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(d.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <section
        className="no-print"
        style={{ borderTop: '1px solid rgba(22,26,23,0.09)', paddingTop: 32 }}
      >
        <div
          className="rounded-[6px] px-6 py-5 mb-5"
          style={{ background: 'rgba(30,58,47,0.05)', border: '1px solid rgba(30,58,47,0.12)' }}
        >
          <p
            className="text-[15px] mb-1"
            style={{ color: '#1E3A2F', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
          >
            Proposal accepted
          </p>
          <p className="text-[12px]" style={{ color: '#4A514B' }}>
            Your advisor has been notified. {alreadyAccepted
              ? 'Message them on WhatsApp to coordinate the next steps.'
              : 'Message them directly to begin the booking process.'}
          </p>
        </div>
        <a
          href={`${waLink}?text=${encodeURIComponent(`Hi, I've confirmed I'd like to proceed with the itinerary for ${tripLabel}. When can we start the bookings?`)}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white rounded-sm transition-opacity hover:opacity-90"
          style={{ background: '#1E3A2F' }}
        >
          Message your advisor →
        </a>
      </section>
    );
  }

  return (
    <section
      className="no-print flex flex-col gap-5"
      style={{ borderTop: '1px solid rgba(22,26,23,0.09)', paddingTop: 32 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <p
            className="text-xl mb-1"
            style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
          >
            Ready to move forward?
          </p>
          <p className="text-[12px]" style={{ color: '#8A9189' }}>
            Let your advisor know and they&apos;ll handle the bookings.
          </p>
          {expiryLine && (
            <p
              className="text-[11px] mt-1.5"
              style={{ color: expiryUrgent ? '#dc2626' : '#8A9189' }}
            >
              {expiryLine}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0">
          <a
            href={`${waLink}?text=${encodeURIComponent(`Hi, I'd like to discuss the proposal for ${tripLabel}.`)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] rounded-sm border transition-opacity hover:opacity-80"
            style={{ color: '#4A514B', borderColor: 'rgba(22,26,23,0.2)', background: 'transparent' }}
          >
            Ask a question
          </a>
          <button
            onClick={() => setState('form')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white rounded-sm transition-opacity hover:opacity-90"
            style={{ background: '#1E3A2F' }}
          >
            I&apos;d like to proceed
          </button>
        </div>
      </div>

      {/* Inline acceptance form */}
      {(state === 'form' || state === 'loading' || state === 'error') && (
        <div
          className="rounded-[6px] px-5 py-5"
          style={{ background: '#EDEAE1', border: '1px solid rgba(22,26,23,0.08)' }}
        >
          <p className="text-[13px] font-medium mb-3" style={{ color: '#161A17' }}>
            Confirm your interest
          </p>
          <p className="text-[12px] mb-4" style={{ color: '#8A9189' }}>
            Any notes for your advisor? Preferred start date, budget adjustments, special requests — anything helpful.
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional — e.g. 'We'd prefer a slightly later check-in at Mykonos' or 'Can we confirm the Paris segment first?'"
            rows={3}
            className="w-full text-[13px] px-3 py-2.5 rounded-[4px] resize-none outline-none"
            style={{
              background: '#F6F4EE',
              border: '1px solid rgba(22,26,23,0.12)',
              color: '#161A17',
              fontFamily: 'Schibsted Grotesk, sans-serif',
            }}
          />
          {state === 'error' && (
            <p className="text-[12px] mt-2" style={{ color: '#dc2626' }}>{errorMsg}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleAccept}
              disabled={state === 'loading'}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white rounded-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#1E3A2F' }}
            >
              {state === 'loading' ? 'Sending…' : 'Confirm interest'}
            </button>
            <button
              onClick={() => { setState('idle'); setNote(''); setErrorMsg(''); }}
              disabled={state === 'loading'}
              className="text-[12px] transition-colors"
              style={{ color: '#8A9189' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
