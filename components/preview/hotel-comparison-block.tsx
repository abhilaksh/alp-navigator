'use client';

import { useState, useEffect } from 'react';

interface HotelOption {
  id: number;
  title: string;
  stars: number | null;
  recommendation: string | null;
  totalInr: number | null;
  roomType: string | null;
  boardBasis: string | null;
  breakfastIncluded: boolean;
  cancellationFree: boolean | null;
  cancellationDeadline: string | null;
  nights: number | null;
  checkin: string | null;
  checkout: string | null;
  perks: string[];
}

interface HotelComparisonBlockProps {
  options: HotelOption[];
  storageKey: string;
}

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return d; }
}

export function HotelComparisonBlock({ options, storageKey }: HotelComparisonBlockProps) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSelected(parseInt(stored, 10));
    } catch { /* noop */ }
  }, [storageKey]);

  function pick(id: number) {
    setSelected(id);
    try { localStorage.setItem(storageKey, String(id)); } catch { /* noop */ }
  }

  const isComparison = options.length >= 2;
  const LETTERS = ['A', 'B', 'C', 'D'];

  return (
    <div>
      {isComparison && (
        <p className="text-[10px] uppercase tracking-[0.12em] mb-4" style={{ color: '#8A9189' }}>
          {options.length} options — select your preference
        </p>
      )}

      <div className={`gap-4 ${isComparison && options.length === 2 ? 'flex flex-col md:flex-row' : 'space-y-4'}`}>
        {options.map((opt, i) => {
          const isSelected = selected === opt.id;
          const isUnselected = selected !== null && !isSelected;
          return (
            <div
              key={opt.id}
              className={`flex-1 rounded-[6px] transition-all cursor-pointer ${isComparison ? 'border-2' : ''}`}
              style={{
                border: isComparison
                  ? `2px solid ${isSelected ? '#1E3A2F' : isUnselected ? 'rgba(22,26,23,0.06)' : 'rgba(22,26,23,0.12)'}`
                  : undefined,
                padding: isComparison ? 20 : 0,
                background: isComparison ? (isSelected ? 'rgba(30,58,47,0.03)' : 'white') : 'transparent',
                opacity: isUnselected ? 0.55 : 1,
              }}
              onClick={isComparison ? () => pick(opt.id) : undefined}
            >
              {/* Hotel header */}
              <div className={`flex items-baseline justify-between gap-4 ${isComparison ? 'mb-3' : 'mb-3'}`}>
                <div className="flex items-baseline gap-3 min-w-0">
                  <span
                    className="font-mono text-[10px] flex-shrink-0"
                    style={{
                      color: isSelected ? '#A98B52' : '#C9D2CC',
                      fontFamily: 'Spline Sans Mono, monospace',
                    }}
                  >
                    {LETTERS[i]}
                  </span>
                  <h3
                    className="text-xl leading-tight"
                    style={{ color: '#161A17', fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300 }}
                  >
                    {opt.title}
                  </h3>
                  {opt.stars && (
                    <span className="text-[11px] flex-shrink-0" style={{ color: '#A98B52', letterSpacing: '-0.5px' }}>
                      {'★'.repeat(Math.min(opt.stars, 5))}
                    </span>
                  )}
                </div>
                {opt.totalInr && (
                  <div className="text-right flex-shrink-0">
                    <p
                      className="font-mono text-lg leading-none"
                      style={{ color: '#A98B52', fontFamily: 'Spline Sans Mono, monospace' }}
                    >
                      ₹{opt.totalInr.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#8A9189' }}>total stay</p>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {opt.recommendation && (
                <p
                  className="text-[13px] leading-[1.65] mb-4 pl-4"
                  style={{ color: '#4A514B', borderLeft: '2px solid #A98B52', fontStyle: 'italic' }}
                >
                  {opt.recommendation}
                </p>
              )}

              {/* Rate details */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: '#4A514B' }}>
                  {opt.roomType && (
                    <span className="font-medium" style={{ color: '#161A17' }}>{opt.roomType}</span>
                  )}
                  {(opt.checkin || opt.checkout) && (
                    <span style={{ fontFamily: 'Spline Sans Mono, monospace', fontSize: 11 }}>
                      {opt.checkin && fmtDate(opt.checkin)}
                      {opt.checkin && opt.checkout && ' — '}
                      {opt.checkout && fmtDate(opt.checkout)}
                      {opt.nights ? ` · ${opt.nights} nights` : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-[5px]">
                  {opt.boardBasis && (
                    <span className="text-[10px] px-2 py-[3px] rounded-[3px]" style={{ background: 'rgba(30,58,47,0.07)', color: '#1E3A2F' }}>
                      {opt.boardBasis}
                    </span>
                  )}
                  {opt.breakfastIncluded && !opt.boardBasis && (
                    <span className="text-[10px] px-2 py-[3px] rounded-[3px]" style={{ background: 'rgba(30,58,47,0.07)', color: '#1E3A2F' }}>
                      Breakfast included
                    </span>
                  )}
                  {opt.cancellationFree === true && (
                    <span className="text-[10px] px-2 py-[3px] rounded-[3px]" style={{ background: 'rgba(34,134,58,0.08)', color: '#22863a' }}>
                      Free cancellation{opt.cancellationDeadline ? ` until ${fmtDate(opt.cancellationDeadline)}` : ''}
                    </span>
                  )}
                  {opt.cancellationFree === false && (
                    <span className="text-[10px] px-2 py-[3px] rounded-[3px]" style={{ background: 'rgba(220,38,38,0.07)', color: '#dc2626' }}>
                      Non-refundable
                    </span>
                  )}
                </div>
                {opt.perks.length > 0 && (
                  <div className="flex flex-wrap gap-[5px]">
                    {opt.perks.slice(0, 3).map((p, pi) => (
                      <span key={pi} className="text-[10px] px-2 py-[3px] rounded-[3px]" style={{ background: 'rgba(169,139,82,0.08)', color: '#A98B52' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Select indicator */}
              {isComparison && (
                <div className="mt-4 flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: isSelected ? '#1E3A2F' : '#C9D2CC' }}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: '#1E3A2F' }} />}
                  </div>
                  <span className="text-[11px]" style={{ color: isSelected ? '#1E3A2F' : '#8A9189' }}>
                    {isSelected ? 'Your preference' : 'Select this option'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
