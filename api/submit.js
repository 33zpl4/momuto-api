'use strict';

/**
 * POST /api/submit — MOMUTO kit design request handler
 *
 * Receives multipart/form-data from the kit request form, then:
 *   1. Parses fields + file metadata (badge, design concept)
 *   2. Calls Claude to classify the lead and draft a first reply
 *   3. Upserts a HubSpot contact
 *   4. Sends the team a structured notification email via Resend
 *   5. Redirects the user to the thank-you page
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY   — already in repo
 *   RESEND_API_KEY      — get from resend.com (free tier: 3 000 emails/mo)
 *   HUBSPOT_TOKEN       — Private App token with contacts write scope
 *   TEAM_EMAIL          — where team notifications go (e.g. info@momuto.com)
 *   THANK_YOU_URL       — redirect after submit (default: momuto.com thank-you)
 *
 * File uploads: filenames + sizes are captured and included in the team email.
 * Actual file bytes are discarded (not stored) in this version — add
 * @vercel/blob in a second pass to persist them and include download links.
 */

const Busboy = require('busboy');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESEND_KEY   = process.env.RESEND_API_KEY;
const HS_TOKEN     = process.env.HUBSPOT_TOKEN;
const TEAM_EMAIL   = process.env.TEAM_EMAIL   || 'info@momuto.com';
const THANK_YOU    = process.env.THANK_YOU_URL || 'https://www.momuto.com/pages/customized-design-confirmed';

