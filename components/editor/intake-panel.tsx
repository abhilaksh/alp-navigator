'use client';

import { useState, useRef } from 'react';
import { Flag, CheckCircle2, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';

type UrgencyFlag = 'standard' | 'urgent' | 'very_urgent';

interface ClarificationFlag {
  id: string;
  field: string;
  question: string;
  status: 'pending' | 'answered';
  createdAt: number; // epoch ms
}

const FIELD_OPTIONS = [
  'Destination', 'Dates', 'Budget', 'Group size',
  'Accommodation type', 'Flight preference', 'Occasion', 'Other',
];

const URGENCY_OPTIONS: { value: UrgencyFlag; label: string; color: string }[] = [
  { value: 'standard',   label: 'Standard',    color: '#4A514B' },
  { value: 'urgent',     label: 'Urgent',      color: '#d97706' },
  { value: 'very_urgent', label: 'Very urgent', color: '#dc2626' },
];

function parseClarifications(raw: string | null): ClarificationFlag[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as ClarificationFlag[]; } catch { return []; }
}

function fmt(n: number | null | undefined): string {
  if (!n) return '';
  return n.toLocaleString('en-IN');
}

function parseInr(s: string): number | null {
  const n = parseInt(s.replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

interface IntakePanelProps {
  tripId: number;
  budgetStatedInr: number | null;
  budgetEstimatedInr: number | null;
  urgencyFlag: UrgencyFlag;
  clarificationFlagsRaw: string | null;
  onSaved?: (patch: {
    budgetStatedInr?: number | null;
    budgetEstimatedInr?: number | null;
    urgencyFlag?: UrgencyFlag;
    clarificationFlags?: string;
  }) => void;
}

export function IntakePanel({
  tripId,
  budgetStatedInr: initBudgetStated,
  budgetEstimatedInr: initBudgetEst,
  urgencyFlag: initUrgency,
  clarificationFlagsRaw,
  onSaved,
}: IntakePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [budgetStated, setBudgetStated] = useState(fmt(initBudgetStated));
  const [budgetEst, setBudgetEst] = useState(fmt(initBudgetEst));
  const [urgency, setUrgency] = useState<UrgencyFlag>(initUrgency ?? 'standard');
  const [flags, setFlags] = useState<ClarificationFlag[]>(() => parseClarifications(clarificationFlagsRaw));
  const [addingFlag, setAddingFlag] = useState(false);
  const [newField, setNewField] = useState('Destination');
  const [newQuestion, setNewQuestion] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(patch: Record<string, unknown>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/trips/${tripId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        onSaved?.(patch as Parameters<NonNullable<IntakePanelProps['onSaved']>>[0]);
      } catch { /* non-fatal */ }
    }, 800);
  }

  function handleBudgetStatedBlur() {
    const val = parseInr(budgetStated);
    setBudgetStated(fmt(val));
    scheduleSave({ budgetStatedInr: val });
  }

  function handleBudgetEstBlur() {
    const val = parseInr(budgetEst);
    setBudgetEst(fmt(val));
    scheduleSave({ budgetEstimatedInr: val });
  }

  function handleUrgencyChange(u: UrgencyFlag) {
    setUrgency(u);
    scheduleSave({ urgencyFlag: u });
  }

  function addFlag() {
    if (!newQuestion.trim()) return;
    const flag: ClarificationFlag = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      field: newField,
      question: newQuestion.trim(),
      status: 'pending',
      createdAt: Date.now(),
    };
    const updated = [flag, ...flags];
    setFlags(updated);
    setNewQuestion('');
    setAddingFlag(false);
    scheduleSave({ clarificationFlags: JSON.stringify(updated) });
  }

  function toggleFlagStatus(id: string) {
    const updated = flags.map(f =>
      f.id === id ? { ...f, status: f.status === 'pending' ? 'answered' as const : 'pending' as const } : f
    );
    setFlags(updated);
    scheduleSave({ clarificationFlags: JSON.stringify(updated) });
  }

  function deleteFlag(id: string) {
    const updated = flags.filter(f => f.id !== id);
    setFlags(updated);
    scheduleSave({ clarificationFlags: JSON.stringify(updated) });
  }

  const commissionEst = (() => {
    const base = parseInr(budgetEst) ?? parseInr(budgetStated);
    if (!base) return null;
    return Math.round(base * 0.10);
  })();

  const pendingCount = flags.filter(f => f.status === 'pending').length;
  const urgMeta = URGENCY_OPTIONS.find(u => u.value === urgency)!;

  return (
    <div
      className="rounded-[6px] mb-[18px]"
      style={{ background: 'white', border: '1px solid rgba(22,26,23,0.09)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ background: 'none', border: 'none', textAlign: 'left' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">Intake brief</span>
          {pendingCount > 0 && (
            <span
              className="font-mono text-[9px] px-[5px] py-[1px] rounded-full"
              style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
            >
              {pendingCount} pending
            </span>
          )}
          {urgency !== 'standard' && (
            <span
              className="font-mono text-[9px] px-[5px] py-[1px] rounded-[2px]"
              style={{ background: `${urgMeta.color}18`, color: urgMeta.color }}
            >
              {urgMeta.label}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={12} style={{ color: '#8A9189' }} /> : <ChevronDown size={12} style={{ color: '#8A9189' }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(22,26,23,0.06)' }}>
          <div className="pt-3 grid grid-cols-2 gap-3 mb-3">
            {/* Budget stated */}
            <div>
              <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute block mb-1">
                Client stated (₹)
              </label>
              <input
                type="text"
                value={budgetStated}
                onChange={e => setBudgetStated(e.target.value)}
                onBlur={handleBudgetStatedBlur}
                placeholder="0"
                className="w-full font-mono text-[12px] text-ink px-2 py-1.5 rounded-[3px] outline-none"
                style={{ border: '1px solid rgba(22,26,23,0.12)', background: '#F6F4EE' }}
              />
            </div>
            {/* Advisor estimate */}
            <div>
              <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute block mb-1">
                Advisor estimate (₹)
              </label>
              <input
                type="text"
                value={budgetEst}
                onChange={e => setBudgetEst(e.target.value)}
                onBlur={handleBudgetEstBlur}
                placeholder="0"
                className="w-full font-mono text-[12px] text-ink px-2 py-1.5 rounded-[3px] outline-none"
                style={{ border: '1px solid rgba(22,26,23,0.12)', background: '#F6F4EE' }}
              />
            </div>
          </div>

          {/* Commission estimate */}
          {commissionEst && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-[3px] mb-3"
              style={{ background: 'rgba(169,139,82,0.07)', border: '1px solid rgba(169,139,82,0.18)' }}
            >
              <span className="font-sans text-[11px] text-ink-mute">Est. commission (10%)</span>
              <span className="font-mono text-[12px] text-brass font-medium">
                ₹{commissionEst.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Urgency */}
          <div className="mb-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute mb-1.5">Urgency</p>
            <div className="flex gap-1.5">
              {URGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleUrgencyChange(opt.value)}
                  className="px-2.5 py-[5px] rounded-[3px] font-mono text-[9px] uppercase tracking-[0.05em] cursor-pointer transition-all"
                  style={{
                    background: urgency === opt.value ? opt.color : 'rgba(22,26,23,0.04)',
                    color: urgency === opt.value ? 'white' : opt.color,
                    border: `1px solid ${urgency === opt.value ? opt.color : 'rgba(22,26,23,0.1)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clarification flags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-mute">
                Clarifications needed
              </p>
              {!addingFlag && (
                <button
                  onClick={() => setAddingFlag(true)}
                  className="inline-flex items-center gap-1 font-mono text-[9px] text-brass cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <PlusCircle size={10} /> Add
                </button>
              )}
            </div>

            {addingFlag && (
              <div
                className="rounded-[4px] p-3 mb-2"
                style={{ background: '#F6F4EE', border: '1px solid rgba(22,26,23,0.1)' }}
              >
                <div className="mb-2">
                  <select
                    value={newField}
                    onChange={e => setNewField(e.target.value)}
                    className="font-mono text-[10px] rounded-[3px] px-2 py-1 outline-none cursor-pointer w-full"
                    style={{ border: '1px solid rgba(22,26,23,0.12)', background: 'white', color: '#161A17' }}
                  >
                    {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <textarea
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  placeholder="What needs clarifying?"
                  className="w-full font-sans text-[11px] rounded-[3px] px-2 py-1.5 outline-none resize-none"
                  style={{ border: '1px solid rgba(22,26,23,0.12)', background: 'white', color: '#161A17', minHeight: 52 }}
                  rows={2}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addFlag(); }}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={addFlag}
                    disabled={!newQuestion.trim()}
                    className="px-2.5 py-[5px] rounded-[3px] font-mono text-[9px] cursor-pointer disabled:opacity-40"
                    style={{ background: '#1E3A2F', color: 'white', border: 'none' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingFlag(false); setNewQuestion(''); }}
                    className="px-2.5 py-[5px] rounded-[3px] font-mono text-[9px] cursor-pointer"
                    style={{ background: 'none', border: '1px solid rgba(22,26,23,0.1)', color: '#4A514B' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {flags.length === 0 && !addingFlag && (
              <p className="font-sans text-[11px] text-ink-mute italic">
                No clarifications flagged.
              </p>
            )}

            {flags.map(flag => (
              <div
                key={flag.id}
                className="flex items-start gap-2 py-2"
                style={{ borderBottom: '1px solid rgba(22,26,23,0.05)' }}
              >
                <button
                  onClick={() => toggleFlagStatus(flag.id)}
                  className="mt-0.5 flex-shrink-0 cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  title={flag.status === 'pending' ? 'Mark answered' : 'Reopen'}
                >
                  {flag.status === 'answered' ? (
                    <CheckCircle2 size={13} style={{ color: '#2E6B45' }} />
                  ) : (
                    <Flag size={13} style={{ color: '#dc2626' }} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[9px] text-ink-mute">{flag.field}</span>
                  <p
                    className="font-sans text-[11px] text-ink leading-relaxed"
                    style={{ opacity: flag.status === 'answered' ? 0.5 : 1, textDecoration: flag.status === 'answered' ? 'line-through' : 'none' }}
                  >
                    {flag.question}
                  </p>
                </div>
                <button
                  onClick={() => deleteFlag(flag.id)}
                  className="font-mono text-[10px] text-ink-mute cursor-pointer flex-shrink-0"
                  style={{ background: 'none', border: 'none', padding: '2px 0' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
