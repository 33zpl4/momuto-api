'use strict';
// node --test test/wa-bot.test.js
const test = require('node:test');
const assert = require('node:assert');
const bot = require('../lib/wa-bot');
const hours = require('../lib/wa-hours');
const answers = require('../lib/wa-bot-answers.json');

const OPEN = new Date('2026-10-16T10:00:00Z');   // Fri 12:00 Madrid
const NIGHT = new Date('2026-10-16T21:30:00Z');  // Fri 23:30 Madrid
const SAT_PM = new Date('2026-10-17T11:00:00Z'); // Sat 13:00 Madrid (closed)
const say = (text, state, now = OPEN) => bot.respond({ msg: { kind: 'text', text }, state, now });
const tap = (id, state, now = OPEN) => bot.respond({ msg: { kind: 'reply', id }, state, now });
const bodies = r => r.actions.map(a => a.body).join('\n');

test('hours: Mon-Fri 8-20, Sat 8-12, Sunday closed, Madrid time', () => {
  assert.ok(hours.isOpen(OPEN)); assert.ok(!hours.isOpen(NIGHT)); assert.ok(!hours.isOpen(SAT_PM));
  assert.ok(!hours.isOpen(new Date('2026-10-18T10:00:00Z')));                       // Sunday
  assert.ok(hours.isOpen(new Date('2026-10-17T09:59:00Z')));                        // Sat 11:59
  assert.ok(!hours.isOpen(new Date('2026-10-17T10:00:00Z')));                       // Sat 12:00
  assert.match(hours.nextOpenLabel(NIGHT, 'en'), /^tomorrow at 8:00/);
  assert.match(hours.nextOpenLabel(SAT_PM, 'en'), /^Monday at 8:00/);
  assert.match(hours.nextOpenLabel(SAT_PM, 'us'), /\[2:00 AM ET\]$/);               // US time in brackets
  assert.match(hours.nextOpenLabel(SAT_PM, 'fr'), /^lundi à 8:00/);
});
test('DST: US bracket follows the date (Madrid shifts 25 Oct, US 1 Nov)', () => {
  assert.match(hours.nextOpenLabel(new Date('2026-10-28T21:30:00Z'), 'us'), /\[3:00 AM ET\]$/);
});

test('website prefill greets in the right language and store, ref is kept', () => {
  let r = say('Hi MOMUTO, I have a question about… (design ref: abc123)');
  assert.equal(r.event, 'greet'); assert.equal(r.state.lang, 'en'); assert.equal(r.state.ref, 'abc123');
  assert.equal(r.actions[0].kind, 'buttons'); assert.equal(r.actions[0].buttons.length, 3);
  assert.equal(say('Hi MOMUTO, I have a question about… (US)').state.lang, 'us');
  assert.equal(say('Hola MOMUTO, tengo una pregunta sobre…').state.lang, 'es');
  assert.equal(say("Bonjour MOMUTO, j'ai une question sur ma commande.").state.lang, 'fr');
  assert.equal(say('Ciao MOMUTO, ho una domanda sul mio ordine.').event, 'greet');
  assert.equal(say('Hi MOMUTO, I need help with my design. (design ref: x1y2z3)').event, 'greet');   // 14 Oct wording
});
test('price question edited into the prefill is answered, not greeted (the 3-in-24h case)', () => {
  const r = say('Hi MOMUTO, I have a question about the price (design ref: abc123)');
  assert.equal(r.event, 'answer:prices'); assert.match(bodies(r), /€38\.90/); assert.doesNotMatch(bodies(r), /\$/);
  const us = say('Hi MOMUTO, I have a question about price (US)');
  assert.equal(us.event, 'answer:prices'); assert.match(bodies(us), /\$45\.90/);
});
test('keywords in each language', () => {
  const cases = [['¿cuánto cuesta una camiseta?', 'prices'], ['combien coûte un maillot', 'prices'], ['quanto costa la maglia', 'prices'],
    ['how long is delivery', 'delivery'], ['plazo de entrega', 'delivery'], ['délai de livraison', 'delivery'], ['tempi di spedizione', 'delivery'],
    ['what fabric is it', 'fabric'], ['is the logo sewn?', 'printing'], ['tallas para niños', 'sizes'], ['can I get long sleeves', 'extras'],
    ['do you have a deposit', 'design'], ['can I return it', 'returns'], ['are you open on saturday', 'hours']];
  for (const [t, topic] of cases) assert.equal(say(t).event, 'answer:' + topic, t);
  assert.equal(say('what is the price in dollars').state.lang, 'us');
});
test('"Europe" does not read as euro prices', () => assert.notEqual(say('do you ship to europe').event, 'answer:prices'));

