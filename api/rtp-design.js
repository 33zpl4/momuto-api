'use strict';

/**
 * POST /api/rtp-design — Ready-to-Play 2D configurator design notification
 *
 * The RTP 2D configurator (public/configurator/embed.js) posts the finished
 * design here right before it hands the shopper off to the cart. This endpoint
 * is the GUARANTEED source of truth for what the customer designed: it emails
 * ops (info@momuto.com) the hex colours, name/number font + colour, kit, qty,
 * product/OEM/order ids, and the uploaded logos + preview — attaching the files
 * it receives and linking the OSS URLs embed.js already generated.
 *
 * It deliberately does NOT touch the order/cart POST, so it carries zero
 * checkout risk and is safe to deploy independently.
 *
 * Receives multipart/form-data (Busboy), matching api/submit.js.
 *
 * Env vars:
 *   RESEND_API_KEY — resend.com
 *   TEAM_EMAIL     — where notifications go (default info@momuto.com)
 *   FROM_EMAIL     — verified sender (default info@momuto.com)
 */

const Busboy = require('busboy');

const RESEND_KEY = process.env.RESEND_API_KEY;
const TEAM_EMAIL = process.env.TEAM_EMAIL || 'info@momuto.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@momuto.com';

const ALLOWED_ORIGINS = [
  'https://momuto.com',
  'https://www.momuto.com',
  'https://es.momuto.com',
  'https://fr.momuto.com',
  'https://it.momuto.com',
];

function matchOrigin(req) {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  const referer = req.headers['referer'] || '';
  return ALLOWED_ORIGINS.find(o => referer.startsWith(o)) || '';
}

function setCors(req, res) {
  const allowed = matchOrigin(req);
  // embed.js posts a simple multipart request; the request reaches us regardless,
  // but echoing the origin lets it read our JSON response instead of a CORS error.
  res.setHeader('Access-Control-Allow-Origin', allowed || 'https://www.momuto.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Parse multipart form (keep file buffers for attachment) ──────────────────

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 15 * 1024 * 1024, files: 6 }, // 15 MB per file
    });

    const fields = {};
    const files = [];

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (fieldName, stream, info) => {
      const { filename, mimeType } = info;
      if (!filename) { stream.resume(); return; }
      const chunks = [];
      stream.on('data', c => chunks.push(c));
      stream.on('close', () => {
        files.push({ fieldName, filename, mimeType, buffer: Buffer.concat(chunks) });
      });
    });

    bb.on('close', () => resolve({ fields, files }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

// ── Build ops email ──────────────────────────────────────────────────────────

function buildEmail(fields, files) {
  const g = k => (fields[k] == null ? '' : String(fields[k]));
  const template = g('template') || '—';
  const kit      = g('kit') === 'kit' ? 'Full kit (jersey + shorts)' : 'Jersey only';
  const qty      = g('qty') || '—';

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.82rem;
                 text-transform:uppercase;letter-spacing:0.06em;color:#71717a;
                 background:#f9f9f9;white-space:nowrap;width:170px">${label}</td>
      <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${value || '—'}</td>
    </tr>`;

  const swatch = hex => hex
    ? `<span style="display:inline-block;width:14px;height:14px;background:${hex};
                    border:1px solid #ccc;vertical-align:middle;margin-right:6px;
                    border-radius:2px"></span><code style="font-size:0.8rem">${hex}</code>`
    : '—';

  const link = (label, url) => url
    ? `<a href="${url}" style="color:#c8352e;font-weight:600">${label}</a>`
    : '<span style="color:#a1a1aa">—</span>';

  // A logo cell shows whether the file is attached and links its OSS copy if present.
  const logoCell = (fieldName, url) => {
    const f = files.find(x => x.fieldName === fieldName);
    const parts = [];
    if (f) parts.push(`attached (${Math.round(f.buffer.length / 1024)} KB)`);
    if (url) parts.push(link('OSS link', url));
    if (!parts.length) return '<span style="color:#a1a1aa">Not uploaded</span>';
    return parts.join(' &middot; ');
  };

  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
    <span style="float:right;background:#c8352e;color:#fff;font-size:0.7rem;font-weight:700;
                 letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;margin-top:4px">RTP Design</span>
  </div>
  <div style="padding:24px">
    <h2 style="margin:0 0 4px;font-size:1.15rem;color:#0a0a0a">${template} — ${kit}</h2>
    <p style="margin:0 0 20px;font-size:0.85rem;color:#71717a">${qty} units · Ready-to-Play 2D configurator</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
      ${row('Template', template)}
      ${row('Kit', kit)}
      ${row('Quantity', qty)}
      ${row('Primary',   swatch(g('primary')))}
      ${row('Secondary', swatch(g('secondary')))}
      ${row('Trim / cuffs', swatch(g('trim')))}
      ${row('Name / number colour', swatch(g('nameColor')))}
      ${row('Font', g('fontLabel') || g('font'))}
      ${row('Crest', logoCell('crest', g('crestUrl')))}
      ${row('Sponsor', logoCell('sponsor', g('sponsorUrl')))}
      ${row('Preview', `${link('Front', g('previewFrontUrl'))} &middot; ${link('Back', g('previewBackUrl'))}`)}
      ${row('Product ID', g('productId'))}
      ${row('OEM ID', g('oemId'))}
      ${row('Order / UUID', g('userId'))}
      ${row('Language', g('lang'))}
      ${g('source') ? row('Source', `<a href="${g('source')}" style="color:#c8352e;font-size:0.8rem">${g('source')}</a>`) : ''}
    </table>

    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Sent by the MOMUTO RTP configurator &middot; uploaded logos are attached to this email;
      OSS links point to design.momuto.com copies.
    </p>
  </div>
</div>`;

  const subject = `RTP Design — ${template} — ${kit} · ${qty} units`;

  // Attach every file we received (logos + any previews), base64 for Resend.
  const attachments = files.map(f => ({
    filename: f.filename || `${f.fieldName}.png`,
    content: f.buffer.toString('base64'),
  }));

  return { subject, html, attachments };
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(subject, html, attachments) {
  if (!RESEND_KEY) {
    console.warn('[rtp-design] RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `MOMUTO RTP <${FROM_EMAIL}>`,
      to: [TEAM_EMAIL],
      subject,
      html,
      attachments,
    }),
  });
  if (!res.ok) {
    console.error('[rtp-design] Resend error:', res.status, await res.text());
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!matchOrigin(req)) {
    console.warn('[rtp-design] blocked: origin=%s referer=%s', req.headers['origin'], req.headers['referer']);
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { fields, files } = await parseForm(req);
    const { subject, html, attachments } = buildEmail(fields, files);
    await sendEmail(subject, html, attachments);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[rtp-design] fatal:', err.message);
    // Non-fatal to the caller: the configurator awaits this best-effort and proceeds regardless.
    return res.status(200).json({ ok: false, error: err.message });
  }
};
