#!/usr/bin/env python3
"""
Offline lexicon/claims audit of the US store dump (cms/{pages,posts,products}/us/).

The US store was cloned from the EN (UK-lexicon) store, so it inherits
"shirt", "football", "pitch", British spellings, EUR prices, stale claims and
cross-store www links. This scans every dumped object and prints, per object,
the hits per pattern, plus whether the US target keywords (from the Sep 2026
GSC export — the "soccer" query family) appear at all.

Usage: python3 scripts/audit-us-lexicon.py [--json out.json] [--min-hits N]
Refresh the dump first: Pull CMS Content workflow, cms_type=dump, locale=us.
"""
import glob, json, re, sys, os, html, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# pattern -> (label, severity)  severity: FIX = must change, INFO = judgment call
PATTERNS = {
    r'(?<![\w-])shirts?\b(?![\w-])': ('shirt→jersey', 'FIX'),            # "t-shirt" excluded by (?<![\w-])
    r'\bfootball\b': ('football→soccer', 'FIX'),
    r'\bpitch(?:es)?\b': ('pitch→field', 'FIX'),
    r'\bboots\b': ('boots→cleats', 'FIX'),
    r'\b(?:colour|customis\w*|personalis\w*|organis\w*|favourite|programme|centre|realis\w*|recognis\w*|catalogue|grey|metres?|licence|defence|honour|behaviour|travelling|cancelled|modelling|enquir\w*|specialis\w*|optimis\w*|maximis\w*|minimis\w*|analys(?:e|ed|ing)|apologis\w*|summaris\w*|utilis\w*|jewellery|aluminium|tyres?|aeroplane|mum\b)\b': ('british-spelling', 'FIX'),
    r'€\s?\d|\bEUR\b|\beuros?\b': ('EUR-price', 'FIX'),
    r'\b150\+|\b100\+ (?:exclusive )?designs|\b10 countries\b|\b10\+ countries\b': ('stale-claim', 'FIX'),
    r'https?://(?:www|es|fr|it)\.momuto\.com': ('cross-store-link', 'FIX'),
    r'\bkits?\b': ('kit (secondary term, ok in moderation)', 'INFO'),
    r'\bmatch(?:es)?\b': ('match→game?', 'INFO'),
    r'\bfree shipping (?:on orders )?over \$?\d+|\bfree shipping (?:from|above) \$?\d+': ('free-shipping-threshold (must be $59)', 'INFO'),
}

TARGETS = [
    'custom soccer jersey', 'custom soccer jerseys', 'soccer jersey maker',
    '3d soccer jersey designer', 'soccer jersey designer', 'create your own soccer jersey',
    'design your own soccer jersey', 'make your own soccer jersey', 'custom soccer uniform',
    'soccer jersey creator', 'no minimum',
]

def text_of(obj):
    parts = []
    for k in ('title', 'meta_title', 'meta_descript', 'subtitle', 'mini_detail', 'summary', 'body_html', 'content', 'image_alt'):
        v = obj.get(k)
        if isinstance(v, str) and v:
            parts.append(v)
    kw = obj.get('meta_keywords')
    if isinstance(kw, list):
        parts.append(' '.join(map(str, kw)))
    return '\n'.join(parts)

def strip_html(s):
    s = re.sub(r'<script.*?</script>', ' ', s, flags=re.S)  # JSON-LD scanned separately
    s = re.sub(r'<style.*?</style>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)

def jsonld_of(s):
    return '\n'.join(re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, flags=re.S))

def scan(obj, kind):
    raw = text_of(obj)
    visible = strip_html(raw)
    ld = jsonld_of(raw)
    hits = {}
    for pat, (label, sev) in PATTERNS.items():
        n_vis = len(re.findall(pat, visible, flags=re.I))
        n_ld = len(re.findall(pat, ld, flags=re.I))
        n_links = len(re.findall(pat, raw, flags=re.I)) if label == 'cross-store-link' else 0
        n = max(n_vis + n_ld, n_links)
        if n:
            hits[label] = {'n': n, 'sev': sev}
    low = visible.lower()
    targets = [t for t in TARGETS if t in low]
    meta = {
        'title': obj.get('title') or obj.get('name') or '',
        'meta_title': obj.get('meta_title') or '',
        'meta_descript': obj.get('meta_descript') or '',
        'meta_keywords': obj.get('meta_keywords') if isinstance(obj.get('meta_keywords'), list) else None,
    }
    return {
        'kind': kind, 'id': obj.get('id'), 'handle': obj.get('handle'),
        'status': obj.get('status'), 'chars': len(raw),
        'hits': hits, 'targets': targets, 'meta': meta,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json'); ap.add_argument('--min-hits', type=int, default=1)
    ap.add_argument('--locale', default='us')
    a = ap.parse_args()
    rows = []
    for kind in ('pages', 'posts', 'products'):
        for f in sorted(glob.glob(os.path.join(ROOT, 'cms', kind, a.locale, '*.json'))):
            with open(f) as fh:
                rows.append(scan(json.load(fh), kind[:-1]))
    if not rows:
        sys.exit(f'no dump under cms/*/{a.locale}/ — run Pull CMS Content (dump) first')

    fix_rows = [r for r in rows if any(h['sev'] == 'FIX' for h in r['hits'].values())]
    print(f'{len(rows)} objects scanned; {len(fix_rows)} with FIX-severity hits\n')
    # totals per label
    tot = {}
    for r in rows:
        for label, h in r['hits'].items():
            tot.setdefault(label, [0, 0]); tot[label][0] += h['n']; tot[label][1] += 1
    print('label                                          hits  objects')
    for label, (n, o) in sorted(tot.items(), key=lambda x: -x[1][0]):
        print(f'{label:45s} {n:5d}  {o:4d}')
    print()
    for r in sorted(rows, key=lambda r: -sum(h['n'] for h in r['hits'].values() if h['sev'] == 'FIX')):
        fixn = sum(h['n'] for h in r['hits'].values() if h['sev'] == 'FIX')
        if fixn < a.min_hits and not r['targets']:
            continue
        hs = ', '.join(f"{l}×{h['n']}" for l, h in r['hits'].items() if h['sev'] == 'FIX')
        info = ', '.join(f"{l.split(' ')[0]}×{h['n']}" for l, h in r['hits'].items() if h['sev'] == 'INFO')
        print(f"[{r['kind']:7s}] {r['handle']}  (id {r['id']}, status {r['status']}, {r['chars']} chars)")
        print(f"   title: {r['meta']['title'][:90]}")
        if hs: print(f"   FIX : {hs}")
        if info: print(f"   info: {info}")
        print(f"   targets present: {r['targets'] or '—'}")
    if a.json:
        with open(a.json, 'w') as fh:
            json.dump(rows, fh, indent=2)
        print(f'\nwrote {a.json}')

if __name__ == '__main__':
    main()
