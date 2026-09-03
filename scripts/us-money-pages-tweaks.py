#!/usr/bin/env python3
"""Keyword/claim/meta tweaks on the US money pages, applied AFTER us-lexicon-fix.py
(idempotent; re-run after any regeneration of cms/pages/us from a dump)."""
import json, glob, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(h): return json.load(open(f'{ROOT}/cms/pages/us/{h}.json'))
def save(h, d):
    with open(f'{ROOT}/cms/pages/us/{h}.json', 'w') as f: json.dump(d, f, indent=2, ensure_ascii=False); f.write('\n')
KW = {'custom-soccer-jerseys':['custom soccer jerseys','custom soccer uniforms','soccer jersey maker','design your own soccer jersey','no minimum soccer jerseys','MOMUTO'],
      'custom-youth-club-soccer-uniforms':['custom youth soccer uniforms','club soccer uniforms','custom soccer jerseys','youth soccer jerseys','no minimum','MOMUTO'],
      'design-your-own-soccer-jersey':['design your own soccer jersey','create your own soccer jersey','soccer jersey maker','3d soccer jersey designer','custom soccer jersey creator','MOMUTO'],
      'custom-soccer-jersey-designer':['custom soccer jersey designer','soccer jersey creator','custom soccer jerseys','3d soccer jersey designer','MOMUTO'],
      'teams-clubs-momuto':['custom soccer kits','teams wearing momuto','custom soccer jerseys','club soccer uniforms','MOMUTO'],
      'faq':['custom soccer jerseys faq','no minimum order soccer jerseys','custom soccer kits','MOMUTO'],
      'size-guide':['soccer jersey size guide','custom soccer jerseys sizing','MOMUTO'],
      'about-us':['about momuto','custom soccer kits','custom soccer jerseys','MOMUTO'],
      'custom-football-kit-materials-printing':['sublimated soccer jerseys','custom soccer kit materials','soccer jersey printing','MOMUTO'],
      'best-custom-soccer-jersey-makers-2026':['best custom soccer jersey makers','custom soccer jersey maker','custom soccer jerseys comparison','MOMUTO']}
for f in glob.glob(f'{ROOT}/cms/pages/us/ready-to-play-the-*.json'):
    n = re.search(r'ready-to-play-(the-\w+)', f).group(1).replace('-', ' ')
    KW[os.path.basename(f)[:-5]] = [f'{n} soccer kit', 'ready to play soccer kit', 'custom soccer jersey', 'soccer jersey design', 'MOMUTO']
for f in glob.glob(f'{ROOT}/cms/pages/us/*.json'):
    d = json.load(open(f))
    if 'Explore 200+ Custom Kit Designs' in d.get('content', ''):
        d['content'] = d['content'].replace('Explore 200+ Custom Kit Designs', 'Explore 500+ Custom Soccer Jersey Designs'); save(os.path.basename(f)[:-5], d)
