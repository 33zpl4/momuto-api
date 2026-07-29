/* MOMUTO Ready-to-Play loader — the ONE stable script a product-page block references.
   Why this exists: blocks used to hardcode <script src="embed.js?v=15">, so every engine
   change meant bumping ?v= in every block and re-pasting them into the CMS. This loader
   removes that trap: the block points here once, and this code — which runs fresh on every
   page load even when the file itself is cached — derives the asset bundle from the widget's
   data-template and loads everything with a runtime cache-bust. Deploy embed.js / assets /
   rtp-content once and changes propagate on their own (embed+content within the hour, assets
   within the day). No ?v= bump, no re-paste.

   Block usage (per product page):
     <div id="momuto-rtp" data-template="the-prism" data-mode="composite"
          data-product="…" data-oem="…" data-lang="fr"
          data-product-kit="…" data-oem-kit="…"
          data-primary="…" data-secondary="…" data-trim="…"></div>
     <div id="rtp-content" data-lang="fr"></div>
     <script src="https://www.momuto.com/rtp-loader.js" defer></script>
*/
(function () {
  var BASE = "https://www.momuto.com/";
  var hour = Math.floor(Date.now() / 3600000);   // cache key rolls over hourly
  var day  = Math.floor(Date.now() / 86400000);   // …and daily for the big bundles

  function load(src, next) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = s.onerror = next || null;          // continue even if one fails
    document.head.appendChild(s);
  }

  // 1) Configurator: assets bundle (derived from data-template) THEN embed.js (must run after).
  var host = document.getElementById("momuto-rtp") || document.querySelector("[data-momuto-rtp]");
  if (host) {
    var slug = (host.dataset.template || "the-fracture").replace(/^the-/, "");
    load(BASE + "assets-" + slug + ".js?d=" + day, function () {
      load(BASE + "embed.js?h=" + hour);
    });
  }

  // 2) Shared content blocks (Highlights / Trust / How-it-works / FAQ), if the page has the slot.
  if (document.getElementById("rtp-content") || document.querySelector("[data-rtp-content]")) {
    load(BASE + "rtp-content.js?h=" + hour);
  }

  // 3) Custom-product page content (dark theme + trust + FAQ).
  //    Busts per-MINUTE while we're actively iterating on the template, so edits
  //    show within ~a minute (switch back to "?h="+hour once the template is final).
  if (document.getElementById("momuto-custom") || document.querySelector("[data-momuto-custom]")) {
    load(BASE + "custom-content.js?m=" + Math.floor(Date.now() / 60000));
  }
})();