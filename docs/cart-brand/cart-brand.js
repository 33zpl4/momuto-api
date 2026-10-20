/* MOMUTO — cart skin helpers (companion of cart-brand.css; both ship together in cart-brand-entry.html, see docs/store-cart-ui.md).
 *  1. /cart only: adds the Bebas Neue + Outfit font link (the CSS has no @import, so no other page requests a font).
 *  2. Everywhere the "Added to cart" pop-up can appear: ONE observer on <body>'s direct children (no subtree), which only looks at a node when it is the pop-up.
 *     It fixes two theme labels that are wrong in the language pack: FR "Caisse" and IT "Cassa" (= the shop till) -> "Passer la commande" / "Procedi al pagamento".
 *     The same fix is applied to the checkout buttons on /cart. Text only (textContent), idempotent.
 * NOT done here: the "Size:" label is the product option's own name in the product data (English on every store), not a theme string. */
(function () {
  if (window.__moCart_) return;
  window.__moCart_ = true;
  var HOST = location.hostname, FIX = /^fr\./.test(HOST) ? { Caisse: 'Passer la commande' } : /^it\./.test(HOST) ? { Cassa: 'Procedi al pagamento' } : null;
  function fix(root) {
    if (!FIX) return;
    root.querySelectorAll('.cart-buyNow span, button.checkout, button.minicart_checkout').forEach(function (e) {
      var t = (e.textContent || '').trim(); if (FIX[t]) e.textContent = FIX[t];
    });
  }
  if (/^\/cart\/?$/.test(location.pathname)) {
    if (!document.getElementById('mo-cart-fonts')) {
      var l = document.createElement('link'); l.id = 'mo-cart-fonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap';
      (document.head || document.documentElement).appendChild(l);
    }
    var go = function () { fix(document); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
  if (FIX && document.body !== undefined) {
    var watch = function () {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && n.classList.contains('mo-popup-body')) fix(n); }); });
      }).observe(document.body, { childList: true });
    };
    if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
  }
})();
