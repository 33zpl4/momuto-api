'use strict';
/**
 * The design server's roster keeps PRODUCTION wording in the size column for manage.momuto.com, including Chinese
 * ("M · POLO COLLAR POLO领", owner 13 Nov 2026). Its webhook strips that before sending (WebhookAction::customerSize);
 * this is the same rule on our side, applied wherever a size is shown to a customer or stored for a customer email,
 * so a roster that arrives by another route (manual ingest, a read of Order/getGoods) can never print Chinese.
 */
const CJK = /[⺀-鿿豈-﫿＀-￯]+/g;
function customerSize(size) {
  return String(size == null ? '' : size)
    .replace(/POLO COLLAR\s*POLO领/g, 'POLO')
    .replace(CJK, '')
    .split(' · ').map(s => s.trim()).filter(Boolean).join(' · ');
}
function customerRoster(players) {
  return Array.isArray(players) ? players.map(p => (p && typeof p === 'object' && p.size != null ? { ...p, size: customerSize(p.size) } : p)) : players;
}
module.exports = { customerSize, customerRoster, CJK };
