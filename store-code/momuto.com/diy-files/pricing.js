/* ============================================================================
   MOMUTO — canonical kit pricing. SINGLE SOURCE OF TRUTH.

   Mirror of the manage.momuto.com base product prices + the CMS quantity-discount
   campaigns (published as the "MOMUTO KIT PRICING 2026" transparency table).
   RTP prices = base − 10%, rounded to €0.10 (matches the published RTP tiers).

   Both storefront surfaces read this file:
     - embed.js          (RTP 2D widget)        -> unitPrice(kind, qty, {rtp:true})
     - custom-content.js (3D custom PDP estimator) -> unitPrice(kind, qty)   // base, no RTP off

   When prices change: edit HERE, then redeploy via Deploy Static Files. Do NOT
   copy these numbers into another file — that is the drift this file exists to end.

   Loads as a browser global (window.MOMUTO_PRICING) and as a CommonJS module.
   Reference it the same way custom-content.js is referenced (EN-hosted, shared
   across all stores):  <script src="https://www.momuto.com/pricing.js?v=1"></script>
   ============================================================================ */
(function(root){
  "use strict";
  // [minQty, effectivePerUnitPrice] — the tier the qty falls into wins (last match).
  var PRICING={
    jersey:[[1,38.90],[2,34.90],[5,26.90],[10,21.90],[20,18.90],[50,17.90],[100,16.90]],
    kit:   [[1,56.80],[2,50.80],[5,38.80],[10,26.90],[20,24.90],[50,23.40],[100,21.90]],
    shorts:[[1,17.90],[2,15.90],[5,11.90],[10, 6.00],[20, 6.00],[50, 5.50],[100, 5.00]]
  };
  var RTP_OFF=0.10;              // RTP is 10% under the standard/custom tier
  var POPULAR_MIN=10;            // the "most popular" tier (10–19) — for UI nudges

  function normQty(qty){ return Math.max(1, parseInt(qty,10)||1); }
  // Standard (custom/3D) per-unit price at this quantity.
  function tierBase(kind,qty){
    var t=PRICING[kind]||PRICING.jersey, p=t[0][1], q=normQty(qty);
    for(var i=0;i<t.length;i++){ if(q>=t[i][0]) p=t[i][1]; }
    return p;
  }
  // RTP per-unit price: base − 10%, rounded to the published €0.10.
  function rtpPrice(kind,qty){ return Math.round(tierBase(kind,qty)*(1-RTP_OFF)*10)/10; }

  var api={
    PRICING:PRICING, RTP_OFF:RTP_OFF, POPULAR_MIN:POPULAR_MIN,
    tierBase:tierBase, rtpPrice:rtpPrice,
    // Effective per-unit price. opts.rtp=true -> RTP pricing; otherwise standard/custom.
    unitPrice:function(kind,qty,opts){ return (opts&&opts.rtp)?rtpPrice(kind,qty):tierBase(kind,qty); },
    // Total for a quantity.
    total:function(kind,qty,opts){ return Math.round(api.unitPrice(kind,qty,opts)*normQty(qty)*100)/100; },
    // The quantity breakpoints for this kind (e.g. for "next tier at N" hints).
    tiers:function(kind){ return (PRICING[kind]||PRICING.jersey).map(function(r){return r[0];}); }
  };

  if(typeof module!=="undefined"&&module.exports){ module.exports=api; }
  root.MOMUTO_PRICING=api;
})(typeof window!=="undefined"?window:this);