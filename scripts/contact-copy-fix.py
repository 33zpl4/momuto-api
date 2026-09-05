#!/usr/bin/env python3
"""Contact pages: kill the "free design" claims that contradict rule 5, fix
production 7-15 -> 7-12 (rule 6), meta "3-4 weeks" -> 25-30 days, and derive
the US object from the EN fragment (soccer + USD). Sources of truth are the
fragments pages/contact (EN), pages/contacto (ES), pages/contattaci (IT); the
pulled cms/pages/<locale>/<handle>.json objects receive the result.
Every replacement must match at least once or the script aborts."""
import json, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent

def apply(text, pairs, label):
    """Idempotent: a pair that no longer matches is fine if its replacement is already present."""
    for pat, rep in pairs:
        new, n = re.subn(pat, rep, text)
        if n == 0 and re.sub(r'\\g<0>|\\', '', rep)[:40] not in text: sys.exit(f"{label}: no match for {pat!r}")
        text = new
    return text

D = r'(?:–|&ndash;)'
EN = [
    (rf'Design mockup in 1{D}2 days, free\.', 'Design mockup in 24&ndash;48 h. Free in the 3D designer; &euro;15 deposit for a designer-built request, credited in full to orders of 5+ jerseys.'),
    (rf'7{D}15 days production', r'7\g<0>'.replace('7\\g<0>', '7&ndash;12 days production')),
    (r'Production takes 7–15 days', 'Production takes 7–12 days'),
    (rf'in 1&ndash;2 days, free</strong>, with revisions included', 'in 1&ndash;2 days</strong> with revisions included &mdash; &euro;15 deposit, credited in full to orders of 5+ jerseys'),
]
ES = [
    (rf'Maqueta de dise&ntilde;o en 1{D}2 d&iacute;as, gratis\.', 'Maqueta de dise&ntilde;o en 24&ndash;48 h. Gratis en el dise&ntilde;ador 3D; dep&oacute;sito de 15&nbsp;&euro; si la construye un dise&ntilde;ador, abonado &iacute;ntegramente en pedidos de 5+ camisetas.'),
    (r'Maqueta en 1&ndash;2 d&iacute;as, gratis\.', 'Maqueta en 24&ndash;48 h.'),
    (r'con dise&ntilde;o profesional gratuito incluido', 'dise&ntilde;ada gratis en el dise&ntilde;ador 3D o a partir de un modelo Ready to Play con un 10 % de descuento'),
    (rf'7{D}15 d&iacute;as de producci&oacute;n', '7&ndash;12 d&iacute;as de producci&oacute;n'),
    (r'Tu maqueta de dise&ntilde;o gratuita est&aacute; lista en <strong>1&ndash;2 d&iacute;as</strong> tras tu brief, revisiones incluidas\.', 'Tu maqueta de dise&ntilde;o est&aacute; lista en <strong>1&ndash;2 d&iacute;as</strong> tras tu brief, revisiones incluidas (dep&oacute;sito de 15&nbsp;&euro;, abonado &iacute;ntegramente en pedidos de 5+ camisetas).'),
    (r'&iquest;El servicio de dise&ntilde;o es realmente gratuito\?', '&iquest;Cu&aacute;nto cuesta el servicio de dise&ntilde;o?'),
    (r'S&iacute;, completamente gratuito\. Elige entre.*?realizas tu pedido\.', 'Las v&iacute;as en autoservicio son gratis: el dise&ntilde;ador 3D en tiempo real con m&aacute;s de 30 plantillas y los modelos Ready to Play del estudio con un 10 % de descuento. &iquest;Prefieres que lo construya un dise&ntilde;ador profesional? Maqueta en 1&ndash;2 d&iacute;as con revisiones incluidas &mdash; dep&oacute;sito de 15&nbsp;&euro;, abonado &iacute;ntegramente en pedidos de 5+ camisetas, as&iacute; que a un equipo el dise&ntilde;o no le cuesta nada.'),
    (r'en 1&ndash;2 d&iacute;as, gratis</strong>, revisiones incluidas', 'en 1&ndash;2 d&iacute;as</strong> con revisiones incluidas &mdash; dep&oacute;sito de 15&nbsp;&euro;, abonado &iacute;ntegramente en pedidos de 5+ camisetas'),
]
IT = [
    (rf'Mockup di design in 1{D}2 giorni, gratis\.', 'Mockup di design in 24&ndash;48 h. Gratis nel designer 3D; acconto di 15&nbsp;&euro; se lo costruisce un designer, interamente accreditato sugli ordini da 5+ maglie.'),
    (rf'7{D}15 giorni di produzione', '7&ndash;12 giorni di produzione'),
    (r'in 1&ndash;2 giorni, gratis</strong>, con revisioni incluse', 'in 1&ndash;2 giorni</strong> con revisioni incluse &mdash; acconto di 15&nbsp;&euro;, interamente accreditato sugli ordini da 5+ maglie'),
]

