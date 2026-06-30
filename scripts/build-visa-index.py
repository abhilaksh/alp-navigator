"""
Generates a compact visa requirements index for Indian passport holders.
Source: entry-requirements-22-06-2026.json (from alp-website-starter data folder)
Output: public/data/visa-index.json

Run from project root:
  python scripts/build-visa-index.py
"""

import json
import os
import sys

DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    '..', '..', 'alp-website-starter', 'alp-website-starter', 'data'
)
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
SRC_FILE = os.path.join(DATA_DIR, 'entry-requirements-22-06-2026.json')
OUT_FILE = os.path.join(OUT_DIR, 'visa-index.json')

# Categories that require advance visa planning
REQUIRES_VISA = {'Visa required', 'e-Visa', 'eVisa', 'E-Visa', 'Electronic Travel Authority', 'ETA', 'eTA'}
# Categories that are visa-free or on-arrival (no advance planning)
VISA_FREE     = {'Visa free', 'Visa on arrival', 'Visa Free', 'Visa on Arrival'}

def build_index():
    print('Loading visa requirements...')
    with open(SRC_FILE, encoding='utf-8') as f:
        data = json.load(f)
    print(f'  {len(data)} countries found')

    index = {}
    for entry in data:
        cat     = entry.get('visa_category', '')
        name    = entry.get('country_name', '')
        iso2    = entry.get('iso_alpha2', '')
        iso3    = entry.get('iso_alpha3', '')
        req     = cat in REQUIRES_VISA or (cat not in VISA_FREE and bool(cat))

        record = {
            'r': 1 if req else 0,      # visa required flag
            'c': cat,                   # category label
            'd': entry.get('difficulty', ''),
            'p': entry.get('processing_time', ''),
            'f': entry.get('average_fee', ''),
            's': entry.get('stay_duration', ''),
        }

        # index by ISO2, ISO3, and lowercase name
        if iso2: index[iso2.upper()] = record
        if iso3: index[iso3.upper()] = record
        if name: index[name.lower()] = record

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'), ensure_ascii=False)

    size_kb = os.path.getsize(OUT_FILE) / 1024
    req_count = sum(1 for v in index.values() if isinstance(v, dict) and v.get('r') == 1)
    print(f'  Written: {OUT_FILE}')
    print(f'  Size: {size_kb:.0f} KB')

if __name__ == '__main__':
    try:
        build_index()
    except FileNotFoundError as e:
        print(f'Error: {e}')
        sys.exit(1)
