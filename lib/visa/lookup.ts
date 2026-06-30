import path from 'path';
import fs from 'fs';

export interface VisaInfo {
  required: boolean;
  category: string;
  difficulty: string;
  processingTime: string;
  fee: string;
  stayDuration: string;
}

type IndexEntry = { r: number; c: string; d: string; p: string; f: string; s: string };

let _index: Record<string, IndexEntry> | null = null;

function loadIndex(): Record<string, IndexEntry> {
  if (_index) return _index;
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'visa-index.json');
    _index = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    _index = {};
  }
  return _index!;
}

export function getVisaInfo(countryNameOrCode: string | null | undefined): VisaInfo | null {
  if (!countryNameOrCode) return null;
  const idx = loadIndex();
  // Try ISO2 uppercased, ISO3 uppercased, then lowercase name
  const e = idx[countryNameOrCode.toUpperCase()] ?? idx[countryNameOrCode.toLowerCase()];
  if (!e) return null;
  return {
    required: e.r === 1,
    category: e.c,
    difficulty: e.d,
    processingTime: e.p,
    fee: e.f,
    stayDuration: e.s,
  };
}

export function isVisaRequired(countryNameOrCode: string | null | undefined): boolean {
  return getVisaInfo(countryNameOrCode)?.required ?? false;
}
