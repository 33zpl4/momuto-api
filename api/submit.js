'use strict';

/**
 * POST /api/submit — MOMUTO kit design request handler (MVP)
 *
 * Receives multipart/form-data, uploads files to Vercel Blob,
 * emails the team via Resend, redirects user to thank-you page.
 *
 * Env vars:
 *   RESEND_API_KEY     — resend.com (free tier: 3 000 emails/mo)
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob (free tier: 1 GB)
 *   TEAM_EMAIL         — where notifications go, e.g. info@momuto.com
 *   FROM_EMAIL         — verified sender, e.g. leads@momuto.com
 *   THANK_YOU_URL      — redirect after submit
 */

const Busboy = require('busboy');
const { put } = require('@vercel/blob');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const TEAM_EMAIL  = process.env.TEAM_EMAIL  || 'info@momuto.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'leads@momuto.com';
const THANK_YOU   = process.env.THANK_YOU_URL
  || 'https://www.momuto.com/pages/customized-design-confirmed';

// ── Parse multipart form ─────────────────────────────────────────────────────

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB per file
    });

    const fields = {};
    const filePromises = [];

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (fieldName, stream, info) => {
      const { filename, mimeType } = info;
      if (!filename) { stream.resume(); return; } // skip empty file inputs

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('close', () => {
        const buffer = Buffer.concat(chunks);
        // Upload to Vercel Blob and collect the promise
        const uploadKey = `momuto-leads/${Date.now()}-${filename}`;
        filePromises.push(
          put(uploadKey, buffer, { access: 'public', contentType: mimeType })
            .then(blob => ({ fieldName, filename, mimeType, url: blob.url, size: buffer.length }))
            .catch(() => ({ fieldName, filename, mimeType, url: null, size: buffer.length }))
        );
      });
    });

    bb.on('close', async () => {
      const files = await Promise.all(filePromises);
      resolve({ fields, files });
    });
    bb.on('error', reject);
    req.pipe(bb);
  });
}

// ── Build team email ─────────────────────────────────────────────────────────

function buildEmail(fields, files) {
  const badge   = files.find(f => f.fieldName === 'upload_file');
  const concept = files.find(f => f.fieldName === 'design_concept');

  const qty = fields.orderSize || '—';
  const subject = `New Kit Request — ${fields.company || 'Unknown'} (${qty} kits)`;

  const fileRow = (label, file) => {
    if (!file) return row(label, '<span style="color:#a1a1aa">Not uploaded</span>');
    const link = file.url
      ? `<a href="${file.url}" style="color:#c8352e;font-weight:600">Download (${Math.round(file.size / 1024)} KB)</a>`
      : `${file.filename} (${Math.round(file.size / 1024)} KB) — upload failed`;
    return row(label, link);
  };

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.82rem;
                 text-transform:uppercase;letter-spacing:0.06em;color:#71717a;
                 background:#f9f9f9;white-space:nowrap;width:160px">${label}</td>
      <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${value}</td>
    </tr>`;

  const swatch = hex => hex
    ? `<span style="display:inline-block;width:14px;height:14px;background:${hex};
                    border:1px solid #ccc;vertical-align:middle;margin-right:6px;
                    border-radius:2px"></span><code style="font-size:0.8rem">${hex}</code>`
    : '—';

  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e4e4e7">

  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
    <span style="float:right;background:#c8352e;color:#fff;font-size:0.7rem;
                 font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                 padding:4px 10px;margin-top:4px">New Request</span>
  </div>

  <div style="padding:24px">
    <h2 style="margin:0 0 4px;font-size:1.15rem;color:#0a0a0a">
      ${fields.company || 'Unknown Team'}
    </h2>
    <p style="margin:0 0 20px;font-size:0.85rem;color:#71717a">${qty} kits</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${row('Name',    fields.firstname || '—')}
      ${row('Email',   fields.email
        ? `<a href="mailto:${fields.email}" style="color:#c8352e">${fields.email}</a>`
        : '—')}
      ${row('Team',    fields.company   || '—')}
      ${row('League',  fields.industry  || '—')}
      ${row('Qty',     qty)}
      ${row('Primary', swatch(fields.primaryColorValue))}
      ${row('Secondary', swatch(fields.secondaryColorValue))}
      ${row('Style',   fields.stylePreference ? `${fields.stylePreference} / 10` : '—')}
      ${fileRow('Badge',          badge)}
      ${fileRow('Design concept', concept)}
    </table>

    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Sent by MOMUTO form pipeline &middot; Reply-To: ${fields.email || '—'}
    </p>
  </div>
</div>`;

  return { subject, html };
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(fields, subject, html) {
  if (!RESEND_KEY) {
    console.warn('[submit] RESEND_API_KEY not set — skipping email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:     `MOMUTO Leads <${FROM_EMAIL}>`,
      to:       [TEAM_EMAIL],
      reply_to: fields.email || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[submit] Resend error:', res.status, body);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);
    const { subject, html } = buildEmail(fields, files);
    await sendEmail(fields, subject, html);
  } catch (err) {
    console.error('[submit] fatal:', err.message);
    // Always redirect — never expose errors to the user
  }

  res.redirect(302, THANK_YOU);
};
