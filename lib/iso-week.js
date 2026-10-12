'use strict';
// ISO-8601 week labels ("2026-W41", weeks start Monday, UTC). Shared by the event beacon, the admin metrics action and the scorecard.
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const wk = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
// the n most recent COMPLETE-or-current weeks, oldest first
function lastWeeks(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoWeek(new Date(now.getTime() - i * 7 * 86400000)));
  return [...new Set(out)];
}
module.exports = { isoWeek, lastWeeks };
