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
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Extract order details from this invoice or order text and return ONLY a JSON object with these fields (use null if not found):
{
  "name":      string — customer full name,
  "email":     string — customer email,
  "team":      string — team or club name,
  "qty":       string — quantity (e.g. "11-20" or "15"),
  "ref":       string — invoice or order reference number,
  "orderDate": string — date in YYYY-MM-DD format
}

Invoice text:
${text}`,
    }],
  });

  try {
    const raw = message.content[0].text.trim();
    const json = JSON.parse(raw.replace(/^```json\n?|\n?```$/g, ''));
    return res.status(200).json(json);
  } catch {
    return res.status(422).json({ error: 'Could not parse response', raw: message.content[0].text });
  }
};
