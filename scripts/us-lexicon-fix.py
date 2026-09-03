#!/usr/bin/env python3
"""
Surgical US-lexicon rewrite of the US store dump (see audit-us-lexicon.py).

Rules are applied ONLY to text nodes (never inside tags/attributes/URLs),
case-preserving, with proper nouns protected. Prices convert only through
the owner-ruled EUR→USD map (docs/us-launch-status.md); unmapped € values
are left alone and reported. Every change is printed with context so the
diff can be reviewed before deploying.

Inputs : cms/pages/us/*.json, cms/posts/us/*.json (raw dumps)
Outputs: cms/pages/us/*.json rewritten in place (deploy-cms-page round-trip)
         blogs/us/<handle>.json (curated shape) for cloned EN posts, ready
         for deploy-blog-post — the 8 US-native posts and the EN twins that
         get unpublished are skipped.

Usage: python3 scripts/us-lexicon-fix.py [--write] [--only handle,...]
"""
import argparse, glob, html, json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─── owner-ruled EUR → USD (never extend without the owner) ──────────────────
PRICE_MAP = {
    '21.90': '25.90', '38.90': '45.90', '35': '40.90', '35.00': '40.90', '59': '69',
    '59.00': '69', '19.70': '23.30', '15': '15', '15.00': '15', '50': '59', '59': '69', '50': '59', '50.00': '59',
    '49': '59', '3.90': '4.90', '24.90': '28.90', '26.90': '30.90', '24.20': '27.80',
    '34.90': '41.90', '18.90': '21.90', '17.90': '20.90', '16.90': '19.90', '15.90': '18.90', '11.90': '13.90',
    '56.80': '66.80', '50.80': '60.80', '38.80': '44.80',  # comparison ladder, derived 3 Sep 2026
    '20.90': '25.90',  # stale pre-2026 EN price still on faq/legacy gate — same fact as 21.90
    '39': '46', '40': '47', '54.90': '64.90', '49.90': '58.90', '64.90': '76.90',
}

# EN twins of the 8 US-native posts → unpublished on US, not rewritten.
EN_TWINS = {
    'custom-football-kits-for-your-team-complete-guide', 'custom-football-kits-amateur-grassroots-club',
    'custom-futsal-5-a-side-jerseys', 'custom-jerseys-7-a-side-sunday-league',
    'custom-football-kits-corporate-events', 'custom-jerseys-football-tournaments',
    'when-to-order-team-kits-season-calendar', 'fund-team-kits-sponsors-fundraising',
}

# Core US pages owned by pages/us/* + deploy-us-pages.js — not rewritten here.
OWNED_PAGES = {'ready-to-play', 'request-custom-kit-design', 'ai-concept-to-real-kit', 'custom-basketball-jerseys'}

BRITISH = {
    'colour': 'color', 'colours': 'colors', 'coloured': 'colored', 'colourful': 'colorful',
    'customise': 'customize', 'customised': 'customized', 'customising': 'customizing', 'customisation': 'customization', 'customisable': 'customizable',
    'personalise': 'personalize', 'personalised': 'personalized', 'personalising': 'personalizing', 'personalisation': 'personalization',
    'organise': 'organize', 'organised': 'organized', 'organising': 'organizing', 'organisation': 'organization', 'organisations': 'organizations',
    'favourite': 'favorite', 'favourites': 'favorites', 'programme': 'program', 'programmes': 'programs',
    'centre': 'center', 'centred': 'centered', 'centres': 'centers', 'realise': 'realize', 'realised': 'realized',
    'recognise': 'recognize', 'recognised': 'recognized', 'recognisable': 'recognizable', 'catalogue': 'catalog',
    'grey': 'gray', 'greys': 'grays', 'metre': 'meter', 'metres': 'meters', 'licence': 'license', 'defence': 'defense',
    'honour': 'honor', 'honours': 'honors', 'behaviour': 'behavior', 'travelling': 'traveling', 'cancelled': 'canceled',
    'modelling': 'modeling', 'enquiry': 'inquiry', 'enquiries': 'inquiries', 'specialise': 'specialize', 'specialised': 'specialized',
    'specialising': 'specializing', 'optimise': 'optimize', 'optimised': 'optimized', 'optimising': 'optimizing',
    'maximise': 'maximize', 'minimise': 'minimize', 'analyse': 'analyze', 'analysed': 'analyzed', 'apologise': 'apologize',
    'summarise': 'summarize', 'utilise': 'utilize', 'jewellery': 'jewelry', 'aluminium': 'aluminum', 'tyre': 'tire', 'tyres': 'tires',
    'visualise': 'visualize', 'visualised': 'visualized', 'finalise': 'finalize', 'finalised': 'finalized', 'emphasise': 'emphasize',
    'harmonise': 'harmonize', 'harmonising': 'harmonizing', 'prioritise': 'prioritize', 'stabilise': 'stabilize',
    'authorised': 'authorized', 'authorisation': 'authorization', 'mould': 'mold', 'moulded': 'molded', 'fibre': 'fiber', 'fibres': 'fibers',
    'litre': 'liter', 'litres': 'liters', 'paralysed': 'paralyzed', 'neighbour': 'neighbor', 'neighbours': 'neighbors',
    'labour': 'labor', 'rumour': 'rumor', 'flavour': 'flavor', 'armour': 'armor', 'humour': 'humor', 'vigour': 'vigor',
    'practise': 'practice', 'kerb': 'curb', 'storey': 'story', 'whilst': 'while', 'amongst': 'among', 'learnt': 'learned',
    'burnt': 'burned', 'spelt': 'spelled', 'towards': 'toward', 'artefact': 'artifact', 'artefacts': 'artifacts',
    'cheque': 'check', 'dialogue': 'dialog', 'draught': 'draft', 'plough': 'plow', 'sceptical': 'skeptical',
}

