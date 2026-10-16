'use strict';
/**
 * Copy-rules linter (12 Oct 2026). Turns the "hard rules that have burned us" in CLAUDE.md into a check that
 * runs on every PR, so a drift is caught by a machine, not by the owner reading a live page.
 *
 *   node scripts/check-copy-rules.js                 report NEW violations (exit 1 if any)
 *   node scripts/check-copy-rules.js --all           report every violation, baselined or not
 *   node scripts/check-copy-rules.js --update-baseline   accept the current state (review the diff!)
 *
 * Violations that already existed are recorded in scripts/copy-rules.baseline.json, so only NEW ones fail:
 * the rule set can start strict without a clean-up project, and the baseline only ever shrinks.
 * To add a rule: append to RULES (id, why, where, regex, optional ignore). Every time the owner corrects the
 * same thing twice, it belongs here.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'copy-rules.baseline.json');

// customer-facing surfaces. blogs/ is editorial (may name clubs); api/ and lib/ FROM defaults are exempt for emails.
const PRODUCT = ['pages', 'cms/pages', 'faq', 'policies', 'maker', 'size-guide', 'cms/email-notifications/src', 'static/shared'];
const ALL_COPY = [...PRODUCT, 'blogs', 'lib/emails.js', 'lib/wa-bot.js', 'lib/wa-bot-answers.json'];

// a refund PROMISE (not an FAQ question about whether the credit is refundable)
const REFUND = /we(?:'|’|&rsquo;)ll refund|we will refund|we refund|refund your|full refund|fully refundable|(?:on )?vous rembourse|te devolvemos|te reembolsamos|ti rimborsiamo|rimborsiamo i|remboursons/i;
const DEPOSIT = /(€\s?15|15\s?€|\$\s?15|deposit|acompte|dep[oó]sito|anticipo|caparra)/i;

const RULES = [
  { id: 'deposit-refund', why: 'Rule 5: the deposit is a credit, never refund-forward (refund promise lives on the four gate pages only)',
    where: ALL_COPY, test: line => REFUND.test(line) && DEPOSIT.test(line),
    allow: ['pages/request-custom-kit-design', 'pages/solicitud-de-diseno-personalizado', 'pages/demande-de-design-professionnel-de-maillots', 'pages/richiesta-design-personalizzato'] },   // the four request/gate pages may carry the refund promise
  { id: 'bare-free-design', why: 'Rule 5: "free design" only as "free design for teams" + the deposit condition (EN/ES/FR/IT)',
    where: ALL_COPY, regex: /free (custom |professional )?design(?! for teams)|design (is )?always free|dise[ñn]o (siempre )?gratis(?! para (los )?equipos)|dise[ñn]o gratuito(?! para (los )?equipos)|design (toujours )?gratuite?s?\b(?! pour (les )?[ée]quipes)|design (sempre )?gratuit[oa](?! per (i )?(team|squadre)| per le squadre)|progettazione gratuita|design sempre gratis/i },
  { id: 'stale-price', why: 'Rule 6: from €21.90 (not €20.90) at 10+',
    where: ALL_COPY, regex: /from (€|\$)?20[.,]90|[àa] partir de 20,90|desde 20,90|da 20,90/i },
  { id: 'customer-email', why: 'Rule 8: one customer email, info@momuto.com',
    where: ALL_COPY, regex: /\b(customer|orders|leads)@momuto\.com\b/i },
  { id: 'studio-as-place', why: 'Naming grammar: "studio" is lowercase authorship, never a place',
    where: ALL_COPY, regex: /\b(Design Studio|Your Studio|Tu Taller de Creaci[oó]n|Votre Atelier de Cr[ée]ation|Il Tuo Studio di Design)\b/ },
  { id: 'stale-numbers', why: 'Rule 6: one set of numbers (no "3 weeks", no unsourced satisfaction %)',
    where: ALL_COPY, regex: /\b3[- ]weeks? (delivery|shipping|production|turnaround)|(deliver\w*|ship\w*|arriv\w*) in (about |around )?3 weeks|\b98 ?% (satisfaction|satisfecho|satisfait|soddisfatt)/i },
  { id: 'real-club-on-product-surface', why: 'Rule 4: never name real clubs/players on product surfaces (editorial blog only)',
    where: PRODUCT, regex: /\b(Real Madrid|FC Barcelona|Bar[cç]a\b|Manchester (United|City)|Liverpool|Arsenal|Bayern|Juventus|AC Milan|Inter Miami|Chelsea|Tottenham|Borussia|Atl[eé]tico de Madrid|Paris Saint)/,
    ignore: /Juventus Schoonaarde/ },   // a customer team whose name contains a club name
  { id: 'model-id-in-copy', why: 'Never put model identifiers in pushed artifacts',
    where: ALL_COPY, regex: /claude-(fable|opus|sonnet|haiku)-?\d/i },
];

function* walk(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isFile()) { yield p; return; }
  for (const e of fs.readdirSync(abs)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    yield* walk(path.join(p, e));
  }
}
const TEXTY = /\.(json|html|md|txt|js)$|^[^.]+$/;   // extensionless page fragments (pages/<handle>) included

function scan() {
  const out = [];
  const seen = new Set();
  for (const rule of RULES) {
    for (const base of rule.where) for (const f of walk(base)) {
      if (!TEXTY.test(path.basename(f)) || f.includes('/node_modules/')) continue;
      if (rule.allow && rule.allow.includes(f)) continue;
      const key = rule.id + '|' + f; if (seen.has(key)) continue; seen.add(key);
      let text; try { text = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
      // JSON/HTML content is one long line: scan sentence-sized windows so a hit shows context, not a whole page
      const chunks = text.split(/(?<=[.!?])\s+|\n|\\n|<\/(?:p|li|div|h\d)>/);
      chunks.forEach(ch => {
        const hit = rule.test ? rule.test(ch) : rule.regex.test(ch);
        if (hit && !(rule.ignore && rule.ignore.test(ch))) {
          const snip = ch.replace(/<[^>]+>/g, ' ').replace(/\\u[0-9a-f]{4}/gi, '').replace(/\s+/g, ' ').trim().slice(0, 140);
          out.push({ rule: rule.id, file: f, snippet: snip, id: rule.id + '|' + f + '|' + snip.slice(0, 80) });
        }
      });
    }
  }
  return out;
}

const found = scan();
const args = process.argv.slice(2);
if (args.includes('--json')) { console.log(JSON.stringify(found, null, 1)); process.exit(0); }
if (args.includes('--update-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify(found.map(v => v.id).sort(), null, 1) + '\n');
  console.log(`baseline written: ${found.length} violations accepted`);
  process.exit(0);
}
const base = new Set(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : []);
const fresh = found.filter(v => !base.has(v.id));
const show = args.includes('--all') ? found : fresh;
const byRule = {};
show.forEach(v => { (byRule[v.rule] = byRule[v.rule] || []).push(v); });
for (const [r, vs] of Object.entries(byRule)) {
  console.log(`\n✗ ${r} — ${RULES.find(x => x.id === r).why}`);
  vs.slice(0, 200).forEach(v => console.log(`   ${v.file}: ${v.snippet}`));
  if (vs.length > 25) console.log(`   … and ${vs.length - 25} more`);
}
const gone = [...base].filter(id => !found.some(v => v.id === id)).length;
console.log(`\n${fresh.length} new violation(s); ${found.length - fresh.length} baselined${gone ? `; ${gone} baselined entries no longer occur (run --update-baseline to shrink the baseline)` : ''}.`);
process.exit(fresh.length ? 1 : 0);
