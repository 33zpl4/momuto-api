'use strict';
/**
 * Carrier names + tracking deep-links for the "order shipped" email. Pure functions.
 * Same link formats as the store account skin (docs/account-brand/account-brand.js LINKS).
 * Platform courier ids seen so far: 4629 = USPS (code 21051). Anything else falls back to the
 * carrier name/URL the platform stored on the fulfillment (`tracking_company`, `note`).
 */
const BY_COURIER_ID = { 4629: 'usps' };
const CARRIERS = {
  usps:  { name: 'USPS',  url: n => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
  ups:   { name: 'UPS',   url: n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  dhl:   { name: 'DHL',   url: n => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}&brand=DHL` },
  fedex: { name: 'FedEx', url: n => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
};

function keyFor(fulfillment) {
  const f = fulfillment || {};
  if (BY_COURIER_ID[f.courier_id]) return BY_COURIER_ID[f.courier_id];
  const text = `${f.tracking_company || ''} ${f.note || ''}`.toLowerCase();
  return Object.keys(CARRIERS).find(k => text.includes(k)) || null;
}

/** { carrier, trackingUrl } from a platform fulfillment entry. trackingUrl is https or null (never a guess). */
function describeFulfillment(fulfillment) {
  const f = fulfillment || {};
  const num = String(f.tracking_number || '').trim();
  const k = keyFor(f);
  const platformUrl = /^https:\/\//i.test(f.note || '') ? String(f.note).trim() : null;
  return {
    carrier: k ? CARRIERS[k].name : (String(f.tracking_company || '').trim() || null),
    trackingUrl: k && num ? CARRIERS[k].url(num) : platformUrl,
  };
}

module.exports = { describeFulfillment };