LD_PAIRS = {
    'en': [(r'Production takes 7–15 days', 'Production takes 7–12 days')],
    'us': [(r'Production takes 7–15 days', 'Production takes 7–12 days')],
    'es': [(r', con diseño profesional gratuito incluido', ', diseñada gratis en el diseñador 3D o a partir de un modelo Ready to Play con un 10 % de descuento'),
           (r'7–15 días de producción', '7–12 días de producción'),
           (r'El diseño gratuito está listo en 1–2 días tras recibir tu brief, revisiones incluidas\.', 'La maqueta de diseño está lista en 1–2 días tras recibir tu brief, revisiones incluidas (depósito de 15 €, abonado íntegramente en pedidos de 5+ camisetas).'),
           (r'en 1–2 días, gratis, con revisiones incluidas', 'en 1–2 días con revisiones incluidas — depósito de 15 €, abonado íntegramente en pedidos de 5+ camisetas')],
    'it': [(r'La produzione richiede 7–15 giorni', 'La produzione richiede 7–12 giorni')],
}
LD_RENAME = {'es': ('gratuito', '¿Cuánto cuesta el servicio de diseño?', 'Las vías en autoservicio son gratis: el diseñador 3D en tiempo real con más de 30 plantillas y los modelos Ready to Play del estudio con un 10 % de descuento. El servicio de diseño a medida — un diseñador MOMUTO construye tu maqueta en 1–2 días, revisiones incluidas — lleva un depósito de 15 €, abonado íntegramente en pedidos de 5+ camisetas.')}

def fix_ld(locale, content):
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', content, re.S)
    if not m: return content
    ld = json.loads(m.group(2))
    for q in ld.get('mainEntity', []):
        rn = LD_RENAME.get(locale)
        if rn and re.search(rn[0], q['name']): q['name'] = rn[1]; q['acceptedAnswer']['text'] = rn[2]; continue
        for pat, rep in LD_PAIRS.get(locale, []): q['acceptedAnswer']['text'] = re.sub(pat, rep, q['acceptedAnswer']['text'])
    return content[:m.start(2)] + '\n' + json.dumps(ld, ensure_ascii=False, indent=2) + '\n' + content[m.end(2):]

def fix_meta(page):
    page['meta_descript'] = re.sub(r'3-4 weeks', '25-30 days', page.get('meta_descript') or '')
    page['meta_descript'] = re.sub(r'3-4 semanas', '25-30 días', page['meta_descript'])
    page['meta_descript'] = re.sub(r'3-4 settimane', '25-30 giorni', page['meta_descript'])
    page['meta_descript'] = re.sub(r'3-4 semaines', '25-30 jours', page['meta_descript'])
    if not isinstance(page.get('meta_keywords'), list): page['meta_keywords'] = []

def write_cms(locale, handle, content, extra=None):
    f = ROOT / 'cms' / 'pages' / locale / f'{handle}.json'
    if not f.exists(): print(f'⚠️  {locale}: {f.name} not pulled — fragment fixed only'); return
    page = json.loads(f.read_text())
    page['content'] = content; fix_meta(page)
    if extra: page.update(extra)
    f.write_text(json.dumps(page, ensure_ascii=False, indent=2) + '\n')
    print(f'✅ {locale}: {handle} (id {page["id"]})')

