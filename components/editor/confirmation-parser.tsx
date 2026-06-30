'use client';

import { useState } from 'react';

interface ParsedConfirmation {
  booking_ref?: string;
  portal_ref?: string;
  hotel_name?: string;
  room_type?: string;
  checkin?: string;
  checkout?: string;
  nights?: number;
  adults?: number;
  board_basis?: string;
  total_inr?: number;
  total_usd?: number;
  cancellation_free_until?: string;
  cancellation_deadline?: string;
  special_requests_acknowledged?: boolean;
  perks?: string[];
  notes?: string;
}

interface ConfirmationParserProps {
  itemId: number;
  hotelName: string;
  onSave: (data: {
    bookingRef?: string;
    bookingStatus?: string;
    confirmedTotalInr?: number;
    cancellationFreeUntil?: string;
  }) => void;
  onClose: () => void;
}

export function ConfirmationParser({ itemId, hotelName, onSave, onClose }: ConfirmationParserProps) {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields after parse
  const [bookingRef, setBookingRef] = useState('');
  const [roomType, setRoomType] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [cancelFreeUntil, setCancelFreeUntil] = useState('');
  const [totalInr, setTotalInr] = useState('');
  const [boardBasis, setBoardBasis] = useState('');
  const [perks, setPerks] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/parse-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { parsed?: ParsedConfirmation; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Parsing failed');
        return;
      }
      const p = data.parsed ?? {};
      setParsed(p);
      // Pre-fill editable fields
      setBookingRef(p.booking_ref ?? '');
      setRoomType(p.room_type ?? '');
      setCheckin(p.checkin ?? '');
      setCheckout(p.checkout ?? '');
      setCancelFreeUntil(p.cancellation_free_until ?? '');
      setTotalInr(p.total_inr?.toString() ?? '');
      setBoardBasis(p.board_basis ?? '');
      setPerks(p.perks ?? []);
      setNotes(p.notes ?? '');
      setStep('review');
    } catch (e) {
      setError(String(e));
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save to trip item
      await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: bookingRef || undefined,
          bookingStatus: 'confirmed',
          confirmedTotalInr: totalInr ? parseInt(totalInr) : undefined,
          cancellationFreeUntil: cancelFreeUntil || undefined,
          startDate: checkin || undefined,
          endDate: checkout || undefined,
        }),
      });
      onSave({
        bookingRef: bookingRef || undefined,
        bookingStatus: 'confirmed',
        confirmedTotalInr: totalInr ? parseInt(totalInr) : undefined,
        cancellationFreeUntil: cancelFreeUntil || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(22,26,23,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col rounded-[8px] overflow-hidden w-full"
        style={{
          maxWidth: 580, maxHeight: '90vh', background: 'white',
          boxShadow: '0 20px 60px rgba(22,26,23,0.18)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.08)', background: '#F6F4EE' }}
        >
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mb-0.5">
              Parse booking confirmation
            </div>
            <div className="font-display text-[16px] text-ink font-normal leading-snug">
              {hotelName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[14px] text-ink-mute w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors hover:bg-gray-100"
            style={{ background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div
          className="flex items-center gap-3 px-5 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.07)' }}
        >
          {(['paste', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-ink-mute text-[10px]">→</span>}
              <span
                className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-[2px]"
                style={{
                  background: step === s ? 'rgba(169,139,82,0.12)' : 'transparent',
                  color: step === s ? '#A98B52' : '#8A9189',
                  border: step === s ? '1px solid rgba(169,139,82,0.3)' : '1px solid transparent',
                }}
              >
                {i + 1}. {s === 'paste' ? 'Paste email' : 'Review & save'}
              </span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'paste' && (
            <div className="space-y-3">
              <p className="font-sans text-[11px] text-ink-mute leading-relaxed">
                Paste the full booking confirmation email or text. The AI will extract the booking reference, dates, room type, cancellation policy, and rate.
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={14}
                placeholder="Paste booking confirmation email here…"
                autoFocus
                className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none resize-none leading-relaxed rounded-[4px] px-3 py-2.5"
                style={{ border: '1px solid rgba(22,26,23,0.14)', background: 'rgba(22,26,23,0.02)' }}
              />
              {error && (
                <div
                  className="font-sans text-[11px] px-3 py-2 rounded-[3px]"
                  style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.18)' }}
                >
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'review' && parsed && (
            <div className="space-y-3">
              <p className="font-sans text-[11px] text-ink-mute leading-relaxed">
                Review the extracted data. Edit any field before saving.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <ReviewField label="Booking reference" value={bookingRef} onChange={setBookingRef} />
                <ReviewField label="Room type" value={roomType} onChange={setRoomType} />
                <ReviewField label="Check-in" value={checkin} onChange={setCheckin} type="date" />
                <ReviewField label="Check-out" value={checkout} onChange={setCheckout} type="date" />
                <ReviewField label="Free cancellation until" value={cancelFreeUntil} onChange={setCancelFreeUntil} type="date" />
                <ReviewField label="Confirmed total (₹)" value={totalInr} onChange={setTotalInr} type="number" placeholder="leave blank if no INR total" />
                <ReviewField label="Board basis" value={boardBasis} onChange={setBoardBasis} />
              </div>

              {/* Perks */}
              {perks.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1.5">Confirmed perks / amenities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {perks.map((p, i) => (
                      <span
                        key={i}
                        className="font-sans text-[10px] px-2 py-0.5 rounded-sm"
                        style={{ background: 'rgba(169,139,82,0.08)', color: '#A98B52', border: '1px solid rgba(169,139,82,0.2)' }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Special requests */}
              {parsed.special_requests_acknowledged != null && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-[3px] font-sans text-[11px]"
                  style={{
                    background: parsed.special_requests_acknowledged ? 'rgba(30,58,47,0.07)' : 'rgba(217,119,6,0.07)',
                    color: parsed.special_requests_acknowledged ? '#1E3A2F' : '#b45309',
                    border: `1px solid ${parsed.special_requests_acknowledged ? 'rgba(30,58,47,0.18)' : 'rgba(217,119,6,0.2)'}`,
                  }}
                >
                  {parsed.special_requests_acknowledged
                    ? '✓ Confirmation acknowledges special requests'
                    : '⚠ No mention of special requests — re-confirm with property'}
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1">Notes from confirmation</div>
                  <p className="font-sans text-[11px] text-ink-soft leading-relaxed">{notes}</p>
                </div>
              )}

              {/* Raw fields not shown — show portal ref if present */}
              {parsed.portal_ref && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute w-[130px]">Portal ref</span>
                  <span className="font-mono text-[11px] text-ink-soft">{parsed.portal_ref}</span>
                </div>
              )}

              {error && (
                <div
                  className="font-sans text-[11px] px-3 py-2 rounded-[3px]"
                  style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.18)' }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(22,26,23,0.08)' }}
        >
          <button
            onClick={() => { if (step === 'review') { setStep('paste'); setError(null); } else onClose(); }}
            className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-[3px] cursor-pointer transition-opacity"
            style={{ background: 'transparent', color: '#4A514B', border: '1px solid rgba(22,26,23,0.18)' }}
          >
            {step === 'review' ? '← Re-paste' : 'Cancel'}
          </button>

          {step === 'paste' ? (
            <button
              onClick={handleParse}
              disabled={!text.trim() || parsing}
              className="font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-1.5 rounded-[3px] cursor-pointer transition-opacity disabled:opacity-40"
              style={{ background: '#1E3A2F', color: '#F6F4EE', border: 'none' }}
            >
              {parsing ? 'Parsing…' : '✦ Extract with AI'}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-1.5 rounded-[3px] cursor-pointer transition-opacity disabled:opacity-40"
              style={{ background: '#1E3A2F', color: '#F6F4EE', border: 'none' }}
            >
              {saving ? 'Saving…' : '✓ Confirm booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none"
        style={{ borderBottom: '1px solid rgba(22,26,23,0.14)', paddingBottom: 2 }}
      />
    </div>
  );
}
