/**
 * Estimates the INR cash value of Virtuoso/Fora partner perks.
 * Pattern-matches against common perk strings from hotel confirmations.
 * Conservative estimates — actual value is usually higher.
 */

export interface PerkValueItem {
  perk: string;
  estimatedUsd: number;
}

const USD_TO_INR_FALLBACK = 84; // conservative fallback

// Common perk patterns and their approximate USD value per occurrence
const PERK_PATTERNS: Array<{ patterns: RegExp[]; label: string; getUsd: (match: RegExpMatchArray | null, nights: number) => number }> = [
  {
    patterns: [/breakfast\s+for\s+two|complimentary\s+breakfast|daily\s+breakfast|breakfast\s+included/i],
    label: 'Daily breakfast for 2',
    getUsd: (_, nights) => 60 * Math.max(nights, 1),
  },
  {
    patterns: [/breakfast\s+for\s+one/i],
    label: 'Daily breakfast for 1',
    getUsd: (_, nights) => 30 * Math.max(nights, 1),
  },
  {
    patterns: [/\$(\d+)\s+(?:hotel|food|dining|beverage|resort|property|spa)\s+credit/i, /hotel\s+credit\s+(?:of\s+)?\$?(\d+)/i],
    label: 'Hotel/dining credit',
    getUsd: (m) => m ? parseInt(m[1]) : 100,
  },
  {
    patterns: [/usd\s+(\d+)\s+credit|(\d+)\s+usd\s+credit/i],
    label: 'USD credit',
    getUsd: (m) => m ? parseInt(m[1] ?? m[2]) : 100,
  },
  {
    patterns: [/one[-\s]way\s+(?:airport\s+)?transfer|complimentary\s+transfer|airport\s+transfer/i],
    label: 'Airport transfer (1-way)',
    getUsd: () => 80,
  },
  {
    patterns: [/round[-\s]trip\s+(?:airport\s+)?transfer/i],
    label: 'Airport transfer (round-trip)',
    getUsd: () => 160,
  },
  {
    patterns: [/room\s+upgrade|suite\s+upgrade|complimentary\s+upgrade/i],
    label: 'Room/suite upgrade',
    getUsd: () => 150,
  },
  {
    patterns: [/early\s+check[-\s]in|late\s+check[-\s]out|early\s+arrival|late\s+departure/i],
    label: 'Early check-in / late check-out',
    getUsd: () => 50,
  },
  {
    patterns: [/welcome\s+amenity|welcome\s+gift|welcome\s+basket/i],
    label: 'Welcome amenity',
    getUsd: () => 40,
  },
  {
    patterns: [/spa\s+credit|wellness\s+credit|(\d+)\s+(?:usd|dollar)\s+spa/i],
    label: 'Spa credit',
    getUsd: (m) => m ? parseInt(m[1]) : 50,
  },
  {
    patterns: [/complimentary\s+(?:wifi|internet)|wifi\s+included/i],
    label: 'Complimentary Wi-Fi',
    getUsd: () => 20,
  },
  {
    patterns: [/\$(\d+)\s+(?:activity|experience|excursion)\s+credit/i],
    label: 'Activity credit',
    getUsd: (m) => m ? parseInt(m[1]) : 50,
  },
];

export function calcPerkValue(
  perks: string[] | null | undefined,
  nights: number,
  fxUsdToInr?: number | null,
): { totalInr: number; items: PerkValueItem[] } {
  if (!perks || perks.length === 0) return { totalInr: 0, items: [] };

  const rate = fxUsdToInr ?? USD_TO_INR_FALLBACK;
  const items: PerkValueItem[] = [];

  for (const perk of perks) {
    for (const def of PERK_PATTERNS) {
      let match: RegExpMatchArray | null = null;
      let matched = false;
      for (const pattern of def.patterns) {
        match = perk.match(pattern);
        if (match) { matched = true; break; }
      }
      if (matched) {
        items.push({ perk, estimatedUsd: def.getUsd(match, nights) });
        break; // only match one category per perk string
      }
    }
  }

  const totalInr = Math.round(items.reduce((sum, i) => sum + i.estimatedUsd, 0) * rate);
  return { totalInr, items };
}

export function formatPerkValue(inr: number): string {
  if (inr <= 0) return '';
  if (inr >= 100000) return `₹${(inr / 100000).toFixed(1)}L`;
  if (inr >= 1000) return `₹${(inr / 1000).toFixed(0)}k`;
  return `₹${inr}`;
}