# EN fragment -> EN object
en = fix_ld('en', apply((ROOT / 'pages/contact').read_text(), EN, 'en'))
(ROOT / 'pages/contact').write_text(en)
write_cms('en', 'contact', en)

# US = EN fragment in US lexicon (soccer, USD ladder from docs/us-launch-status.md)
US_MAP = [(r'\bfootball\b', 'soccer'), (r'\bFootball\b', 'Soccer'),
          (r'&euro;38\.90', '$45.90'), (r'€38\.90', '$45.90'), (r'&euro;26\.90', '$30.90'), (r'€26\.90', '$30.90'),
          (r'&euro;15', '$15'), (r'€15', '$15'), (r'colour', 'color'), (r'customis', 'customiz'),
          (r'https://www\.momuto\.com/', '/'), (r'"inLanguage": "en-GB"', '"inLanguage": "en-US"')]
us = en
for pat, rep in US_MAP: us = re.sub(pat, rep, us)
prose = re.sub(r'href="[^"]*"', '', us)
if re.search(r'€|&euro;|\bfootball\b|\bEUR\b', prose): sys.exit('us: EUR/football leaked')
write_cms('us', 'contact', us, {'meta_title': 'Contact MOMUTO | Custom Soccer Kits & Team Jersey Design',
                                'meta_descript': "Contact MOMUTO for custom soccer kits and team jerseys. Free 3D designer, mockup in 24-48 h, delivered in 25-30 days. We're here to help you play!"})

es = fix_ld('es', apply((ROOT / 'pages/contacto').read_text(), ES, 'es')); (ROOT / 'pages/contacto').write_text(es); write_cms('es', 'contacto', es)
it = fix_ld('it', apply((ROOT / 'pages/contattaci').read_text(), IT, 'it')); (ROOT / 'pages/contattaci').write_text(it); write_cms('it', 'contattaci', it)