def casefit(src, repl):
    if src.isupper(): return repl.upper()
    if src[0].isupper(): return repl[0].upper() + repl[1:]
    return repl

CHANGES = collections.defaultdict(list)   # rule → [(handle, before, after)]
RESIDUAL = collections.defaultdict(list)  # rule → [(handle, context)]

def log(rule, handle, s, m, new):
    a, b = max(0, m.start() - 40), m.end() + 40
    CHANGES[rule].append((handle, s[a:b].replace('\n', ' '), new))

URL_RE = re.compile(r'(https?://[^\s"\'<>)]+|(?<![\w/])/(?:pages|blogs|products|collections)/[^\s"\'<>)]+)')

def fix_text(s, handle):
    """Lexicon rules on a plain-text node (no tags). URLs inside the text
    (JSON-LD, JS data) are skipped — handles must never be rewritten."""
    if not s or not re.search(r'[A-Za-z€&]', s):
        return s
    parts = URL_RE.split(s)
    return ''.join(seg if i % 2 else _fix_prose(seg, handle) for i, seg in enumerate(parts))

def _fix_prose(s, handle):
    if not s or not re.search(r'[A-Za-z€&]', s):
        return s

    # 1. football → soccer, protecting proper nouns and American football.
    def fb(m):
        w = m.group(0)
        pre = s[max(0, m.start() - 12):m.start()]
        post = s[m.end():m.end() + 12]
        if w.isupper():                                # "DMC FOOTBALL CLUB" — team name
            RESIDUAL['football kept (uppercase proper noun)'].append((handle, s[max(0, m.start() - 30):m.end() + 20]))
            return w
        if re.match(r'\s+(?:Club|Academy|Association|Federation|League)\b', post) and w[0].isupper():
            RESIDUAL['football kept (Titlecase + Club/Academy)'].append((handle, s[max(0, m.start() - 30):m.end() + 20]))
            return w
        if re.search(r'(?i)american\s*$', pre):
            return w
        new = casefit(w, 'soccer')
        log('football→soccer', handle, s, m, new)
        return new
    s = re.sub(r'\bfootball\b', fb, s, flags=re.I)

    # 2. shirt(s) → jersey(s), except t-shirt / polo shirt / sweatshirt / dress shirt.
    def sh(m):
        w = m.group(0)
        pre = s[max(0, m.start() - 8):m.start()]
        if re.search(r'(?i)(?:t-|tee-|t |polo |dress |sweat|night|under)$', pre):
            return w
        new = casefit(w, 'jerseys' if w.lower().endswith('s') else 'jersey')
        log('shirt→jersey', handle, s, m, new)
        return new
    s = re.sub(r'\bshirts?\b', sh, s, flags=re.I)

    # 3. pitch → field (the playing surface only — not "sales pitch"/"pitch us").
    def pi(m):
        w = m.group(0)
        pre = s[max(0, m.start() - 20):m.start()]
        post = s[m.end():m.end() + 12]
        if re.search(r'(?i)(?:sales|elevator|your|a|the perfect)\s+$', pre) and not re.search(r'(?i)on\s+(?:the|a)\s+$', pre):
            if not re.search(r'(?i)(?:on|onto|off|from|across|to)\s+the\s+$', pre):
                RESIDUAL['pitch kept (non-field sense?)'].append((handle, s[max(0, m.start() - 30):m.end() + 20]))
                return w
        if re.match(r'(?i)\s+(?:deck|it|us|to|your|perfect)\b', post):
            RESIDUAL['pitch kept (non-field sense?)'].append((handle, s[max(0, m.start() - 30):m.end() + 20]))
            return w
        new = casefit(w, 'fields' if w.lower().endswith('es') else 'field')
        log('pitch→field', handle, s, m, new)
        return new
    s = re.sub(r'\bpitch(?:es)?\b', pi, s, flags=re.I)

    # 4. boots → cleats
    def bo(m):
        new = casefit(m.group(0), 'cleats'); log('boots→cleats', handle, s, m, new); return new
    s = re.sub(r'\bboots\b', bo, s, flags=re.I)

    # 5. British spellings
    def br(m):
        w = m.group(0); r = BRITISH.get(w.lower())
        if not r: return w
        new = casefit(w, r); log('british-spelling', handle, s, m, new); return new
    s = re.sub(r'\b(' + '|'.join(sorted(BRITISH, key=len, reverse=True)) + r')\b', br, s, flags=re.I)

    # 6. EUR prices → USD via the owner map; unmapped values reported, untouched.
    def eu(m):
        raw = m.group(0)
        num = re.sub(r'[^\d.,]', '', raw.replace('&euro;', '€')).replace(',', '.')
        key = num if '.' in num else num + '.00'
        if key not in PRICE_MAP and num in PRICE_MAP: key = num
        if key in PRICE_MAP:
            new = f'${PRICE_MAP[key]}'
            log('EUR→USD', handle, s, m, new); return new
        RESIDUAL['€ unmapped (owner must rule)'].append((handle, s[max(0, m.start() - 40):m.end() + 30]))
        return raw
    s = re.sub(r'(?:€|&euro;)\s?\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s?(?:€|&euro;)', eu, s)
    s = re.sub(r'\b(\d[\d.,]*)\s?(?:EUR|euros?)\b', lambda m: (log('EUR→USD', handle, s, m, f'${PRICE_MAP[m.group(1)]}') or f'${PRICE_MAP[m.group(1)]}') if m.group(1) in PRICE_MAP else (RESIDUAL['€ unmapped (owner must rule)'].append((handle, m.group(0))) or m.group(0)), s)

    # 7. stale claims
    for pat, new, rule in [
        (r'\b150\+', '250+', 'claim 150+→250+'),
        (r'\b100\+ (?=(?:Exclusive )?Designs)', '500+ ', 'claim 100+→500+ designs'),
        (r'\b10\+? (?=[Cc]ountries)', '15+ ', 'claim 10→15+ countries'),
    ]:
        def cl(m, new=new, rule=rule):
            log(rule, handle, s, m, new); return new
        s = re.sub(pat, cl, s)
    return s