test('handoff: button, free text, complaint, media; in hours vs out of hours', () => {
  for (const r of [tap('t:human'), say('can I talk to a person?'), say('my order arrived damaged'), bot.respond({ msg: { kind: 'media' }, state: {}, now: OPEN })])
    assert.match(r.event, /^handoff/);
  assert.match(bodies(tap('t:human')), /generally within 1–2 hours/);
  assert.match(bodies(tap('t:human', {}, NIGHT)), /opens tomorrow at 8:00/);
  assert.match(bodies(tap('t:human', { lang: 'us' }, SAT_PM)), /Monday at 8:00 \(Madrid time\) \[2:00 AM ET\]/);
});
test('after a handoff the bot goes quiet for 12 h from when the team is on', () => {
  let r = tap('t:human', {}, OPEN);
  assert.equal(say('hello?', r.state, new Date(OPEN.getTime() + 3600e3)).event, 'muted');
  assert.notEqual(say('hello?', r.state, new Date(OPEN.getTime() + 13 * 3600e3)).event, 'muted');
  r = tap('t:human', {}, NIGHT);                                                   // asked at night: bot still answers until 08:00
  assert.equal(say('and the price?', r.state, new Date(NIGHT.getTime() + 3600e3)).event, 'answer:prices');
  assert.equal(say('anyone?', r.state, new Date('2026-10-17T07:30:00Z')).event, 'muted');   // 09:30 Madrid, team is on
});
test('two misses in a row hand off; a hit resets', () => {
  let r = say('blorp'); assert.equal(r.event, 'miss');
  r = say('zzz', r.state); assert.equal(r.event, 'handoff:miss');
  r = say('blorp'); r = say('price?', r.state); assert.equal(r.state.miss, 0);
});
test('out of hours the greeting says when the team is back', () => {
  assert.match(bodies(say('hi', {}, NIGHT)), /back tomorrow at 8:00/);
  assert.doesNotMatch(bodies(say('hi', {}, OPEN)), /offline/);
});

test('WhatsApp limits: list rows <=24 chars, button titles <=20, body <=1024, text <=4096, max 3 buttons / 10 rows', () => {
  for (const lang of ['en', 'es', 'fr', 'it']) {
    const u = bot.UI[lang];
    for (const t of bot.ROW_ORDER) assert.ok(u.rows[t].length <= 24, `${lang} row ${t}`);
    assert.ok(u.listButton.length <= 20); assert.ok(u.menu.length <= 20); assert.ok(u.person.length <= 20);
    for (const b of Object.values(u.buttons)) assert.ok(b.length <= 20, `${lang} ${b}`);
    assert.ok(u.welcome.length < 900);
  }
  for (const lang of Object.keys(answers)) for (const [t, a] of Object.entries(answers[lang])) assert.ok(a.length <= 4000, `${lang}.${t} ${a.length}`);
  assert.equal(bot.ROW_ORDER.length, 10);
});
test('every topic answers in every language, from the FAQ numbers', () => {
  for (const lang of ['en', 'us', 'es', 'fr', 'it']) for (const t of bot.ROW_ORDER.filter(x => x !== 'human' && x !== 'hours')) {
    const r = bot.respond({ msg: { kind: 'reply', id: 't:' + t }, state: { lang }, now: OPEN });
    assert.ok(r.actions[0].body.length > 40, `${lang}/${t}`); assert.equal(r.actions[1].kind, 'buttons');
  }
  assert.match(answers.en.delivery, /25–30/); assert.match(answers.en.delivery, /7–12/); assert.match(answers.en.fabric, /92% polyester, 8% elastane/);
  assert.match(answers.us.extras, /\$69/); assert.match(answers.en.extras, /€59/);
});

test('"I have a design in mind": build it in the 3D designer first, then the custom design page of THAT store with the deposit line', () => {
  const link = { en: 'https://www.momuto.com/pages/request-custom-kit-design', us: 'https://us.momuto.com/pages/request-custom-kit-design',
    es: 'https://es.momuto.com/pages/solicitud-de-diseno-personalizado', fr: 'https://fr.momuto.com/pages/demande-de-design-professionnel-de-maillots', it: 'https://it.momuto.com/pages/richiesta-design-personalizzato' };
  for (const lang of Object.keys(link)) {
    const a = answers[lang].design;
    assert.ok(a.endsWith(link[lang]), lang); assert.match(a, /15/); assert.match(a, /5\+|5 maillots/); assert.doesNotMatch(a, /refund|rembours|reembols|rimbors/i);
    assert.ok(a.indexOf('3D') < a.indexOf('100'), `${lang}: the 3D designer comes before the custom service`);
  }
  assert.match(answers.us.design, /\$15/); assert.match(answers.en.design, /€15/);
  for (const t of ['can you make this exact jersey', 'quiero una camiseta a medida', 'je veux un maillot sur mesure', 'vorrei una maglia su misura', 'i have a sketch'])
    assert.equal(say(t).event, 'answer:design', t);
});