# FR: no fragment — the live object is the source. HTML uses entities, JSON-LD plain chars.
FR_HTML = [
    (r'Maquette design en 1&ndash;2 jours, gratuite\.', "Maquette design en 24&ndash;48 h. Gratuite dans le designer 3D ; acompte de 15&nbsp;&euro; pour une maquette construite par un designer, int&eacute;gralement d&eacute;duit des commandes de 5 maillots et plus."),
    (r'Maquette en 1&ndash;2 jours, gratuite\.', 'Maquette en 24&ndash;48 h.'),
    (r'&mdash; design professionnel gratuit inclus', "&mdash; con&ccedil;u gratuitement dans le designer 3D ou &agrave; partir d'un mod&egrave;le Ready to Play &agrave; -10 %"),
    (r'7&ndash;15 jours de production', '7&ndash;12 jours de production'),
    (r'Votre maquette design gratuite est pr&ecirc;te en <strong>1&ndash;2 jours</strong> apr&egrave;s r&eacute;ception de votre brief, r&eacute;visions incluses\.', "Votre maquette design est pr&ecirc;te en <strong>1&ndash;2 jours</strong> apr&egrave;s r&eacute;ception de votre brief, r&eacute;visions incluses (acompte de 15&nbsp;&euro;, int&eacute;gralement d&eacute;duit des commandes de 5 maillots et plus)."),
    (r'Le service design est-il vraiment gratuit \?</summary>', 'Combien co&ucirc;te le service design ?</summary>'),
    (r'Oui, enti&egrave;rement gratuit\. Choisissez.*?votre commande\.', "Les voies en autonomie sont gratuites : le designer 3D en temps r&eacute;el avec plus de 30 templates et les mod&egrave;les Ready to Play du studio &agrave; -10 %. Vous pr&eacute;f&eacute;rez qu'un designer professionnel la construise ? Maquette en 1&ndash;2 jours, r&eacute;visions incluses &mdash; acompte de 15&nbsp;&euro;, int&eacute;gralement d&eacute;duit des commandes de 5 maillots et plus : pour une &eacute;quipe, le design ne co&ucirc;te rien."),
    (r"Gratuit pour les commandes de 10 maillots et plus\.(?:</strong>)? Un acompte de 30&nbsp;&euro; peut s'appliquer pour les designs tr&egrave;s complexes, int&eacute;gralement d&eacute;duit de votre commande\.", "Un acompte de 15&nbsp;&euro; s'applique aux demandes 100 % sur mesure, int&eacute;gralement d&eacute;duit des commandes de 5 maillots et plus &mdash; offert pour une commande d'&eacute;quipe."),
    (r'en 1&ndash;2 jours, gratuitement</strong>, r&eacute;visions incluses', 'en 1&ndash;2 jours</strong> avec r&eacute;visions incluses &mdash; acompte de 15&nbsp;&euro;, int&eacute;gralement d&eacute;duit des commandes de 5 maillots et plus'),
]
FR_LD = [
    (r', design professionnel gratuit inclus', ", conçu gratuitement dans le designer 3D ou à partir d'un modèle Ready to Play à -10 %"),
    (r'7–15 jours de production', '7–12 jours de production'),
    (r'La maquette design gratuite est livrée en 1–2 jours après réception de votre brief, révisions incluses\.', 'La maquette design est livrée en 1–2 jours après réception de votre brief, révisions incluses (acompte de 15 €, intégralement déduit des commandes de 5 maillots et plus).'),
    (r'en 1–2 jours, gratuitement, révisions incluses', 'en 1–2 jours avec révisions incluses — acompte de 15 €, intégralement déduit des commandes de 5 maillots et plus'),
    (r"Gratuit pour les commandes de 10 maillots et plus\. Un acompte de 30 € peut s'appliquer pour les designs très complexes, intégralement déduit de votre commande\.", "Un acompte de 15 € s'applique aux demandes 100 % sur mesure, intégralement déduit des commandes de 5 maillots et plus — offert pour une commande d'équipe."),
]
frf = ROOT / 'cms/pages/fr/contactez-nous.json'
if frf.exists():
    page = json.loads(frf.read_text()); c = page['content']
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', c, re.S)
    ld = json.loads(m.group(2))
    for q in ld['mainEntity']:
        if re.search(r'gratuit', q['name']):
            q['name'] = 'Combien coûte le service design ?'
            q['acceptedAnswer']['text'] = "Les voies en autonomie sont gratuites : le designer 3D en temps réel avec plus de 30 templates et les modèles Ready to Play du studio à -10 %. Le service de design sur mesure — un designer MOMUTO construit votre maquette en 1–2 jours, révisions incluses — prend un acompte de 15 €, intégralement déduit des commandes de 5 maillots et plus."
        else:
            for pat, rep in FR_LD: q['acceptedAnswer']['text'] = re.sub(pat, rep, q['acceptedAnswer']['text'])
    c = c[:m.start(2)] + '\n' + json.dumps(ld, ensure_ascii=False, indent=2) + '\n' + c[m.end(2):]
    c = apply(c, FR_HTML, 'fr')
    # centring: FR predates the qualified hero-promise rule (docs/cms-page-gotchas.md, .mo-editor-reset)
    en_rule = re.search(r'\.cnt-hero \.cnt-hero-promise \{[^}]*\}', (ROOT / 'pages/contact').read_text()).group(0)
    c = re.sub(r'(?<![\w.-])\.cnt-hero-promise \{[^}]*\}', en_rule, c)
    page['content'] = c; fix_meta(page); frf.write_text(json.dumps(page, ensure_ascii=False, indent=2) + '\n')
    print(f'✅ fr: contactez-nous (id {page["id"]})')
    t = re.sub(r'<[^>]+>', ' ', c)
    print('-- fr:'); [print('   ', h.replace('\n', ' ')) for h in re.findall(r'.{50}gratuit\w*.{50}', t, re.I)]
    if re.search(r'30 ?(€|&euro;|&nbsp;&euro;)', c): sys.exit('fr: €30 still present')

# leftover audit: any "free"/"gratis" still attached to the design service?
for name, txt in (('en', en), ('us', us), ('es', es), ('it', it)):
    t = re.sub(r'<[^>]+>', ' ', txt)
    hits = [m.group(0) for m in re.finditer(r'.{50}(?:free|gratis|gratuit)\w*.{50}', t, re.I)]
    print(f'-- {name}: {len(hits)} free/gratis mentions'); [print('   ', h.replace('\n', ' ')) for h in hits]
