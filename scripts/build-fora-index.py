"""
Generates a compact Fora partner index for the Navigator.
Source: all-fora-preferred-partners.json (from alp-website-starter data folder)
Output: public/data/fora-index.json

Run from project root:
  python scripts/build-fora-index.py
"""

import json
import os
import sys

# Adjust this path if your website-starter is elsewhere
DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    '..', '..', 'alp-website-starter', 'alp-website-starter', 'data'
)
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')

PROGRAMS_FILE = os.path.join(DATA_DIR, 'fora-partner-programs.json')
PARTNERS_FILE = os.path.join(DATA_DIR, 'all-fora-preferred-partners.json')
OUT_FILE      = os.path.join(OUT_DIR, 'fora-index.json')

# Programs that carry client-visible perks
SHOW_PROGRAMS = {
    'b34e1401-7aa8-48a4-bf30-cd5fec16defb': 'Fora Reserve',
    '8ce01622-ca41-48d3-9d61-74c45b779285': 'Address Luxury',
    'b043d86f-89f3-4ebb-ac57-5a16aa4ae1d6': 'Terra Mare',
}
# Perks summary per program (advisor-facing, stripped HTML)
PROGRAM_PERKS = {
    'Fora Reserve':    'Daily breakfast for two · Room upgrade on arrival · Welcome amenity/property credit · Early check-in / late checkout',
    'Address Luxury':  'Complimentary breakfast for two · Room upgrade on arrival · $100 hotel credit · Early check-in / late checkout',
    'Terra Mare':      'Preferred access · Bespoke onboard service · Dedicated concierge',
}

def load_program_perks():
    """Build programId → perk string from fora-partner-programs.json."""
    try:
        with open(PROGRAMS_FILE, encoding='utf-8') as f:
            progs = json.load(f)
        out = {}
        for p in progs:
            name = p.get('name', '')
            if name in PROGRAM_PERKS:
                out[p['id']] = PROGRAM_PERKS[name]
        return out
    except Exception as e:
        print(f'  Warning: could not load programs: {e}')
        return {}

def build_index():
    print('Loading Fora partners...')
    with open(PARTNERS_FILE, encoding='utf-8') as f:
        data = json.load(f)

    hotels = data if isinstance(data, list) else data.get('results', [])
    print(f'  {len(hotels)} hotels found')

    program_perks = load_program_perks()

    index = {}
    reserve_count = 0

    for h in hotels:
        fid = h.get('id')
        if not fid:
            continue

        programs = h.get('programs', [])
        labels   = [lb.get('slug', '') for lb in h.get('labels', [])]
        awards   = [
            { 'slug': a.get('slug'), 'label': a.get('label'), 'value': a.get('value') }
            for a in h.get('awards', [])
            if a.get('slug') in ('michelin_keys', 'michelin_stars', 'forbes', 'conde_nast')
        ]
        commission = h.get('commission_range')

        # Build program list for display
        prog_names = [p['name'] for p in programs if p.get('name')]
        # Perks: pick the highest-tier program that has a perk string
        perk_str = None
        for p in programs:
            pid = p.get('id')
            if pid and pid in program_perks:
                perk_str = program_perks[pid]
                break

        if 'reserve' in labels:
            reserve_count += 1

        entry = {
            'n': h.get('name', ''),
            'l': h.get('location', ''),
            'pg': prog_names,
        }
        if awards:    entry['aw'] = awards
        if commission: entry['cr'] = commission
        if perk_str:  entry['pk'] = perk_str

        index[fid] = entry

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'), ensure_ascii=False)

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f'  Written: {OUT_FILE}')
    print(f'  Size: {size_kb:.0f} KB')
    print(f'  Total indexed: {len(index)}')
    print(f'  Fora Reserve: {reserve_count}')

if __name__ == '__main__':
    try:
        build_index()
    except FileNotFoundError as e:
        print(f'Error: {e}')
        print(f'Expected source at: {PARTNERS_FILE}')
        sys.exit(1)
