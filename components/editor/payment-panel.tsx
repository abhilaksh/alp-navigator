'use client';

import { useState, useCallback } from 'react';

export interface PaymentTracking {
  depositPct: number | null;             // % of total due as deposit (e.g. 30)
  depositAmountInr: number | null;       // calculated or overridden INR amount
  depositDueDate: string | null;         // ISO date
  depositPaidDate: string | null;        // ISO date, null = not yet paid
  balanceDueDate: string | null;         // ISO date
  balancePaidDate: string | null;        // ISO date, null = not yet paid
  totalAmountInr: number | null;         // override (defaults to trip totalFromInr)
  notes: string;
}

interface PaymentPanelProps {
  tripId: number;
  totalFromInr: number | null;
  paymentDataRaw: string | null;
}

function emptyPayment(): PaymentTracking {
  return {
    depositPct: 30,
    depositAmountInr: null,
    depositDueDate: null,
    depositPaidDate: null,
    balanceDueDate: null,
    balancePaidDate: null,
    totalAmountInr: null,
    notes: '',
  };
}

function parsePayment(raw: string | null): PaymentTracking {
  if (!raw) return emptyPayment();
  try {
    const p = JSON.parse(raw);
    return {
      depositPct: p.depositPct ?? 30,
      depositAmountInr: p.depositAmountInr ?? null,
      depositDueDate: p.depositDueDate ?? null,
      depositPaidDate: p.depositPaidDate ?? null,
      balanceDueDate: p.balanceDueDate ?? null,
      balancePaidDate: p.balancePaidDate ?? null,
      totalAmountInr: p.totalAmountInr ?? null,
      notes: p.notes ?? '',
    };
  } catch { return emptyPayment(); }
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN');
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso + 'T12:00:00').getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function DeadlineBadge({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const days = daysUntil(iso);
  if (days == null) return null;
  const label = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : `Due in ${days}d`;
  const color = days < 0 ? '#b91c1c' : days <= 2 ? '#b45309' : '#4A514B';
  const bg = days < 0 ? 'rgba(220,38,38,0.08)' : days <= 2 ? 'rgba(217,119,6,0.08)' : 'rgba(22,26,23,0.06)';
  const border = days < 0 ? 'rgba(220,38,38,0.2)' : days <= 2 ? 'rgba(217,119,6,0.2)' : 'rgba(22,26,23,0.1)';
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[2px]"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

export function PaymentPanel({ tripId, totalFromInr, paymentDataRaw }: PaymentPanelProps) {
  const [payment, setPayment] = useState<PaymentTracking>(() => parsePayment(paymentDataRaw));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const effectiveTotal = payment.totalAmountInr ?? totalFromInr;
  const depositAmount = payment.depositAmountInr
    ?? (effectiveTotal && payment.depositPct ? Math.round(effectiveTotal * payment.depositPct / 100) : null);
  const balanceAmount = (effectiveTotal && depositAmount) ? effectiveTotal - depositAmount : null;

  const save = useCallback(async (updated: PaymentTracking) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentData: JSON.stringify(updated) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }, [tripId]);

  function update<K extends keyof PaymentTracking>(key: K, value: PaymentTracking[K]) {
    const updated = { ...payment, [key]: value };
    setPayment(updated);
    save(updated);
  }

  const depositPaid = !!payment.depositPaidDate;
  const balancePaid = !!payment.balancePaidDate;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div
        className="grid grid-cols-3 gap-px rounded-[5px] overflow-hidden"
        style={{ border: '1px solid rgba(22,26,23,0.08)', background: 'rgba(22,26,23,0.04)' }}
      >
        {[
          { label: 'Total', value: fmt(effectiveTotal), sub: null },
          { label: 'Deposit', value: fmt(depositAmount), sub: payment.depositPct ? `${payment.depositPct}%` : null },
          { label: 'Balance', value: fmt(balanceAmount), sub: null },
        ].map(cell => (
          <div key={cell.label} className="bg-white px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-0.5">{cell.label}</div>
            <div className="font-mono text-[13px] font-medium" style={{ color: '#A98B52' }}>{cell.value}</div>
            {cell.sub && <div className="font-mono text-[9px] text-ink-mute">{cell.sub}</div>}
          </div>
        ))}
      </div>

      {/* Alert banners */}
      {!depositPaid && payment.depositDueDate && (() => {
        const d = daysUntil(payment.depositDueDate);
        return d != null && d <= 3 ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[4px] font-mono text-[10px]"
            style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.18)', color: '#b45309' }}
          >
            ⚠ Deposit due {d <= 0 ? 'now' : `in ${d}d`} · {fmt(depositAmount)} unpaid
          </div>
        ) : null;
      })()}
      {!balancePaid && payment.balanceDueDate && (() => {
        const d = daysUntil(payment.balanceDueDate);
        return d != null && d <= 7 ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[4px] font-mono text-[10px]"
            style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#b91c1c' }}
          >
            ⚠ Balance due {d <= 0 ? 'now' : `in ${d}d`} · {fmt(balanceAmount)} unpaid
          </div>
        ) : null;
      })()}

      {/* Deposit section */}
      <div
        className="rounded-[5px] overflow-hidden"
        style={{ border: '1px solid rgba(22,26,23,0.08)', background: 'white' }}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.07)', background: 'rgba(22,26,23,0.02)' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">Deposit</span>
          <button
            onClick={() => update('depositPaidDate', depositPaid ? null : new Date().toISOString().slice(0, 10))}
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] px-2 py-1 rounded-[2px] cursor-pointer transition-colors"
            style={{
              background: depositPaid ? 'rgba(30,58,47,0.1)' : 'rgba(169,139,82,0.1)',
              color: depositPaid ? '#1E3A2F' : '#A98B52',
              border: `1px solid ${depositPaid ? 'rgba(30,58,47,0.2)' : 'rgba(169,139,82,0.25)'}`,
            }}
          >
            {depositPaid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>
        <div className="px-3 py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="% of total">
              <input
                type="number"
                value={payment.depositPct ?? ''}
                onChange={e => setPayment(p => ({ ...p, depositPct: e.target.value ? parseFloat(e.target.value) : null }))}
                onBlur={e => update('depositPct', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
                placeholder="30"
              />
            </Field>
            <Field label="Override amount (₹)">
              <input
                type="number"
                value={payment.depositAmountInr ?? ''}
                onChange={e => setPayment(p => ({ ...p, depositAmountInr: e.target.value ? parseInt(e.target.value) : null }))}
                onBlur={e => update('depositAmountInr', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
                placeholder="auto"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={payment.depositDueDate ?? ''}
                  onChange={e => update('depositDueDate', e.target.value || null)}
                  className="flex-1 font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                  style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
                />
                <DeadlineBadge iso={depositPaid ? null : payment.depositDueDate} />
              </div>
            </Field>
            <Field label="Paid date">
              <input
                type="date"
                value={payment.depositPaidDate ?? ''}
                onChange={e => update('depositPaidDate', e.target.value || null)}
                className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Balance section */}
      <div
        className="rounded-[5px] overflow-hidden"
        style={{ border: '1px solid rgba(22,26,23,0.08)', background: 'white' }}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.07)', background: 'rgba(22,26,23,0.02)' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">Balance</span>
          <button
            onClick={() => update('balancePaidDate', balancePaid ? null : new Date().toISOString().slice(0, 10))}
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] px-2 py-1 rounded-[2px] cursor-pointer transition-colors"
            style={{
              background: balancePaid ? 'rgba(30,58,47,0.1)' : 'rgba(169,139,82,0.1)',
              color: balancePaid ? '#1E3A2F' : '#A98B52',
              border: `1px solid ${balancePaid ? 'rgba(30,58,47,0.2)' : 'rgba(169,139,82,0.25)'}`,
            }}
          >
            {balancePaid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>
        <div className="px-3 py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={payment.balanceDueDate ?? ''}
                  onChange={e => update('balanceDueDate', e.target.value || null)}
                  className="flex-1 font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                  style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
                />
                <DeadlineBadge iso={balancePaid ? null : payment.balanceDueDate} />
              </div>
            </Field>
            <Field label="Paid date">
              <input
                type="date"
                value={payment.balancePaidDate ?? ''}
                onChange={e => update('balancePaidDate', e.target.value || null)}
                className="w-full font-mono text-[11px] text-ink-soft bg-transparent outline-none"
                style={{ borderBottom: '1px solid rgba(22,26,23,0.12)' }}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1">Payment notes</div>
        <textarea
          value={payment.notes}
          onChange={e => setPayment(p => ({ ...p, notes: e.target.value }))}
          onBlur={e => update('notes', e.target.value)}
          rows={2}
          placeholder="Wire details, payment reference, agent contact…"
          className="w-full font-sans text-[11px] text-ink-soft bg-transparent outline-none resize-none leading-relaxed"
          style={{ borderBottom: '1px solid rgba(22,26,23,0.1)' }}
        />
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-right" style={{ color: saved ? '#1E3A2F' : '#A98B52' }}>
          {saving ? 'Saving…' : '✓ Saved'}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1">{label}</div>
      {children}
    </div>
  );
}
