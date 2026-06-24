/* ============================================================================
   MOMUTO — Ready-to-Play shared product-page content.
   Injects, in order: Highlights -> Trust (clubs + reviews) -> How it works -> FAQ,
   plus a FAQPage JSON-LD block for SEO. One file = every RTP product page.

   Usage on each product page (paste once, below the configurator):
     <div id="rtp-content" data-lang="en"></div>
     <script src="https://www.momuto.com/rtp-content.js?v=1" defer></script>

   Edit content HERE and it updates on every page (bump ?v= to bust cache).
   data-lang picks the locale ("en" default). To add es/fr/it: copy the `en`
   object, translate the strings (FR/ES review originals are in comments below).
   Missing locales fall back to en.
   ============================================================================ */
(function(){
"use strict";

/* ---- club logos (shared across all locales) ---- */
var LOGOS=[
 ["Nottingham Prisas","https://cdn.staticsoe.com/pics/431ef8bf79e7e510718cee987cdd8a2538fcdddab1de91fcd7f115cb3bb95fa1.png"],
 ["Deportivo JCPE","https://cdn.staticsoe.com/pics/456424f740bef93d3a16ed3e9e4690a66d6f656ccf2acdc59f007c9371d92a10.png"],
 ["Peaule Fest","https://cdn.staticsoe.com/pics/8a887cbd7caaf5ec6b16516ed14a34fa00eb9ac5b57681ad3479fc1bbf9f5dd8.png"],
 ["Dreamteam","https://cdn.staticsoe.com/pics/e1e1549cd706338477e78d4f34d23d44b45430d0b5ee12087083969583536de6.png"],
 ["AEK","https://cdn.staticsoe.com/pics/6f7d20be5d2add7d3fd0973e818e207001b24749156f7024e5c6f8efc3de3ec4.png"],
 ["L'Impasse","https://cdn.staticsoe.com/pics/e5c3a4c131b9694dbb73c1ffbd5b67b38476702e9a8b0a50bb0ae5a506eecadb.png"],
 ["Soviet Rockets","https://cdn.staticsoe.com/pics/96ab5d6c74ce29ff1bf7d872cfccd762347646df5ff630f2248a8fcb6d45562b.png"],
 ["All Stars FC Girls","https://cdn.staticsoe.com/pics/845d6990df27779910a9f21a03e7b283a82ec95015f2e2ea6f7faf540261de39.png"],
 ["Gobinet","https://cdn.staticsoe.com/pics/84cd7d8e3574013e977e66fde4b0bed12a0f6c5db67ea4572cfce23f16ebf4f8.png"],
 ["Free FC","https://cdn.staticsoe.com/pics/65af24adc790f322babfb0b10061e5edb360654b7829c379153f4cd80c4aa723.png"],
 ["Los Bloques","https://cdn.staticsoe.com/pics/6f32f9df3660fc4175d6ce0e6825473be37beb8f6b9b106c61a3e83ef3d8ee47.png"],
 ["Ziakerie FC","https://cdn.staticsoe.com/pics/745a9a97d0dd25b1e0e5f0b24881a6ec6cc2a2825df48a9bbbf81fccf281a4ed.png"],
 ["Inter Egara","https://cdn.staticsoe.com/pics/c9a0a9bd7ee7b5524005891c3c2cbdcff99239d36601be037b4db49e415d9ed9.png"],
 ["Lario FC","https://cdn.staticsoe.com/pics/a28c2f6f8f427f9c57ae99535b01619aa27802ea9fa7f95e5fc43a80c2eb52aa.png"]
];

/* ---- content per locale (es/fr/it fall back to en) ----
   FR/ES review originals (for those domains):
     Ivan (ES): "10/10 camisetas exactamente como las queríamos y entrega en el plazo que nos dijeron, todo perfecto!"
     Nohan (FR): "Très satisfait de nos maillots personnalisés, super qualité et livraison rapide. Le service client et le contact avec les créateurs est fluide et particulièrement agréable. Merci Momuto je recommande."
*/
var I18N={
 en:{
  highlights:[
   ["Fabric","<b>Polyester-elastane</b> with stretch. Sublimation-printed — colours dyed in, so they never crack or peel.",false],
   ["What you get","<b>Jersey</b>, or <b>full kit</b> (jersey + shorts). Names &amp; numbers per player.",false],
   ["Made &amp; shipped","<b>~25–30 days</b> after you greenlight your mockup. Free shipping over €49.",false],
   ["You're protected","Pay today, but we <b>don't print</b> until you approve a final mockup — sent <b>within 24h</b>. Change anything, free.",true]
  ],
  trust:{
   lab:"Worn on real pitches", h2:"Trusted by 150+ teams", sub:"Across Europe and North America.",
   reviews:[
    ["Great experience for our team's custom jerseys. The design was exactly as we requested and the whole process was smooth — their team was super responsive and always happy to help. Very happy with the result, highly recommend!","Karim","France"],
    ["10/10 — fast, cheap and good quality!","Olaya","Spain"],
    ["10/10 — the shirts came out exactly as we wanted, delivered right on the date they promised. All perfect!","Ivan Fedi","Spain"],
    ["Really happy with our custom jerseys — great quality and fast delivery. Customer service and the contact with the designers is smooth and genuinely pleasant. Thanks Momuto, highly recommend.","Nohan Dessaint","France"]
   ]
  },
  how:{
   lab:"Simple process", h2:"How it works",
   promise:["Buy now, we perfect it before we print.","You pay today — then we send a final mockup within 24h. We don't make a single kit until you greenlight it."],
   steps:[
    ["Design it","Pick your colours, upload your crest &amp; sponsor, add names and numbers — all in the live preview above."],
    ["Order your squad","Add to cart, enter each player's size, name and number, and check out. One kit or the whole team."],
    ["Greenlight your mockup","Within 24h we send a final mockup of your exact kit. Tweak anything, free. Nothing prints until you approve."],
    ["We make &amp; ship","Once you greenlight, we produce and deliver in ~25–30 days. Free shipping over €49."]
   ]
  },
  faq:{
   lab:"Good to know", h2:"Frequently asked questions", sub:"Everything you need before you order.",
   items:[
    ["Do I pay now, or after I see a mockup?","You pay when you order. Within <b>24 hours</b> we send a final mockup of your exact kit — and we <b>don't print a single piece until you greenlight it</b>. Want a change? Free. Your purchase is protected: you never get a kit you didn't approve."],
    ["What fabric are the kits made from?","A lightweight, breathable <b>polyester-elastane blend</b> with stretch for full freedom of movement. Every design is <b>sublimation-printed</b> — the colours and logos are dyed into the fabric, so they won't crack, peel or fade like a printed transfer."],
    ["How do I choose the right size?","We carry a <b>full youth-to-adult size range</b>. Use the <b>size guide</b> (the \"Find your size\" link when you add your team) to match each player by chest and height. Between sizes, or mixing kids and adults? Just ask before you greenlight your mockup."],
    ["Jersey only or full kit — what's included?","Your choice. <b>Jersey only</b> is the shirt. <b>Full kit</b> adds matching <b>shorts</b> at a bundle price. Pick on the product above — the price updates instantly by quantity."],
    ["Is there a minimum order? How does pricing work?","<b>No minimum</b> — order a single kit or hundreds. The price per unit drops as your order grows (every tier is shown in the estimate above), and the <b>Ready-to-Play range is 10% cheaper</b> because the design is already done. Design is <b>always free</b>, with no hidden fees."],
    ["How long until it arrives?","We send your final mockup <b>within 24h</b> of ordering. Once you greenlight it, production and delivery take roughly <b>25–30 days</b>. Need it for a specific date? Tell us before you order and we'll confirm."],
    ["Will it come out exactly like the preview?","Yes — and you'll see it first. After you order, our team <b>vectorises and cleans your crest &amp; sponsor</b>, refines placement, and sends a <b>final mockup within 24h</b>. Nothing goes to print until you greenlight it."],
    ["Can I add player names and numbers?","Absolutely. Add a name and number per player in your team list at checkout, in your choice of font and colour — mix and match across the whole squad."],
    ["What if something isn't right on the mockup?","Change it — free. You can tweak anything right up until you greenlight your mockup, and we only start production once you've approved. No wrong prints, ever."]
   ]
  }
 }
 /* ,es:{...}, fr:{...}, it:{...}  // copy `en`, translate; missing locales fall back to en */
};

var CSS=`
.rtpc{}
.mkh{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:28px auto 0;padding:0 16px;}
.mkh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.mkh-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;}
.mkh-card.hl{border-color:rgba(226,33,75,.45);background:rgba(226,33,75,.06);}
.mkh-card .t{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E2214B;margin-bottom:6px;}
.mkh-card .d{font-size:13px;color:#cfcfd4;line-height:1.5;}
.mkh-card .d b{color:#fff;font-weight:600;}
.mtr{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:48px auto 0;padding:0 16px;color:#f5f5f5;text-align:center;}
.mtr .lab{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#E2214B;}
.mtr h2{font-family:'Bebas Neue',Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.02em;text-transform:uppercase;color:#fff;margin:6px 0 4px;}
.mtr .sub{font-size:15px;color:#a1a1aa;line-height:1.6;margin:0 0 26px;}
.mtr-strip{position:relative;overflow:hidden;margin:0 0 44px;padding:6px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);}
.mtr-track{display:flex;width:max-content;align-items:center;animation:mtr-scroll 46s linear infinite;}
.mtr-strip:hover .mtr-track{animation-play-state:paused;}
.mtr-logo{flex:0 0 auto;width:120px;display:flex;align-items:center;justify-content:center;padding:0 24px;}
.mtr-logo img{width:auto;height:auto;max-width:104px;max-height:84px;object-fit:contain;opacity:.72;transition:opacity .2s;}
.mtr-logo img:hover{opacity:1;}
@keyframes mtr-scroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@media(prefers-reduced-motion:reduce){.mtr-track{animation:none;flex-wrap:wrap;justify-content:center;width:auto;}}
.mtr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;text-align:left;}
.mtr-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;display:flex;flex-direction:column;}
.mtr-stars{color:#E2214B;font-size:13px;letter-spacing:3px;margin-bottom:10px;}
.mtr-card .q{font-size:13.5px;color:#e5e5e5;line-height:1.65;flex:1;}
.mtr-card .by{margin-top:16px;font-size:12.5px;color:#a1a1aa;}
.mtr-card .by b{color:#fff;font-weight:600;}
.mkt{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:48px auto 0;padding:0 16px;color:#f5f5f5;}
.mkt h2{font-family:'Bebas Neue',Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.02em;text-transform:uppercase;color:#fff;margin:0 0 6px;}
.mkt .lab{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#E2214B;}
.mkt .sub{font-size:15px;color:#a1a1aa;line-height:1.6;margin:0 0 26px;}
.mkt-promise{display:flex;align-items:center;gap:14px;border-left:3px solid #E2214B;background:linear-gradient(90deg,rgba(226,33,75,.08),rgba(226,33,75,0));padding:16px 20px;margin:0 0 34px;border-radius:4px;}
.mkt-promise b{color:#fff;font-size:16px;}
.mkt-promise span{color:#cfcfd4;font-size:14px;line-height:1.55;}
.mkt-steps{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 56px;}
.mkt-step{flex:1 1 220px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px;}
.mkt-step .n{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#E2214B;color:#fff;font-weight:800;font-size:15px;margin-bottom:12px;}
.mkt-step b{display:block;color:#fff;font-size:15px;margin-bottom:5px;}
.mkt-step span{font-size:13px;color:#a1a1aa;line-height:1.55;}
.mkt-faq details{border-top:1px solid rgba(255,255,255,.1);}
.mkt-faq details:last-child{border-bottom:1px solid rgba(255,255,255,.1);}
.mkt-faq summary{list-style:none;cursor:pointer;padding:18px 4px;font-size:16px;font-weight:600;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;}
.mkt-faq summary::-webkit-details-marker{display:none;}
.mkt-faq summary::after{content:'+';font-size:24px;color:#E2214B;font-weight:300;line-height:1;flex-shrink:0;}
.mkt-faq details[open] summary::after{content:'\\2013';}
.mkt-faq p{margin:0 4px 18px;font-size:14px;color:#a1a1aa;line-height:1.7;}
.mkt-faq p b{color:#e5e5e5;font-weight:600;}
@media(max-width:860px){.mtr-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.mkt h2{font-size:28px;}.mkt-step{flex:1 1 100%;}.mkt-promise{flex-direction:column;align-items:flex-start;gap:6px;}}
@media(max-width:480px){.mtr-grid{grid-template-columns:1fr;}}
@media(max-width:760px){.mkh-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:420px){.mkh-grid{grid-template-columns:1fr;}}
`;

function stripTags(s){return String(s).replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&mdash;/g,"—");}

function highlights(c){
  var cards=c.highlights.map(function(x){
    return '<div class="mkh-card'+(x[2]?" hl":"")+'"><div class="t">'+x[0]+'</div><div class="d">'+x[1]+'</div></div>';
  }).join("");
  return '<div class="mkh"><div class="mkh-grid">'+cards+'</div></div>';
}
function trust(c){
  var t=c.trust;
  var a=LOGOS.map(function(l){return '<div class="mtr-logo"><img loading="lazy" alt="'+l[0]+'" src="'+l[1]+'"></div>';}).join("");
  var b=LOGOS.map(function(l){return '<div class="mtr-logo" aria-hidden="true"><img loading="lazy" alt="" src="'+l[1]+'"></div>';}).join("");
  var rev=t.reviews.map(function(r){
    return '<div class="mtr-card"><div class="mtr-stars">★★★★★</div><div class="q">“'+r[0]+'”</div><div class="by"><b>'+r[1]+'</b> — '+r[2]+'</div></div>';
  }).join("");
  return '<div class="mtr"><div class="lab">'+t.lab+'</div><h2>'+t.h2+'</h2><p class="sub">'+t.sub+'</p>'
    +'<div class="mtr-strip"><div class="mtr-track">'+a+b+'</div></div>'
    +'<div class="mtr-grid">'+rev+'</div></div>';
}
function howfaq(c){
  var h=c.how,f=c.faq;
  var steps=h.steps.map(function(s,i){
    return '<div class="mkt-step"><span class="n">'+(i+1)+'</span><b>'+s[0]+'</b><span>'+s[1]+'</span></div>';
  }).join("");
  var qs=f.items.map(function(q){
    return '<details><summary>'+q[0]+'</summary><p>'+q[1]+'</p></details>';
  }).join("");
  return '<div class="mkt"><div class="lab">'+h.lab+'</div><h2>'+h.h2+'</h2>'
    +'<div class="mkt-promise"><b>'+h.promise[0]+'</b><span>'+h.promise[1]+'</span></div>'
    +'<div class="mkt-steps">'+steps+'</div>'
    +'<div class="lab">'+f.lab+'</div><h2>'+f.h2+'</h2><p class="sub">'+f.sub+'</p>'
    +'<div class="mkt-faq">'+qs+'</div></div>';
}
function faqLd(items){
  return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":items.map(function(q){
    return {"@type":"Question","name":stripTags(q[0]),"acceptedAnswer":{"@type":"Answer","text":stripTags(q[1])}};
  })};
}

function render(mount){
  var lang=(mount.getAttribute("data-lang")||"en").toLowerCase();
  var c=I18N[lang]||I18N.en;
  mount.innerHTML="<style>"+CSS+"</style>"+highlights(c)+trust(c)+howfaq(c);
  try{
    var ld=document.createElement("script");
    ld.type="application/ld+json";
    ld.textContent=JSON.stringify(faqLd(c.faq.items));
    document.head.appendChild(ld);
  }catch(e){}
}

function boot(){
  var m=document.getElementById("rtp-content")||document.querySelector("[data-rtp-content]");
  if(m && !m.__rtpc){ m.__rtpc=1; render(m); }
}
if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded",boot);
})();
