'use strict';
/**
 * WhatsApp team hours (owner, 16 Oct 2026): Mon-Fri 08:00-20:00, Sat 08:00-12:00, Europe/Madrid. Sunday closed.
 * All clock maths goes through Intl with an explicit time zone (never the server's local time, which is UTC on Vercel).
 * US customers get the equivalent Eastern time in brackets (computed from the date, so DST differences between
 * Madrid and the US are right in the weeks they do not change on the same day).
 */
const TZ = 'Europe/Madrid';
const US_TZ = 'America/New_York';
const HOURS = { 1: [8, 20], 2: [8, 20], 3: [8, 20], 4: [8, 20], 5: [8, 20], 6: [8, 12] };   // JS getDay(): 0 = Sunday
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const QUARTER = 15 * 60 * 1000;

const fmtParts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' });
function local(date) {
  const p = Object.fromEntries(fmtParts.formatToParts(date).map(x => [x.type, x.value]));
  return { dow: WD[p.weekday], hour: +p.hour, minute: +p.minute, ymd: `${p.year}-${p.month}-${p.day}` };
}
function isOpen(date) {
  const l = local(date), h = HOURS[l.dow];
  return !!h && l.hour >= h[0] && l.hour < h[1];
}
/** The next instant the team is on (the opening minute), or `date` itself when open now. */
function nextOpen(date) {
  if (isOpen(date)) return date;
  let t = Math.ceil(date.getTime() / QUARTER) * QUARTER;
  for (let i = 0; i < 8 * 96; i++, t += QUARTER) if (isOpen(new Date(t))) return new Date(t);
  return null;
}

const LOCALE = { en: 'en-GB', us: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' };
const WORD = {
  en: { today: 'today', tomorrow: 'tomorrow', at: 'at', madrid: 'Madrid time' },
  us: { today: 'today', tomorrow: 'tomorrow', at: 'at', madrid: 'Madrid time' },
  es: { today: 'hoy', tomorrow: 'mañana', at: 'a las', madrid: 'hora de Madrid' },
  fr: { today: "aujourd'hui", tomorrow: 'demain', at: 'à', madrid: 'heure de Madrid' },
  it: { today: 'oggi', tomorrow: 'domani', at: 'alle', madrid: 'ora di Madrid' },
};
const hm = l => `${l.hour}:${String(l.minute).padStart(2, '0')}`;
function usTime(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: US_TZ, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date).replace(/\sE[SD]T$/, ' ET');
}

/** "tomorrow at 8:00 (Madrid time)" / "Monday at 8:00 (Madrid time)"; US adds "(2:00 AM ET)". */
function nextOpenLabel(now, lang) {
  const w = WORD[lang], n = nextOpen(now);
  if (!n) return '';
  const ln = local(n), lnow = local(now);
  const dayMs = 86400000;
  const tomorrow = local(new Date(now.getTime() + dayMs)).ymd;
  const when = ln.ymd === lnow.ymd ? w.today : ln.ymd === tomorrow ? w.tomorrow
    : new Intl.DateTimeFormat(LOCALE[lang], { timeZone: TZ, weekday: 'long' }).format(n);
  const base = `${when} ${w.at} ${hm(ln)} (${w.madrid})`;
  return lang === 'us' ? `${base} [${usTime(n)}]` : base;
}

/** The standing hours line for the "hours" topic. */
function hoursLine(now, lang) {
  const w = WORD[lang];
  const eu = { en: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', us: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', es: 'lun–vie 8:00–20:00, sáb 8:00–12:00', fr: 'lun–ven 8h00–20h00, sam 8h00–12h00', it: 'lun–ven 8:00–20:00, sab 8:00–12:00' }[lang];
  if (lang !== 'us') return `${eu} (${w.madrid})`;
  // 8:00 and 20:00 Madrid today, expressed in Eastern time
  const open = nextOpenAtHour(now, 8), mid = nextOpenAtHour(now, 20);
  return `${eu} (${w.madrid}) [Mon–Fri ${usTime(open).replace(/ ET$/, '')}–${usTime(mid)}]`;
}
// UTC instant of Madrid wall-clock `hour`:00 on the same Madrid calendar day as `now`
function nextOpenAtHour(now, hour) {
  const ymd = local(now).ymd;
  for (let t = now.getTime() - 36 * 3600000; t < now.getTime() + 36 * 3600000; t += 60000) {
    const l = local(new Date(t));
    if (l.ymd === ymd && l.hour === hour && l.minute === 0) return new Date(t);
  }
  return now;
}

module.exports = { isOpen, nextOpen, nextOpenLabel, hoursLine, local, TZ };
