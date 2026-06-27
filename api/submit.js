'use strict';

/**
 * POST /api/submit — MOMUTO kit design request handler
 * GET  /api/submit — list all design request leads (admin)
 *
 * Receives multipart/form-data, saves lead to Vercel KV,
 * uploads files to Vercel Blob, emails the team via Resend,
 * then redirects user to thank-you page.
 *
 * Env vars:
 *   RESEND_API_KEY     — resend.com
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob
 *   TEAM_EMAIL         — where notifications go
 *   FROM_EMAIL         — verified sender
 *   THANK_YOU_URL      — redirect after submit
 *   ADMIN_TOKEN        — for GET /api/submit
 */

const Busboy = require('busboy');
const { put } = require('@vercel/blob');
const { kv }  = require('@vercel/kv');
const { emailConceptReceived } = require('../lib/emails');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const TEAM_EMAIL  = process.env.TEAM_EMAIL  || 'info@momuto.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'leads@momuto.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const THANK_YOU_FALLBACK = process.env.THANK_YOU_URL
  || 'https://www.momuto.com/pages/customized-design-confirmed';

const ALLOWED_ORIGINS = [
  'https://momuto.com',
  'https://www.momuto.com',
  'https://es.momuto.com',
  'https://fr.momuto.com',
  'https://it.momuto.com',
];

function isAllowedOrigin(req) {
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  return (
    ALLOWED_ORIGINS.some(o => origin === o) ||
    ALLOWED_ORIGINS.some(o => referer.startsWith(o))
  );
}

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
  // RTP forms use different field names than the custom design form — normalise both
  const badge   = files.find(f => f.fieldName === 'upload_file' || f.fieldName === 'teamCrest');
  const concept = files.find(f => f.fieldName === 'design_concept' || f.fieldName === 'sponsorLogo');

  const name    = fields.firstname   || fields.contactName  || '—';
  const email   = fields.email       || fields.contactEmail || null;
  const team    = fields.company     || fields.teamName     || null;
  const league  = fields.industry    || null;
  const qty     = fields.orderSize   || fields.estimatedQty || '—';
  const design  = fields.Design      || fields.design       || null;
  const kitType = fields['Kit Type'] || fields['Type de kit'] || fields['Tipo de kit'] || fields['Tipo di kit'] || null;
  const trim    = fields['Trim Colour'] || fields['Couleur Bordures'] || fields['Color Bordes'] || null;
  const source  = fields._source_url || null;

  const subjectBase = design
    ? `Ready-to-Play: ${design} — ${team || 'Unknown'} (${qty} kits)`
    : `New Kit Request — ${team || 'Unknown'} (${qty} kits)`;
  const subject = subjectBase;

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
      ${team || 'Unknown Team'}
    </h2>
    <p style="margin:0 0 20px;font-size:0.85rem;color:#71717a">${qty} kits</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${source ? row('Source', `<a href="${source}" style="color:#c8352e;font-size:0.8rem">${source}</a>`) : ''}
      ${design ? row('Template', design) : ''}
      ${row('Name',   name)}
      ${row('Email',  email ? `<a href="mailto:${email}" style="color:#c8352e">${email}</a>` : '—')}
      ${row('Team',   team   || '—')}
      ${league ? row('League', league) : ''}
      ${row('Qty',    qty)}
      ${kitType ? row('Kit type', kitType) : ''}
      ${row('Primary',   swatch(fields.primaryColorValue || fields['Primary Colour'] || fields['Couleur Primaire'] || fields['Color Primario'] || ''))}
      ${row('Secondary', swatch(fields.secondaryColorValue || fields['Secondary Colour'] || fields['Couleur Secondaire'] || fields['Color Secundario'] || ''))}
      ${trim ? row('Trim / Cuffs', swatch(trim)) : ''}
      ${fields.stylePreference ? row('Style', `${fields.stylePreference} / 10`) : ''}
      ${fields.comments ? row('Comments', fields.comments) : ''}
      ${fileRow('Badge / Crest',  badge)}
      ${fileRow('Design concept', concept)}
    </table>

    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Sent by MOMUTO form pipeline &middot; Reply-To: ${email || '—'}
    </p>
  </div>
