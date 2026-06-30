import path from 'path';
import fs from 'fs';

export interface ForaPartnerData {
  name: string;
  location: string;
  programs: string[];
  awards?: Array<{ slug: string; label: string; value: number }>;
  commissionRange?: string;
  perks?: string;
}

type IndexEntry = {
  n: string; l: string; pg: string[];
  aw?: Array<{ slug: string; label: string; value: number }>;
  cr?: string; pk?: string;
};

let _index: Record<string, IndexEntry> | null = null;

function loadIndex(): Record<string, IndexEntry> {
  if (_index) return _index;
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'fora-index.json');
    _index = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    _index = {};
  }
  return _index!;
}

export function getForaPartner(foraId: string | null | undefined): ForaPartnerData | null {
  if (!foraId) return null;
  const idx = loadIndex();
  const e = idx[foraId];
  if (!e) return null;
  return {
    name: e.n,
    location: e.l,
    programs: e.pg ?? [],
    awards: e.aw,
    commissionRange: e.cr,
    perks: e.pk,
  };
}

export function isForaReserve(foraId: string | null | undefined): boolean {
  const p = getForaPartner(foraId);
  return p?.programs.includes('Fora Reserve') ?? false;
}
