/* MOMUTO — store order page: put the TRACKING NUMBER on top (companion of account-brand.css; same paste location, see README.md).
 *
 * On /account/orders/<id> the platform prints "Tracking / USPS : <number> / http://www.usps.com/" far down the page, below the addresses,
 * and the only link is the carrier's HOMEPAGE. This script (only on #account_orderDetail, only when that block exists):
 *   - builds a panel right under the status + order number: carrier, the number big, [Track package] [Copy number];
 *   - [Track package] opens the carrier's own tracking page WITH the number for USPS / UPS / DHL / FedEx (formats below); any other
 *     carrier gets the platform's link (the carrier site) and the copy button;
 *   - hides the platform's original block once the panel exists. If this script never runs, account-brand.css still restyles that
 *     block dark and moves it to the top of the table.
 * Text comes from textContent only (no innerHTML). Idempotent. Buttons are translated by store host (es. / fr. / it.; everything else EN).
 * Tested: Chromium desktop + 390 px on the live US store with a fake USPS number. NOT tested: Safari/iOS, ES/FR/IT stores, a carrier
 * other than USPS, the real carrier pages opening with a real number. */
(function () {
  if (window.__moTrack_) return;
  window.__moTrack_ = true;
  var T = {
    en: { track: 'Track package', copy: 'Copy number', copied: 'Copied ✓', site: 'Carrier site' },
    es: { track: 'Seguir el paquete', copy: 'Copiar número', copied: 'Copiado ✓', site: 'Web del transportista' },
    fr: { track: 'Suivre le colis', copy: 'Copier le numéro', copied: 'Copié ✓', site: 'Site du transporteur' },
    it: { track: 'Traccia il pacco', copy: 'Copia il numero', copied: 'Copiato ✓', site: 'Sito del corriere' }
  };
  var L = T[location.hostname.split('.')[0]] || T.en;
  var LINKS = {   // carrier -> tracking URL with the number filled in
    usps: function (n) { return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + n; },
    ups: function (n) { return 'https://www.ups.com/track?tracknum=' + n; },
    dhl: function (n) { return 'https://www.dhl.com/en/express/tracking.html?AWB=' + n + '&brand=DHL'; },
    fedex: function (n) { return 'https://www.fedex.com/fedextrack/?trknbr=' + n; }
  };
  function carrierKey(name) {
    var s = String(name || '').toLowerCase();
    if (/usps|united states postal/.test(s)) return 'usps';
    if (/(^|[^a-z])ups([^a-z]|$)|united parcel/.test(s)) return 'ups';
    if (/dhl/.test(s)) return 'dhl';
    if (/fedex|federal express/.test(s)) return 'fedex';
    return null;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = L.copied; setTimeout(function () { btn.textContent = t; }, 1600); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () {}); return; } } catch (e) {}
    try { var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {}
  }
  function build() {
    var root = document.getElementById('account_orderDetail');
    if (!root) return false;
    if (root.querySelector('.mo-track')) return true;
    var items = root.querySelectorAll('.tracking-warp .tracking-item'), head = root.querySelector('.order-header');
    if (!items.length || !head) return false;
    var panel = el('div', 'mo-track');
    var hd = root.querySelector('.tracking-warp .tracking-header');
    panel.appendChild(el('div', 'mo-track-label', (hd && hd.textContent.trim()) || 'Tracking'));
    [].forEach.call(items, function (it) {
      var t = it.querySelector('.tracking-item-title'), des = it.querySelector('.tracking-item-des');
      var title = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!title) return;
      var i = title.indexOf(':'), carrier = i > 0 ? title.slice(0, i).trim() : '', num = (i > 0 ? title.slice(i + 1) : title).trim();
      var site = '';
      var a = des && des.querySelector('a'); if (a && /^https?:\/\//i.test(a.getAttribute('href') || '')) site = a.getAttribute('href');
      else if (des && /^https?:\/\/\S+$/i.test(des.textContent.trim())) site = des.textContent.trim();
      var row = el('div', 'mo-track-row');
      if (carrier) row.appendChild(el('div', 'mo-track-carrier', carrier));
      row.appendChild(el('div', 'mo-track-num', num));
      var actions = el('div', 'mo-track-actions');
      var key = carrierKey(carrier), href = key && /^[A-Za-z0-9._-]{4,40}$/.test(num) ? LINKS[key](encodeURIComponent(num)) : site;
      if (href) {
        var go = el('a', 'mo-track-btn', key ? L.track : L.site);
        go.href = href; go.target = '_blank'; go.rel = 'noopener noreferrer'; actions.appendChild(go);
      }
      var cp = el('button', 'mo-track-btn mo-track-2', L.copy); cp.type = 'button';
      cp.addEventListener('click', function () { copy(num, cp); }); actions.appendChild(cp);
      row.appendChild(actions); panel.appendChild(row);
    });
    if (panel.querySelectorAll('.mo-track-row').length === 0) return false;
    head.parentNode.insertBefore(panel, head.nextSibling);
    root.classList.add('mo-track-done');
    return true;
  }
  function start() {
    if (build()) return;
    var obs = new MutationObserver(function () { if (build()) obs.disconnect(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