</div>`;

  return { subject, html, replyTo: email };
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(fields, subject, html, replyTo) {
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
      reply_to: replyTo || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[submit] Resend error:', res.status, body);
  }
}

// ── Customer confirmation (custom-design deposit flow only) ──────────────────

function localeFrom(str) {
  const m = (str || '').match(/^https?:\/\/(es|fr|it)\./);
  return m ? m[1] : 'en';
}

async function sendCustomerEmail(to, subject, html, replyTo) {
  if (!RESEND_KEY || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     `MOMUTO Design Studio <${FROM_EMAIL}>`,
      to:       [to],
      reply_to: replyTo || TEAM_EMAIL,
      subject,
      html,
    }),
  });
  if (!res.ok) console.error('[submit] customer Resend error:', res.status, await res.text());
}

// ── KV helpers ───────────────────────────────────────────────────────────────

async function saveLead(lead) {
  await kv.set(`lead:${lead.id}`, lead);
  await kv.sadd('leads:all', lead.id);
}

async function listLeads() {
  const ids = (await kv.smembers('leads:all')) || [];
  if (!ids.length) return [];
  const leads = await Promise.all(ids.map(id => kv.get(`lead:${id}`)));
  return leads
    .filter(Boolean)
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {

  // ── GET: list leads (admin only) ──────────────────
  if (req.method === 'GET') {
    if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    const leads = await listLeads();
    return res.status(200).json(leads);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req)) {
    console.warn('[submit] blocked: origin=%s referer=%s', req.headers['origin'], req.headers['referer']);
    return res.status(403).json({ error: 'Forbidden' });
  }

  let thankYouUrl = THANK_YOU_FALLBACK;

  try {
    const { fields, files } = await parseForm(req);
    if (fields._next) thankYouUrl = fields._next;

    // Honeypot: real users never fill this field
    if (fields._honey) {
      console.warn('[submit] honeypot triggered — dropping silently');
      return res.redirect(302, thankYouUrl);
    }

    // Badge is required — no file means it's a bot posting directly to the API
    const hasBadge = files.some(f => (f.fieldName === 'upload_file' || f.fieldName === 'teamCrest') && f.size > 0);
    if (!hasBadge) {
      console.warn('[submit] blocked: no badge uploaded (bot direct-post) email=%s', fields.email);
      return res.redirect(302, thankYouUrl);
    }

    // ── Persist lead to KV before attempting email ────
    const badge   = files.find(f => f.fieldName === 'upload_file'   || f.fieldName === 'teamCrest');
    const concept = files.find(f => f.fieldName === 'design_concept' || f.fieldName === 'sponsorLogo');
    const lead = {
      id:         `lead_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      name:       fields.firstname  || fields.contactName  || null,
      email:      fields.email      || fields.contactEmail || null,
      team:       fields.company    || fields.teamName     || null,
      league:     fields.industry   || null,
      qty:        fields.orderSize  || fields.estimatedQty || null,
      primary:    fields.primaryColorValue   || null,
      secondary:  fields.secondaryColorValue || null,
      style:      fields.stylePreference     || null,
      design:     fields.Design || fields.design || null,
      badgeUrl:   badge?.url   || null,
      conceptUrl: concept?.url || null,
      source:     fields._source_url || null,
      emailSent:  false,
      emailError: null,
    };
    await saveLead(lead);

    // ── Send team email, record outcome ───────────────
    const { subject, html, replyTo } = buildEmail(fields, files);
    try {
      await sendEmail(fields, subject, html, replyTo);
      await kv.set(`lead:${lead.id}`, { ...lead, emailSent: true });
    } catch (emailErr) {
      console.error('[submit] email failed for lead', lead.id, emailErr.message);
      await kv.set(`lead:${lead.id}`, { ...lead, emailError: emailErr.message });
    }

    // ── Customer confirmation — custom-design deposit brief only ──
    // (RTP / free-request submits don't get the "your €15 is in" relief email.)
    if (fields._flow === 'custom-deposit' && lead.email) {
      const lang = localeFrom(fields._source_url || req.headers['referer'] || '');
      try {
        const { subject: cSubj, html: cHtml } =
          emailConceptReceived({ name: lead.name, team: lead.team, lang });
        await sendCustomerEmail(lead.email, cSubj, cHtml, TEAM_EMAIL);
      } catch (custErr) {
        console.error('[submit] customer email failed for lead', lead.id, custErr.message);
      }
    }

  } catch (err) {
    console.error('[submit] fatal:', err.message);
  }

  res.redirect(302, thankYouUrl);
};
