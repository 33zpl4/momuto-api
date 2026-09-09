/* ============================================================================
   MOMUTO — canonical kit pricing. SINGLE SOURCE OF TRUTH.

   Mirror of the manage.momuto.com base product prices + the CMS quantity-discount
   campaigns (published as the "MOMUTO KIT PRICING 2026" transparency table).
   RTP prices = base − 10%, rounded to €0.10 (matches the published RTP tiers).

   These surfaces read this file:
     - embed.js          (RTP 2D widget)        -> unitPrice(kind, qty, {rtp:true})
     - custom-content.js (3D custom PDP estimator) -> unitPrice(kind, qty)   // base, no RTP off
     - design-momuto templates/<lang>/cartItem.html (cart roster: unit prices,
       sleeve resulting prices, subtotal) -> unitPrice / tiers / LS_SURCHARGE

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
    shorts:[[1,17.90],[2,15.90],[5,11.90],[10, 6.00],[20, 6.00],[50, 5.50],[100, 5.00]],
    socks: [[1, 6.00]]           // flat — matches the store product; no published ladder
  };
  // us.momuto.com — the USD ladder (owner ruling 3 Sep 2026, .90 endings; see
  // momuto-api docs/us-launch-status.md). NOT an FX conversion of the EUR
  // ladder: every number is the owner's. Kit = jersey + shorts at each tier.
  // Select it with opts.store:'us' (default store is the EUR estate).
  var PRICING_US={
    jersey:[[1,45.90],[2,41.90],[5,30.90],[10,25.90],[20,21.90],[50,20.90],[100,19.90]],
    kit:   [[1,66.80],[2,60.80],[5,44.80],[10,30.90],[20,26.90],[50,25.90],[100,24.90]],
    shorts:[[1,20.90],[2,18.90],[5,13.90],[10, 5.00],[20, 5.00],[50, 5.00],[100, 5.00]],
    socks: [[1, 6.90]]
  };
  // US Ready to Play is anchored on the live US product prices ($40.90 jersey,
  // $59.90 kit — owner-ruled from €35 / €59 via the EUR→USD map), then −10% of
  // the US base rounded to $0.10 at the other tiers. Explicit because the
  // −10% rule alone would give $41.30 at qty 1 and contradict the product.
  var RTP_US={
    jersey:[[1,40.90],[2,37.70],[5,27.80],[10,23.30],[20,19.70],[50,18.80],[100,17.90]],
    kit:   [[1,59.90],[2,54.70],[5,40.30],[10,27.80],[20,24.20],[50,23.30],[100,22.40]]
  };
  var CURRENCY={ eur:{code:"EUR",symbol:"\u20ac"}, us:{code:"USD",symbol:"$"} };
  var RTP_OFF=0.10;              // RTP is 10% under the standard/custom tier
  var POPULAR_MIN=10;            // the "most popular" tier (10–19) — for UI nudges
  var LS_SURCHARGE=3.00;         // long sleeves: flat +3.00 per jersey at EVERY tier
                                 // (billed via the per-store "Long sleeves" product;
                                 // surfaces show resulting prices, never a fee line)

  function normQty(qty){ return Math.max(1, parseInt(qty,10)||1); }
  // store key: 'us' -> USD ladder; anything else -> the EUR ladder.
  function storeKey(opts){ return (opts&&String(opts.store||"").toLowerCase()==="us")?"us":"eur"; }
  function table(kind,opts){ var P=(storeKey(opts)==="us")?PRICING_US:PRICING; return P[kind]||P.jersey; }
  function pick(t,qty){ var p=t[0][1], q=normQty(qty); for(var i=0;i<t.length;i++){ if(q>=t[i][0]) p=t[i][1]; } return p; }
  // Standard (custom/3D) per-unit price at this quantity.
  function tierBase(kind,qty,opts){ return pick(table(kind,opts),qty); }
  // RTP per-unit price: base − 10%, rounded to the published €0.10
  // (US: the explicit RTP_US ladder, see above; kinds without one fall back
  // to the −10% rule on the US base).
  function rtpPrice(kind,qty,opts){
    if(storeKey(opts)==="us" && RTP_US[kind]) return pick(RTP_US[kind],qty);
    return Math.round(tierBase(kind,qty,opts)*(1-RTP_OFF)*10)/10;
  }
  function currency(opts){ return CURRENCY[storeKey(opts)]; }
  // "€38.90" / "$45.90" — one formatter so no surface hard-codes a symbol.
  function fmt(v,opts){ return currency(opts).symbol+Number(v).toFixed(2); }

  var api={
    PRICING:PRICING, PRICING_US:PRICING_US, RTP_US:RTP_US, CURRENCY:CURRENCY,
    RTP_OFF:RTP_OFF, POPULAR_MIN:POPULAR_MIN, LS_SURCHARGE:LS_SURCHARGE,
    tierBase:tierBase, rtpPrice:rtpPrice, currency:currency, fmt:fmt,
    // Effective per-unit price. opts.rtp=true -> RTP pricing; otherwise standard/custom.
    // opts.store:'us' -> the USD ladder (LS_SURCHARGE is 3.00 in both currencies).
    unitPrice:function(kind,qty,opts){ return (opts&&opts.rtp)?rtpPrice(kind,qty,opts):tierBase(kind,qty,opts); },
    // Total for a quantity.
    total:function(kind,qty,opts){ return Math.round(api.unitPrice(kind,qty,opts)*normQty(qty)*100)/100; },
    // The quantity breakpoints for this kind (e.g. for "next tier at N" hints).
    tiers:function(kind,opts){ return table(kind,opts).map(function(r){return r[0];}); }
  };

  if(typeof module!=="undefined"&&module.exports){ module.exports=api; }
  root.MOMUTO_PRICING=api;
})(typeof window!=="undefined"?window:this);