d = load('custom-soccer-jerseys'); d['content'] = d['content'].replace('>Design in 3D — Free<', '>Create Your Own Soccer Jersey Online — Free<', 1); save('custom-soccer-jerseys', d)
d = load('custom-youth-club-soccer-uniforms'); d['content'] = d['content'].replace('>Design in 3D<', '>Design Your Own Soccer Jersey in 3D<', 1); save('custom-youth-club-soccer-uniforms', d)
d = load('teams-clubs-momuto'); d['meta_title'] = d['meta_title'].replace('Trusted by 100+ Clubs', 'Trusted by 250+ Clubs')
d['meta_descript'] = 'Explore the 250+ clubs across the United States and Europe wearing MOMUTO. Real photos, custom soccer kits in action, pro-quality designs. See why teams choose us.'
d['content'] = d['content'].replace('100+ Clubs', '250+ Clubs').replace('100+ clubs', '250+ clubs'); save('teams-clubs-momuto', d)
d = load('faq'); d['meta_descript'] = 'Everything about MOMUTO custom soccer jerseys: no minimum order, free pro design in 1-2 days, polyester-elastane fabric, 25-30 day delivery, USD pricing.'; save('faq', d)
d = load('about-us'); d['meta_descript'] = 'Professional-grade custom soccer kits for amateur teams: full dye-sublimation, no minimum order, free 3D designer. Built for clubs across the US and Europe.'; save('about-us', d)
d = load('size-guide'); d['meta_descript'] = 'Find your fit with our soccer jersey and shorts size guide. Youth and adult sizes, US measurements, and free sizing help for custom soccer jerseys at MOMUTO.'; save('size-guide', d)
d = load('custom-football-kit-materials-printing'); d['meta_descript'] = d['meta_descript'].replace('Built for match day.', 'Built for game day.'); save('custom-football-kit-materials-printing', d)
for h, kw in KW.items():
    d = load(h)
    if not d.get('meta_keywords'): d['meta_keywords'] = kw; save(h, d)
# 3 Sep rulings: deposit copy, per-head price, comparison ladder (USD, self-consistent)
d = load('contact'); c = d['content']
c = re.sub(r'A (?:€|&euro;|\$)\s?30 deposit may apply[^.<]*\.', 'A $15 deposit applies to 100% custom requests, credited in full to orders of 5+ jerseys &mdash; free for a team order.', c)
d['content'] = c; save('contact', d)
d = load('bachelor-party-football-shirts'); c = d['content']
c = c.replace('about €22 a head', 'about $25.90 a head').replace('around €22 per head', 'around $25.90 per head').replace('about &euro;22 a head', 'about $25.90 a head')
d['content'] = c; save('bachelor-party-football-shirts', d)
LADDER = {  # first number of the unit label → (jersey, shorts, kit); labels are "2&ndash;4 units", "1 unit", "100+ units"
    '1': ('45.90', '20.90', '66.80'), '2': ('41.90', '18.90', '60.80'), '5': ('30.90', '13.90', '44.80'),
    '10': ('25.90', '5.00', '30.90'), '20': ('21.90', '5.00', '26.90'), '50': ('20.90', '5.00', '25.90'), '100': ('19.90', '5.00', '24.90')}
d = load('momuto-vs-jersix-owayo-spized-comparison'); c = d['content']
c = re.sub(r'MOMUTO custom jersey pricing: [^"]*?Professional design is always free\.',
           'MOMUTO custom jersey pricing: 1 jersey $45.90, 2-4 jerseys $41.90 each, 5-9 jerseys $30.90 each, 10-19 jerseys $25.90 each, 20-49 jerseys $21.90 each, 50-99 jerseys $20.90 each, 100+ jerseys $19.90 each. Shorts are priced separately: $20.90 (1 unit), $18.90 (2-4), $13.90 (5-9), $5.00 (10+). Professional design is always free.', c)
c = re.sub(r'A single custom jersey costs [^"]*?shorts\)\.',
           'A single custom jersey costs $45.90 with shorts at $20.90, giving a full kit for $66.80. There are no sample fees or hidden surcharges. Orders of 10+ kits drop to $30.90 per full kit ($25.90 jersey + $5.00 shorts).', c)
PRICE = re.compile(r'(?:\$|&euro;|€)\s?\d+\.\d\d')
def fix_row(m):
    row = m.group(0)
    m2 = re.search(r'<td>(\d+)(?:&ndash;|–|-)?\d*\+? units?', row)
    if not m2 or m2.group(1) not in LADDER: return row
    it = iter(LADDER[m2.group(1)])
    return PRICE.sub(lambda _: '$' + next(it), row, count=3)
c = re.sub(r'<tr[\s\S]*?</tr>', fix_row, c)
d['content'] = c; save('momuto-vs-jersix-owayo-spized-comparison', d)
print('tweaks applied')
