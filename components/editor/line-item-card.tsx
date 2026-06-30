'use client';

import { useState } from 'react';
import { Plane, Car, Ticket, Star, ChevronRight, X, Check } from 'lucide-react';

export type LineItemType = 'flight' | 'transfer' | 'activity' | 'experience';

export interface LineItemState {
  id: number;
  type: LineItemType;
  title: string;
  bookingStatus: string;
  bookingRef: string | null;
  confirmedTotalInr: number | null;
  startDate: string | null;
  endDate: string | null;
  cancellationFreeUntil: string | null;
  visaRequired: number;
  detailsJson: Record<string, unknown> | null;
  sortOrder: number;
}

interface LineItemCardProps {
  item: LineItemState;
  defaultOpen?: boolean;
  onUpdate: (id: number, patch: {
    title?: string; bookingStatus?: string; bookingRef?: string | null;
    confirmedTotalInr?: number | null; detailsJson?: Record<string, unknown> | null;
    startDate?: string | null; endDate?: string | null;
    cancellationFreeUntil?: string | null; visaRequired?: number;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane size={12} />,
  transfer: <Car size={12} />,
  activity: <Ticket size={12} />,
  experience: <Star size={12} />,
};

const TYPE_LABELS: Record<string, string> = {
  flight: 'Flight', transfer: 'Transfer', activity: 'Activity', experience: 'Experience',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  researching: { label: 'Researching', color: '#4A514B', bg: 'rgba(22,26,23,0.06)' },
  quoted:      { label: 'Quoted',      color: '#A98B52', bg: 'rgba(169,139,82,0.10)' },
  confirmed:   { label: 'Confirmed',   color: '#2E6B45', bg: 'rgba(46,107,69,0.10)' },
  cancelled:   { label: 'Cancelled',   color: '#8B2F2F', bg: 'rgba(139,47,47,0.10)' },
};

function inr(n: number | string | undefined | null): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN')}`;
}

type Fields = {
  title: string; bookingStatus: string; bookingRef: string; confirmedTotalInr: string;
  cancellationFreeUntil: string; visaRequired: boolean;
  // flight
  airline: string; from: string; to: string; flightNumber: string; cabinClass: string;
  departureDateTime: string; arrivalDateTime: string;
  farePerPersonInr: string; passengers: string; pnr: string; isEstimated: boolean; expiryDate: string;
  // transfer
  pickupLocation: string; dropoffLocation: string; vehicleType: string;
  transferDateTime: string; isPerVehicle: boolean; operator: string; quoteRef: string;
  // activity
  activityName: string; activityOperator: string; activityDateTime: string;
  isPerPerson: boolean; activityBookingRef: string;
};

function initFields(item: LineItemState): Fields {
  const d = item.detailsJson ?? {};
  const s = (k: string, fallback = '') => String(d[k] ?? fallback);
  const b = (k: string, fallback = false) => Boolean(d[k] ?? fallback);
  return {
    title: item.title, bookingStatus: item.bookingStatus,
    bookingRef: item.bookingRef ?? '',
    confirmedTotalInr: item.confirmedTotalInr != null ? String(item.confirmedTotalInr) : '',
    cancellationFreeUntil: item.cancellationFreeUntil ?? '',
    visaRequired: item.visaRequired === 1,
    airline: s('airline'), from: s('from'), to: s('to'), flightNumber: s('flightNumber'),
    cabinClass: s('cabinClass', 'economy'), departureDateTime: s('departureDateTime'),
    arrivalDateTime: s('arrivalDateTime'), farePerPersonInr: s('farePerPersonInr'),
    passengers: s('passengers', '2'), pnr: s('pnr'), isEstimated: b('isEstimated', true),
    expiryDate: s('expiryDate'),
    pickupLocation: s('pickupLocation'), dropoffLocation: s('dropoffLocation'),
    vehicleType: s('vehicleType'), transferDateTime: s('dateTime'),
    isPerVehicle: b('isPerVehicle', true), operator: s('operator'), quoteRef: s('quoteRef'),
    activityName: s('activityName', item.title), activityOperator: s('operator'),
    activityDateTime: s('dateTime'), isPerPerson: b('isPerPerson', true),
    activityBookingRef: s('bookingRef', item.bookingRef ?? ''),
  };
}

function buildDetailsJson(type: string, f: Fields): Record<string, unknown> {
  if (type === 'flight') return {
    ...(f.airline && { airline: f.airline }),
    ...(f.from && { from: f.from.toUpperCase() }),
    ...(f.to && { to: f.to.toUpperCase() }),
    ...(f.flightNumber && { flightNumber: f.flightNumber }),
    cabinClass: f.cabinClass,
    ...(f.departureDateTime && { departureDateTime: f.departureDateTime }),
    ...(f.arrivalDateTime && { arrivalDateTime: f.arrivalDateTime }),
    ...(f.farePerPersonInr && { farePerPersonInr: parseFloat(f.farePerPersonInr) }),
    passengers: parseInt(f.passengers) || 2,
    ...(f.pnr && { pnr: f.pnr }),
    isEstimated: f.isEstimated,
    ...(f.expiryDate && { expiryDate: f.expiryDate }),
  };
  if (type === 'transfer') return {
    ...(f.pickupLocation && { pickupLocation: f.pickupLocation }),
    ...(f.dropoffLocation && { dropoffLocation: f.dropoffLocation }),
    ...(f.vehicleType && { vehicleType: f.vehicleType }),
    ...(f.transferDateTime && { dateTime: f.transferDateTime }),
    isPerVehicle: f.isPerVehicle,
    ...(f.operator && { operator: f.operator }),
    ...(f.quoteRef && { quoteRef: f.quoteRef }),
    isEstimated: f.isEstimated,
  };
  return {
    activityName: f.activityName || undefined,
    ...(f.activityOperator && { operator: f.activityOperator }),
    ...(f.activityDateTime && { dateTime: f.activityDateTime }),
    isPerPerson: f.isPerPerson,
    isEstimated: f.isEstimated,
    ...(f.activityBookingRef && { bookingRef: f.activityBookingRef }),
  };
}

function computeTotal(type: string, f: Fields): number | null {
  if (type === 'flight') {
    const fare = parseFloat(f.farePerPersonInr);
    const pax = parseInt(f.passengers);
    return fare > 0 && pax > 0 ? fare * pax : null;
  }
  const v = parseFloat(f.confirmedTotalInr);
  return v > 0 ? v : null;
}

function collapsedSummary(item: LineItemState): string {
  const d = item.detailsJson ?? {};
  const s = (k: string) => String(d[k] ?? '');
  if (item.type === 'flight') {
    const parts: string[] = [];
    if (s('from') || s('to')) parts.push(`${s('from') || '?'} → ${s('to') || '?'}`);
    if (s('flightNumber')) parts.push(s('flightNumber'));
    if (s('cabinClass')) parts.push(s('cabinClass').replace('_', ' '));
    return parts.join(' · ') || 'Flight details';
  }
  if (item.type === 'transfer') {
    const parts: string[] = [];
    if (s('pickupLocation') || s('dropoffLocation')) parts.push(`${s('pickupLocation') || '?'} → ${s('dropoffLocation') || '?'}`);
    if (s('dateTime')) parts.push(s('dateTime').replace('T', ' '));
    return parts.join(' · ') || 'Transfer details';
  }
  const parts: string[] = [s('activityName') || item.title];
  if (s('dateTime')) parts.push(s('dateTime').replace('T', ' '));
  return parts.join(' · ');
}

/* ─── Input helpers ───────────────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[9px] uppercase tracking-[0.08em] text-ink-mute mb-[3px]">{children}</label>;
}

function TI({
  value, onChange, placeholder, mono, short,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; short?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${short ? 'w-full' : 'w-full'} px-2 py-[5px] border border-glacier rounded-sm text-[11px] text-ink ${mono ? 'font-mono' : 'font-sans'} bg-white outline-none`}
      onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
      onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
    />
  );
}

function NumI({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] text-ink font-mono bg-white outline-none"
      onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
      onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
    />
  );
}

function DTI({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] text-ink font-mono bg-white outline-none"
      onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
      onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-[13px] h-[13px] accent-spruce" />
      <span className="text-[11px] text-ink-soft font-sans">{label}</span>
    </label>
  );
}

function Row({ children, cols }: { children: React.ReactNode; cols?: string }) {
  return <div className={`grid gap-2 mb-2 ${cols ?? 'grid-cols-2'}`}>{children}</div>;
}

/* ─── Type-specific form sections ─────────────────────────────────────────── */
function FlightForm({ f, set }: { f: Fields; set: (k: keyof Fields, v: string | boolean) => void }) {
  const computedTotal = (() => {
    const fare = parseFloat(f.farePerPersonInr);
    const pax = parseInt(f.passengers);
    return fare > 0 && pax > 0 ? fare * pax : null;
  })();
  return (
    <>
      <Row cols="grid-cols-4">
        <div><Label>From</Label><TI value={f.from} onChange={v => set('from', v)} placeholder="DEL" mono /></div>
        <div><Label>To</Label><TI value={f.to} onChange={v => set('to', v)} placeholder="CDG" mono /></div>
        <div><Label>Flight #</Label><TI value={f.flightNumber} onChange={v => set('flightNumber', v)} placeholder="AI142" mono /></div>
        <div>
          <Label>Cabin</Label>
          <select
            value={f.cabinClass}
            onChange={e => set('cabinClass', e.target.value)}
            className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] text-ink font-sans bg-white outline-none cursor-pointer"
          >
            <option value="economy">Economy</option>
            <option value="premium_economy">Prem Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>
      </Row>
      <Row>
        <div><Label>Airline</Label><TI value={f.airline} onChange={v => set('airline', v)} placeholder="Air India" /></div>
        <div><Label>PNR</Label><TI value={f.pnr} onChange={v => set('pnr', v)} placeholder="ABCDEF" mono /></div>
      </Row>
      <Row>
        <div><Label>Departure</Label><DTI value={f.departureDateTime} onChange={v => set('departureDateTime', v)} /></div>
        <div><Label>Arrival</Label><DTI value={f.arrivalDateTime} onChange={v => set('arrivalDateTime', v)} /></div>
      </Row>
      <Row cols="grid-cols-3">
        <div><Label>Fare / person (₹)</Label><NumI value={f.farePerPersonInr} onChange={v => set('farePerPersonInr', v)} placeholder="180000" /></div>
        <div><Label>Passengers</Label><NumI value={f.passengers} onChange={v => set('passengers', v)} placeholder="2" /></div>
        <div>
          <Label>Total (computed)</Label>
          <div className="px-2 py-[5px] border border-dashed border-glacier rounded-sm text-[11px] font-mono text-brass bg-transparent">
            {computedTotal ? `₹${computedTotal.toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
      </Row>
      <div className="flex items-center gap-4 mt-1">
        <Toggle checked={f.isEstimated} onChange={v => set('isEstimated', v)} label="Estimated / pending confirmation" />
        {f.isEstimated && (
          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-[9px] uppercase tracking-[0.08em] text-ink-mute whitespace-nowrap">Quote expires</label>
            <input
              type="date"
              value={f.expiryDate}
              onChange={e => set('expiryDate', e.target.value)}
              className="px-2 py-[4px] border border-glacier rounded-sm text-[11px] font-mono text-ink bg-white outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
              onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
            />
          </div>
        )}
      </div>
    </>
  );
}

function TransferForm({ f, set }: { f: Fields; set: (k: keyof Fields, v: string | boolean) => void }) {
  return (
    <>
      <Row cols="grid-cols-1">
        <div><Label>Pickup location</Label><TI value={f.pickupLocation} onChange={v => set('pickupLocation', v)} placeholder="CDG Airport T2" /></div>
      </Row>
      <Row cols="grid-cols-1">
        <div><Label>Dropoff location</Label><TI value={f.dropoffLocation} onChange={v => set('dropoffLocation', v)} placeholder="Le Meurice Hotel" /></div>
      </Row>
      <Row>
        <div><Label>Vehicle type</Label><TI value={f.vehicleType} onChange={v => set('vehicleType', v)} placeholder="Mercedes S-Class" /></div>
        <div><Label>Date & time</Label><DTI value={f.transferDateTime} onChange={v => set('transferDateTime', v)} /></div>
      </Row>
      <Row>
        <div><Label>Operator</Label><TI value={f.operator} onChange={v => set('operator', v)} placeholder="Carey Paris" /></div>
        <div><Label>Quote ref</Label><TI value={f.quoteRef} onChange={v => set('quoteRef', v)} placeholder="CP-20261015-001" mono /></div>
      </Row>
      <Row>
        <div><Label>Total cost (₹)</Label><NumI value={f.confirmedTotalInr} onChange={v => set('confirmedTotalInr', v)} placeholder="25000" /></div>
      </Row>
      <div className="flex items-center gap-4 mt-1">
        <Toggle checked={f.isPerVehicle} onChange={v => set('isPerVehicle', v)} label="Price per vehicle" />
        <Toggle checked={f.isEstimated} onChange={v => set('isEstimated', v)} label="Estimated" />
      </div>
    </>
  );
}

function ActivityForm({ f, set }: { f: Fields; set: (k: keyof Fields, v: string | boolean) => void }) {
  return (
    <>
      <Row cols="grid-cols-1">
        <div><Label>Activity name</Label><TI value={f.activityName} onChange={v => set('activityName', v)} placeholder="Private Seine River Dinner Cruise" /></div>
      </Row>
      <Row>
        <div><Label>Operator</Label><TI value={f.activityOperator} onChange={v => set('activityOperator', v)} placeholder="Bateaux Parisiens" /></div>
        <div><Label>Date & time</Label><DTI value={f.activityDateTime} onChange={v => set('activityDateTime', v)} /></div>
      </Row>
      <Row>
        <div><Label>Total cost (₹)</Label><NumI value={f.confirmedTotalInr} onChange={v => set('confirmedTotalInr', v)} placeholder="12000" /></div>
        <div><Label>Booking ref</Label><TI value={f.activityBookingRef} onChange={v => set('activityBookingRef', v)} placeholder="BP-12345" mono /></div>
      </Row>
      <div className="flex items-center gap-4 mt-1">
        <Toggle checked={f.isPerPerson} onChange={v => set('isPerPerson', v)} label="Price per person" />
        <Toggle checked={f.isEstimated} onChange={v => set('isEstimated', v)} label="Estimated" />
      </div>
    </>
  );
}

/* ─── Main card ───────────────────────────────────────────────────────────── */
export function LineItemCard({ item, defaultOpen = false, onUpdate, onDelete }: LineItemCardProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => initFields(item));
  const set = (k: keyof Fields, v: string | boolean) => setF(prev => ({ ...prev, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      const detailsJson = buildDetailsJson(item.type, f);
      const total = computeTotal(item.type, f);
      await onUpdate(item.id, {
        title: f.title || TYPE_LABELS[item.type],
        bookingStatus: f.bookingStatus,
        bookingRef: f.bookingRef || null,
        confirmedTotalInr: total,
        detailsJson,
        cancellationFreeUntil: f.cancellationFreeUntil || null,
        visaRequired: f.visaRequired ? 1 : 0,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await onDelete(item.id);
  }

  const summary = collapsedSummary(item);
  const statusCfg = STATUS_META[item.bookingStatus] ?? STATUS_META.researching;

  return (
    <div className="rounded-sm mb-2 overflow-hidden" style={{ border: '1px solid rgba(22,26,23,0.09)', background: '#FAFAF8' }}>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none group"
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,26,23,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <ChevronRight
          size={11}
          className="text-ink-mute flex-shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        <span className="flex items-center gap-1 text-ink-mute flex-shrink-0">
          {TYPE_ICONS[item.type]}
          <span className="text-[10px] font-sans font-semibold tracking-[0.08em] uppercase">{TYPE_LABELS[item.type]}</span>
        </span>
        <span className="text-glacier text-xs mx-0.5">·</span>
        <span className="font-sans text-[12px] text-ink-soft flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {summary}
        </span>
        {item.confirmedTotalInr != null && (
          <span className="font-mono text-[12px] font-medium text-brass flex-shrink-0 ml-1">
            {inr(item.confirmedTotalInr)}
          </span>
        )}
        <span
          className="text-[9px] font-sans font-medium px-[6px] py-[2px] rounded-sm flex-shrink-0"
          style={{ color: statusCfg.color, background: statusCfg.bg }}
        >
          {statusCfg.label}
        </span>
        <button
          onClick={e => { e.stopPropagation(); handleDelete(); }}
          className="p-0.5 text-ink-mute hover:text-danger transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        >
          <X size={11} />
        </button>
      </div>

      {/* Edit body */}
      {expanded && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(22,26,23,0.07)' }}>

          {/* Common: title + status */}
          <Row>
            <div>
              <Label>Label</Label>
              <TI value={f.title} onChange={v => set('title', v)} placeholder={TYPE_LABELS[item.type]} />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={f.bookingStatus}
                onChange={e => set('bookingStatus', e.target.value)}
                className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] text-ink font-sans bg-white outline-none cursor-pointer"
              >
                <option value="researching">Researching</option>
                <option value="quoted">Quoted</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </Row>

          <div className="mt-1 mb-3 h-px" style={{ background: 'rgba(22,26,23,0.06)' }} />

          {item.type === 'flight'   && <FlightForm f={f} set={set} />}
          {item.type === 'transfer' && <TransferForm f={f} set={set} />}
          {(item.type === 'activity' || item.type === 'experience') && <ActivityForm f={f} set={set} />}

          {/* Booking fields: cancel deadline + visa */}
          <div className="mt-3 pt-2.5 flex items-end gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(22,26,23,0.07)' }}>
            <div className="min-w-[140px]">
              <Label>Cancel free until</Label>
              <input
                type="date"
                value={f.cancellationFreeUntil}
                onChange={e => set('cancellationFreeUntil', e.target.value)}
                className="w-full px-2 py-[5px] border border-glacier rounded-sm text-[11px] font-mono text-ink bg-white outline-none"
                onFocus={e => (e.currentTarget.style.borderColor = '#A98B52')}
                onBlur={e => (e.currentTarget.style.borderColor = '#C9D2CC')}
              />
            </div>
            <div className="flex items-center gap-1.5 pb-[6px]">
              <input
                type="checkbox"
                id={`li-visa-${item.id}`}
                checked={f.visaRequired}
                onChange={e => set('visaRequired', e.target.checked)}
                className="w-[13px] h-[13px] accent-spruce cursor-pointer"
              />
              <label htmlFor={`li-visa-${item.id}`} className="text-[11px] text-ink-soft font-sans cursor-pointer">
                Visa required
              </label>
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-[6px] bg-spruce hover:bg-spruce-light text-white text-[11px] font-medium font-sans rounded-sm cursor-pointer transition-colors disabled:opacity-50"
            >
              <Check size={11} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