def fix_links(s, handle):
    """Cross-store www links → relative (everything was cloned to the US store)."""
    def rel(m):
        path = m.group(1) or '/'
        if path.startswith('/collections'):
            RESIDUAL['/collections link relativized — verify collection exists on US'].append((handle, path))
        CHANGES['www link→relative'].append((handle, m.group(0), path))
        return path
    s = re.sub(r'https?://www\.momuto\.com(/[^\s"\'<>)]*)?', rel, s)
    for m in re.finditer(r'https?://(?:es|fr|it)\.momuto\.com[^\s"\'<>)]*', s):
        RESIDUAL['es/fr/it link kept'].append((handle, m.group(0)))
    return s

def fix_html(content, handle):
    """Text nodes only. <style> and non-JSON-LD <script> bodies are left alone
    (CSS variables, JS identifiers); JSON-LD is prose+data and gets the rules
    plus its currency code."""
    if not content: return content
    out = []; skip = None
    for tok in re.split(r'(<[^>]+>)', content):
        if tok.startswith('<'):
            out.append(tok)           # tags/attributes untouched (links handled separately)
            low = tok.lower()
            if low.startswith('<style'): skip = 'style'
            elif low.startswith('<script') and 'ld+json' not in low: skip = 'script'
            elif low.startswith('</style') or low.startswith('</script'): skip = None
            continue
        if skip:
            out.append(tok); continue
        t = fix_text(tok, handle)
        if '"@context"' in t and not re.search(r'(?:€|&euro;)\s?\d', t):
            def cur(m):
                CHANGES['JSON-LD currency EUR→USD'].append((handle, m.group(0), 'USD')); return m.group(1) + 'USD' + m.group(2)
            t = re.sub(r'("(?:priceCurrency|currency)"\s*:\s*")EUR(")', cur, t)
        out.append(t)
    return fix_links(''.join(out), handle)

