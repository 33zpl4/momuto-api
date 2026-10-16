'use strict';
/**
 * Plain-text rendering of the bot's actions, for channels without WhatsApp buttons/lists (Twilio, 16 Oct 2026).
 * Menus become numbered lines; a bare number typed back is read by lib/wa-bot.js as a tap on that row
 * (0 = the topic list, 1-10 = ROW_ORDER, 10 = "talk to a person"). Twilio caps a WhatsApp body at 1600 characters.
 */
const { UI, ROW_ORDER } = require('./wa-bot');

const MAX = 1500;
const numberOf = id => (id === 'menu' ? 0 : ROW_ORDER.indexOf(String(id).replace(/^t:/, '')) + 1);

function menuLines(lang) {
  const u = UI[lang];
  return ROW_ORDER.map((t, i) => `${i + 1} · ${u.rows[t]}`).join('\n');
}
function one(a, lang) {
  if (a.kind === 'text') return a.body;
  if (a.kind === 'list') return `${a.body}\n${a.rows.map(r => `${numberOf(r.id)} · ${r.title}`).join('\n')}`;
  if (a.welcome) return `${a.body}\n\n${menuLines(lang)}`;
  return `${a.body}\n${a.buttons.map(b => `${numberOf(b.id)} · ${b.title}`).join('\n')}`;
}
function chunk(text) {
  if (text.length <= MAX) return [text];
  const out = []; let cur = '';
  for (const part of text.split('\n\n')) {
    if (cur && (cur + '\n\n' + part).length > MAX) { out.push(cur); cur = part; } else cur = cur ? cur + '\n\n' + part : part;
  }
  if (cur) out.push(cur);
  return out.flatMap(c => (c.length <= MAX ? [c] : c.match(new RegExp(`[\\s\\S]{1,${MAX}}`, 'g'))));
}
/** actions -> array of message bodies, each <= MAX characters */
function renderText(actions, lang) {
  return actions.flatMap(a => chunk(one(a, lang || 'en')));
}
module.exports = { renderText, menuLines, MAX };
