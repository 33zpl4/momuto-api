'use strict';

/**
 * POST /api/parse-invoice
 * Body: { text }
 * Returns: { name, email, team, qty, ref, orderDate }
 */

const Anthropic = require('@anthropic-ai/sdk');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorised(req) {
  return req.headers['x-admin-token'] === ADMIN_TOKEN;
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = await readJSON(req);
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Extract order details from this invoice or order text. Return ONLY a raw JSON object, no markdown, no explanation.

Fields (use null if not found):
- name: customer full name
- email: customer email address
- team: team or club name
- qty: quantity as a string (e.g. "15" or "11-20")
- ref: invoice or order reference number
- orderDate: date in YYYY-MM-DD format

Invoice text:
${text}`,
      },
      {
        role: 'assistant',
        content: '{',
      },
    ],
  });

  try {
    // Prepend the '{' we used as prefill, then extract the JSON object
    const raw = '{' + message.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    const json = JSON.parse(match[0]);
    return res.status(200).json(json);
  } catch (err) {
    console.error('[parse-invoice] parse error:', err.message, message.content[0].text);
    return res.status(422).json({ error: 'Could not parse response' });
  }
};