def fix_obj(obj, handle):
    for k in ('title', 'meta_title', 'meta_descript', 'subtitle', 'summary', 'image_alt'):
        if isinstance(obj.get(k), str):
            obj[k] = fix_links(fix_text(obj[k], handle), handle)
    if isinstance(obj.get('meta_keywords'), list):
        obj['meta_keywords'] = [fix_text(str(x), handle) for x in obj['meta_keywords']]
    for k in ('content', 'body_html'):
        if isinstance(obj.get(k), str):
            obj[k] = fix_html(obj[k], handle)
    return obj

def shape_post(p, handle):
    return {
        'handle': handle, 'title': p.get('title') or '', 'meta_title': p.get('meta_title') or p.get('title') or '',
        'meta_descript': p.get('meta_descript') or p.get('summary') or '', 'summary': p.get('summary') or p.get('excerpt') or '',
        'author': p.get('author') or p.get('author_name') or '', 'status': p.get('status', 1),
        **({'src': p['src']} if p.get('src') else {}), **({'image_alt': p['image_alt']} if p.get('image_alt') else {}),
        'content': p.get('content') or '',
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true'); ap.add_argument('--only', default='')
    a = ap.parse_args()
    only = set(filter(None, a.only.split(',')))
    touched = {'pages': 0, 'posts': 0}

    for f in sorted(glob.glob(os.path.join(ROOT, 'cms', 'pages', 'us', '*.json'))):
        handle = os.path.basename(f)[:-5]
        if handle in OWNED_PAGES or (only and handle not in only): continue
        obj = json.load(open(f)); before = json.dumps(obj, ensure_ascii=False)
        fix_obj(obj, handle)
        if json.dumps(obj, ensure_ascii=False) != before:
            touched['pages'] += 1
            if a.write:
                with open(f, 'w') as fh: json.dump(obj, fh, indent=2, ensure_ascii=False); fh.write('\n')

    ours = {os.path.basename(x)[:-5] for x in glob.glob(os.path.join(ROOT, 'blogs', 'us', '*.json'))}
    for f in sorted(glob.glob(os.path.join(ROOT, 'cms', 'posts', 'us', '*.json'))):
        handle = os.path.basename(f)[:-5]
        if handle in ours or handle in EN_TWINS or (only and handle not in only): continue
        obj = json.load(open(f)); before = json.dumps(obj, ensure_ascii=False)
        fix_obj(obj, handle)
        if json.dumps(obj, ensure_ascii=False) != before:
            touched['posts'] += 1
            if a.write:
                out = os.path.join(ROOT, 'blogs', 'us', f'{handle}.json')
                with open(out, 'w') as fh: json.dump(shape_post(obj, handle), fh, indent=2, ensure_ascii=False); fh.write('\n')

    print(f"{'WROTE' if a.write else 'DRY RUN'}: {touched['pages']} pages, {touched['posts']} posts changed\n")
    print('CHANGES by rule:')
    for rule, items in sorted(CHANGES.items(), key=lambda x: -len(x[1])):
        print(f'  {rule:40s} {len(items):5d}')
    print('\nRESIDUALS (not changed — review):')
    for rule, items in RESIDUAL.items():
        print(f'  {rule}: {len(items)}')
        seen = set()
        for h, c in items:
            key = re.sub(r'\s+', ' ', c)[:70]
            if key in seen: continue
            seen.add(key)
            if len(seen) > 12: print('     …'); break
            cc = re.sub(r'\s+', ' ', c)
            print(f'     [{h[:30]}] {cc}')
    if os.environ.get('SHOW'):
        rule = os.environ['SHOW']
        print(f'\nSAMPLES for {rule}:')
        seen = set()
        for h, ctx, new in CHANGES.get(rule, []):
            key = ctx[:60]
            if key in seen: continue
            seen.add(key)
            print(f'   [{h[:28]}] …{ctx}… → {new}')
            if len(seen) >= int(os.environ.get('N', 25)): break

if __name__ == '__main__':
    main()