// ── 1. Multipart parser ──────────────────────────────────────────────────────

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const fields = {};
    const files  = [];

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, stream, info) => {
      let size = 0;
      stream.on('data', chunk => { size += chunk.length; });
      stream.on('close', () => {
        files.push({ fieldName: name, filename: info.filename, mimeType: info.mimeType, size });
      });
    });

    bb.on('close',  () => resolve({ fields, files }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

// ── 2. Claude: classify lead + draft reply ───────────────────────────────────

async function classifyLead(fields, files) {
  const badge   = files.find(f => f.fieldName === 'upload_file');
  const concept = files.find(f => f.fieldName === 'design_concept');

  const prompt = `You are processing a custom football kit design request for MOMUTO, a premium kit supplier.

SUBMISSION DATA:
- Name: ${fields.firstname || '—'}
- Email: ${fields.email || '—'}
- Team: ${fields.company || '—'}
- League / Tournament: ${fields.industry || '—'}
- Quantity: ${fields.orderSize || '—'}
- Primary color: ${fields.primaryColorValue || '—'}
- Secondary color: ${fields.secondaryColorValue || '—'}
- Style preference (1=classic → 10=bold): ${fields.stylePreference || '5'}
- Badge uploaded: ${badge ? `Yes — ${badge.filename} (${Math.round(badge.size / 1024)}KB)` : 'No'}
- Design concept uploaded: ${concept ? `Yes — ${concept.filename} (${Math.round(concept.size / 1024)}KB)` : 'No (design from scratch)'}

CLASSIFY and reply with EXACTLY these 5 lines, nothing else:
LEAD_TYPE: <team_order|single_order|ai_design|rtp_inquiry>
PRIORITY: <high|normal>
LANGUAGE: <en|es|fr|it>
NOTES: <2–3 short observations for the team, comma-separated, max 120 chars>
DRAFT_REPLY: <Friendly, natural first reply in the detected language. 3–5 sentences. Address the person by first name. Do NOT mention prices. Focus on confirming receipt, what happens next (mockup in 24–48h), and asking one clarifying question if the brief is sparse.>

Rules:
- PRIORITY = high if quantity is 11+ OR a design concept was uploaded
- LEAD_TYPE = ai_design if design concept uploaded, else team_order if 5+ kits, else single_order
- LANGUAGE: detect from team name / league clues; default en`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = {};
  for (const line of response.content[0].text.trim().split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    result[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return result;
}

// ── 3. HubSpot upsert ────────────────────────────────────────────────────────

async function upsertHubSpot(fields, classification) {
  if (!HS_TOKEN || !fields.email) return;

  const properties = {
    firstname:  fields.firstname  || '',
    email:      fields.email,
    company:    fields.company    || '',
    // Map to HubSpot standard + custom properties
    // Custom props must exist in your HubSpot account first:
    //   kit_quantity, lead_type, lead_priority
    kit_quantity:  fields.orderSize        || '',
    lead_type:     classification.LEAD_TYPE || '',
    lead_priority: classification.PRIORITY  || '',
  };

  await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  }).catch(() => {}); // Non-fatal — don't block the response
}

// ── 4. Team email via Resend ─────────────────────────────────────────────────

async function sendTeamEmail(fields, files, classification) {
  if (!RESEND_KEY) return;

  const badge   = files.find(f => f.fieldName === 'upload_file');
  const concept = files.find(f => f.fieldName === 'design_concept');
  const priority = classification.PRIORITY === 'high' ? '🔴 HIGH' : '🟡 NORMAL';

  const row = (label, value) =>
    `<tr><td style="padding:8px 12px;border:1px solid #e4e4e7;font-weight:600;white-space:nowrap;background:#f9f9f9">${label}</td><td style="padding:8px 12px;border:1px solid #e4e4e7">${value}</td></tr>`;

  const colorSwatch = hex =>
    `<span style="display:inline-block;width:16px;height:16px;background:${hex};border:1px solid #ccc;vertical-align:middle;margin-right:6px;border-radius:2px"></span>${hex}`;

  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:640px;margin:0 auto">
  <div style="background:#0a0a0a;padding:20px 28px;display:flex;align-items:center">
    <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1.6rem;color:#fff;letter-spacing:0.05em">MOMUTO</span>
    <span style="margin-left:auto;background:${classification.PRIORITY === 'high' ? '#c8352e' : '#52525b'};color:#fff;font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px">${priority}</span>
  </div>

  <div style="padding:24px 28px;border:1px solid #e4e4e7;border-top:none">
    <h2 style="margin:0 0 4px;font-size:1.25rem;color:#0a0a0a">
      New Kit Request — ${fields.company || 'Unknown Team'}
    </h2>
    <p style="margin:0 0 20px;font-size:0.85rem;color:#71717a">${fields.orderSize || '?'} kits · ${classification.LEAD_TYPE} · ${classification.LANGUAGE?.toUpperCase()}</p>

    <table style="width:100%;border-collapse:collapse;font-size:0.88rem;margin-bottom:24px">
      ${row('Name',    fields.firstname || '—')}
      ${row('Email',   `<a href="mailto:${fields.email}" style="color:#c8352e">${fields.email}</a>`)}
      ${row('Team',    fields.company   || '—')}
      ${row('League',  fields.industry  || '—')}
      ${row('Quantity', fields.orderSize || '—')}
      ${row('Colors',  `${colorSwatch(fields.primaryColorValue || '#000')} + ${colorSwatch(fields.secondaryColorValue || '#fff')}`)}
      ${row('Style',   `${fields.stylePreference || '5'} / 10`)}
      ${row('Badge',   badge   ? `✓ ${badge.filename} (${Math.round(badge.size / 1024)}KB)` : '✗ Not uploaded')}
      ${row('Design concept', concept ? `✓ ${concept.filename} (${Math.round(concept.size / 1024)}KB)` : '✗ None — design from scratch')}
    </table>

    <div style="background:#f5f5f3;border-left:4px solid #0a0a0a;padding:6px 14px;font-size:0.8rem;color:#52525b;margin-bottom:24px">
      <strong>Team notes:</strong> ${classification.NOTES || '—'}
    </div>

    <h3 style="font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0a0a0a;margin:0 0 10px">
      💬 Suggested first reply (${classification.LANGUAGE?.toUpperCase()})
    </h3>
    <div style="background:#fff;border:1px solid #e4e4e7;border-left:4px solid #c8352e;padding:16px;font-size:0.9rem;line-height:1.6;color:#3a3a3a;white-space:pre-wrap">${classification.DRAFT_REPLY || '—'}</div>

    <p style="font-size:0.75rem;color:#a1a1aa;margin-top:24px;padding-top:16px;border-top:1px solid #e4e4e7">
      Auto-generated by MOMUTO lead pipeline · Reply-to: ${fields.email}
    </p>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:     'MOMUTO Leads <leads@momuto.com>',
      to:       [TEAM_EMAIL],
      reply_to: fields.email,
      subject:  `${priority} — ${fields.company || 'New request'} (${fields.orderSize || '?'} kits) — ${classification.LEAD_TYPE}`,
      html,
    }),
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);

    // Run Claude + HubSpot in parallel; email waits for classification
    const [classification] = await Promise.all([
      classifyLead(fields, files),
      upsertHubSpot(fields, {}),
    ]);

    await sendTeamEmail(fields, files, classification);
  } catch (err) {
    console.error('[submit] error:', err.message);
    // Still redirect — never show a raw error to the user
  }

  res.redirect(302, THANK_YOU);
};
