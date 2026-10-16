'use strict';
/**
 * Builds lib/wa-bot-answers.json (the WhatsApp bot's canned answers) from the FAQ source files.
 *
 *   node scripts/build-wa-bot-answers.js          write lib/wa-bot-answers.json
 *   node scripts/build-wa-bot-answers.js --check  exit 1 if the committed file is stale (PR check)
 *
 * One set of numbers (CLAUDE.md rule 6): every price/time in the bot comes from faq/faq.<locale>.json, the same
 * files that render the five FAQ pages. Never edit lib/wa-bot-answers.json by hand; edit the FAQ and re-run.
 * Topics are picked by section id + item index; the script asserts the shape so a reordered FAQ fails loudly
 * instead of sending the wrong answer to a customer.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'lib', 'wa-bot-answers.json');
const LOCALES = ['en', 'us', 'es', 'fr', 'it'];

// topic -> [section id, item index, expected opening of the question (EN/US only, shape guard)]
const PICKS = {
  delivery: [['delivery', 0, /how long/i], ['delivery', 1, /faster/i]],
  fabric: [['fabric', 0, /fabric/i]],
  printing: [['fabric', 1, /printed/i], ['customization', 0, /extra/i], ['customization', 1, /logo/i]],
  sizes: [['sizes', 1, /sizes exist/i], ['sizes', 0, /fit/i]],
  design: [['ordering', 0, /ways to get/i], ['ordering', 1, /before I see/i]],
  returns: [['returns', 0, /return a custom/i], ['returns', 3, /cancel/i]],
};
// pricing notes shown by the "extras" topic (index into pricing.notes) and the one shown under the ladder
const EXTRAS_NOTES = [2, 3, 4, 6, 7];
const LADDER_NOTE = 5;

function text(html, base) {
  return String(html)
    .replace(/<a [^>]*href="mailto:([^"]+)"[^>]*>[^<]*<\/a>/gi, '$1')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_, h, t) => `${t} (${/^https?:/.test(h) ? h : base + h})`)
    .replace(/<b>([^<]*)<\/b>/gi, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;|&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n').trim();
}
const ITEM_Q = it => it[0], ITEM_A = it => it[1];

function build() {
  const out = {};
  for (const loc of LOCALES) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'faq', `faq.${loc}.json`), 'utf8'));
    const sec = Object.fromEntries(d.sections.map(s => [s.id, s.items]));
    const base = d.base;
    const A = {};
    for (const [topic, picks] of Object.entries(PICKS)) {
      A[topic] = picks.map(([sid, i, guard]) => {
        const item = sec[sid] && sec[sid][i];
        if (!item) throw new Error(`${loc}: no item ${sid}[${i}]`);
        if ((loc === 'en' || loc === 'us') && !guard.test(ITEM_Q(item))) throw new Error(`${loc}: ${sid}[${i}] is "${ITEM_Q(item)}", expected ${guard}`);
        return text(ITEM_A(item), base);
      }).join('\n\n');
    }
    const p = d.pricing;
    if (p.rows.length !== 7 || p.cols.length !== 4) throw new Error(`${loc}: pricing table shape changed`);
    const ladder = p.rows.map(r => `${r[0]}: ${r[1]} · ${r[3]}`).join('\n');
    A.prices = `*${p.title}* (${p.cols[1]} · ${p.cols[3]})\n${ladder}\n\n${text(p.lead.split('.').slice(1, 2).join('.') + '.', base).trim()}\n${text(p.notes[LADDER_NOTE], base)}`;
    A.extras = EXTRAS_NOTES.map(i => text(p.notes[i], base)).join('\n\n');
    out[loc] = A;
  }
  return JSON.stringify(out, null, 2) + '\n';
}

const json = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== json) { console.error('lib/wa-bot-answers.json is stale: run node scripts/build-wa-bot-answers.js'); process.exit(1); }
  console.log('wa-bot-answers: up to date');
} else {
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${LOCALES.length} locales, ${json.length} bytes)`);
}
