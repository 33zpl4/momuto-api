/* MOMUTO Ready-to-Play 2D kit configurator — embeddable widget.
   Usage on a page (e.g. the momuto.com product page):
     <div id="momuto-rtp" data-template="the-fracture" data-product="16534" data-oem="10294534" data-lang="en"></div>
     <script src="https://<host>/configurator/embed.js" defer></script>
   Mounts into a Shadow DOM (style-isolated). "Add to cart" reuses the page's #goto3d / window.jump3d. */
(function(){
"use strict";
var SELF = document.currentScript || (function(){var s=document.getElementsByTagName("script");return s[s.length-1];})();
var DEFAULT_ASSETS = new URL("assets/", SELF.src).href;   // default: assets/ next to embed.js
// override per-mount with data-assets="https://your-cms-cdn/path/" if files live elsewhere
var ASSET_DATA = (typeof window!=="undefined" && window.__RTP_ASSETS) || null;  // bundled (inlined) assets, if present

// ---- shared constants / pure helpers (root-independent) ----
var W=1500, H=1500;
var BASES=[[96,168,144],[72,168,240],[192,96,168],[96,144,48],[216,168,72]];
var DESIGN_ZONES={0:"front",1:"sleeve",3:"sleeve",4:"sleeve"};
var TRIM_ZONES=new Set([2,6]), WHITE_ZONES=new Set([5]), WHITE=[245,245,245];
var SRC4=[[255,125,189],[255,152,202],[252,208,243],[254,234,252]];
var TONE_T=[0.0,0.34,0.66,1.0], OFFTOL=8500;
var PRESETS={ "Classic":{primary:"#13294b",secondary:"#f4f5f6",trim:"#b9123a"},
 "Blood":{primary:"#b11226",secondary:"#1a1a1a",trim:"#f4f5f6"},
 "Emerald":{primary:"#0b6e4f",secondary:"#f4d03f",trim:"#111111"},
 "Mono":{primary:"#222831",secondary:"#cfd3da",trim:"#e23b5a"} };
var PALETTE=[
 ['#FFFFFF','White'],['#D9DCE1','Silver'],['#9AA0A6','Grey'],['#5A6068','Slate'],['#2E3238','Charcoal'],['#121212','Black'],
 ['#E63027','Red'],['#C8102E','Team Red'],['#A11731','Crimson'],['#6E1F2E','Maroon'],['#FF6F61','Coral'],['#F25C9A','Pink'],
 ['#F2622A','Orange'],['#FB8C00','Amber'],['#F4A800','Gold'],['#FFCC00','Yellow'],['#CDE000','Volt'],['#7AC143','Lime'],
 ['#2FA84F','Green'],['#009A4E','Kelly Green'],['#0B7A4B','Emerald'],['#14543A','Pine'],['#009CA6','Teal'],['#34B5C0','Aqua'],
 ['#7FD0F0','Sky'],['#3FA9F5','Light Blue'],['#1E63E9','Royal'],['#0B4FC4','Blue'],['#1B3A6B','Cobalt'],['#16223F','Navy'],
 ['#6A2DA8','Purple'],['#8E44AD','Violet'],['#B5179E','Magenta'],['#5E2750','Plum'],['#6B4226','Brown'],['#F3EAD3','Cream'] ];
var FONTS=[["vanguard","Vanguard","fonts/font-1.svg"],["contour","Contour","fonts/font-2.svg"],["industry","Industry","fonts/font-3.svg"]];
// Ready-to-Play pricing: base table (€/unit) by min order size; RTP applies a 10% discount
var PRICING={ jersey:[[1,38.90],[2,34.90],[5,26.90],[10,21.90],[20,18.90],[50,17.90],[100,16.90]],
              kit:   [[1,56.80],[2,50.80],[5,38.80],[10,26.90],[20,24.90],[50,23.40],[100,21.90]] };
var RTP_OFF=0.10;
function tierBase(kind,qty){ var t=PRICING[kind]||PRICING.jersey, p=t[0][1];
  for(var i=0;i<t.length;i++){ if(qty>=t[i][0]) p=t[i][1]; } return p; }  // standard (pre-RTP) price for this quantity tier
function unitPrice(kind,qty){ return Math.round(tierBase(kind,qty)*(1-RTP_OFF)*10)/10; }  // round to .10 to match published RTP prices
var lum3=function(r,g,b){return 0.299*r+0.587*g+0.114*b;};
var hx=function(h){h=h.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
var load=function(src){return new Promise(function(r){var i=new Image();i.crossOrigin="anonymous";i.onload=function(){r(i);};i.src=src;});};
function offscreen(w,h){var c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function centerDY(srcA,n){ /* ALIGN_V3: no-op. Front/back alignment now comes from the source PNGs themselves
  (garment placed identically in both 1500x1500 files), so no runtime vertical shift. */
  return 0; }
function genUserId(){var hh=function(n){var s="";while(s.length<n)s+=Math.floor(Math.random()*16).toString(16);return s;};
  return hh(2)+Math.floor(Date.now()/1000).toString(16)+hh(8);}

function knockoutBg(img){
  var w=img.width,h=img.height,c=offscreen(w,h),x=c.getContext("2d",{willReadFrequently:true});
  x.drawImage(img,0,0);
  var id=x.getImageData(0,0,w,h),d=id.data;
  var corner=function(px,py){var i=(py*w+px)*4;return [d[i],d[i+1],d[i+2]];};
  var cs=[corner(0,0),corner(w-1,0),corner(0,h-1),corner(w-1,h-1)];
  var avg=[0,1,2].map(function(k){return Math.round(cs.reduce(function(s,v){return s+v[k];},0)/4);});
  var uniform=cs.every(function(v){return Math.abs(v[0]-avg[0])+Math.abs(v[1]-avg[1])+Math.abs(v[2]-avg[2])<48;});
  if(!uniform) return img;
  var seen=new Uint8Array(w*h),st=[];
  var push=function(px,py){ if(px<0||py<0||px>=w||py>=h)return; var k=py*w+px; if(!seen[k]){seen[k]=1;st.push(k);} };
  for(var px=0;px<w;px++){push(px,0);push(px,h-1);} for(var py=0;py<h;py++){push(0,py);push(w-1,py);}
  var tol=100;
  while(st.length){ var k=st.pop(),i=k*4;
    if(Math.abs(d[i]-avg[0])+Math.abs(d[i+1]-avg[1])+Math.abs(d[i+2]-avg[2])>=tol) continue;
    d[i+3]=0; var qx=k%w,qy=(k/w)|0; push(qx+1,qy);push(qx-1,qy);push(qx,qy+1);push(qx,qy-1);
  }
  x.putImageData(id,0,0); return c;
}
function placeDesign(img,bbox,o){
  o=o||{}; var mirror=o.mirror||false, anchorTop=o.anchorTop||false, anchorBottom=o.anchorBottom||false, pad=o.pad||1.02, contain=o.contain||false;
  var c=offscreen(W,H), x=c.getContext("2d");
  var s=(contain?Math.min:Math.max)(bbox.w/img.width, bbox.h/img.height)*pad;
  var dw=img.width*s, dh=img.height*s;
  var cx=bbox.x+bbox.w/2;
  var cy=anchorTop? bbox.y+dh/2 : anchorBottom? bbox.y+bbox.h-dh/2 : bbox.y+bbox.h/2;
  x.save(); x.translate(cx,cy); if(mirror) x.scale(-1,1);
  x.drawImage(img,-dw/2,-dh/2,dw,dh); x.restore();
  return x.getImageData(0,0,W,H);
}

var CSS = ":host{display:block;--brand:#E2214B;--bg:#0e0f13;--panel:#1a1c22;--line:rgba(255,255,255,.12);--txt:#f2f3f5;--mut:#9aa0aa;"
+"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--txt);font-size:14px;line-height:1.4;text-align:left;}"
+"*{box-sizing:border-box;}"
+".wrap{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;}"
+".stage{flex:1 1 420px;min-width:300px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%,#23262e,#0e0f13 70%);border-radius:16px;padding:6px 12px;position:relative;}"
+"canvas#cv{max-width:100%;max-height:78vh;width:auto;height:auto;}"
+".panel{flex:0 0 340px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px;}"
+".panel h2{margin:18px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);}"
+".panel h2:first-child{margin-top:0;}"
+".zone{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);}"
+".zone label{font-size:14px;}"
+".uploads label.up{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);font-size:14px;cursor:pointer;}"
+".uploads .pill{font-size:12px;color:var(--brand);}"
+".presets{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px;}"
+".presets button{flex:1;min-width:78px;padding:9px;border:1px solid var(--line);background:#22252c;color:var(--txt);border-radius:8px;cursor:pointer;font-size:12px;}"
+".presets button:hover{border-color:var(--brand);}"
+".row{display:flex;gap:8px;margin-top:16px;}"
+".row button{flex:1;padding:11px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;}"
+".reset{background:#22252c;color:var(--txt);border:1px solid var(--line)!important;}"
+".cta{background:var(--brand);color:#fff;}"
+".svc{margin:11px 0 2px;font-size:11px;color:var(--mut);line-height:1.55;}"
+".svc b{color:var(--txt);font-weight:600;}"
+"#busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:14px;}"
+".sw{width:34px;height:34px;border:2px solid rgba(255,255,255,.25);border-radius:50%;cursor:pointer;padding:0;}"
+".sw-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:2147483000;}"
+".sw-modal.open{display:flex;}"
+".sw-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;width:300px;}"
+".sw-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);}"
+".sw-head button{background:none;border:none;color:var(--mut);font-size:16px;cursor:pointer;}"
+".sw-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;}"
+".sw-grid div{aspect-ratio:1;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.14);transition:transform .08s;}"
+".sw-grid div:hover{transform:scale(1.1);}"
+".sw-grid div.sel{outline:2px solid #fff;outline-offset:1px;}"
+".vtog{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:2px;z-index:5;background:rgba(26,28,34,.9);border:1px solid var(--line);border-radius:999px;padding:3px;}"
+".vtog button{border:none;background:none;color:var(--mut);padding:7px 22px;cursor:pointer;font-size:13px;font-weight:600;border-radius:999px;}"
+".vtog button.on{background:var(--brand);color:#fff;}"
+".fonts{display:flex;gap:8px;margin:10px 0 2px;}"
+".fontchip{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px;border:1px solid var(--line);background:#22252c;border-radius:8px;cursor:pointer;}"
+".fontchip img{height:18px;max-width:100%;object-fit:contain;}"
+".fontchip span{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);}"
+".fontchip.on{border-color:var(--brand);}.fontchip.on span{color:#fff;}"
+".kit{display:flex;gap:8px;margin:10px 0 4px;}"
+".kit button{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:11px 8px;border:1px solid var(--line);background:#22252c;color:var(--txt);border-radius:8px;cursor:pointer;text-align:center;}"
+".kit button.on{border-color:var(--brand);background:rgba(226,33,75,.06);}"
+".kit .kt{font-size:13px;font-weight:600;}"
+".kit .kp{font-size:12px;color:var(--txt);}"
+".kit .kp s{color:var(--mut);margin-right:4px;font-weight:400;}"
+".kit .ks{font-size:10px;color:var(--mut);letter-spacing:.02em;}"
+".qtyrow{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);}"
+".qtyrow label{font-size:14px;}"
+".qstep{display:flex;align-items:center;}"
+".qstep button{width:30px;height:30px;border:1px solid var(--line);background:#22252c;color:var(--txt);cursor:pointer;font-size:16px;line-height:1;}"
+".qstep input{width:54px;height:30px;text-align:center;border:1px solid var(--line);border-left:0;border-right:0;background:#15171c;color:var(--txt);font-size:14px;-moz-appearance:textfield;}"
+".qstep input::-webkit-outer-spin-button,.qstep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}"
+".priceblk{margin:12px 0 2px;padding:12px 0 0;border-top:1px solid var(--line);}"
+".pr-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;}"
+".pr-main{display:flex;align-items:baseline;gap:7px;}"
+".pr-cur{font-size:26px;font-weight:800;color:var(--txt);line-height:1;}"
+".pr-orig{font-size:13px;color:var(--mut);text-decoration:line-through;}"
+".pr-per{font-size:12px;color:var(--mut);}"
+".pr-badge{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--brand);background:rgba(226,33,75,.12);padding:4px 9px;border-radius:5px;}"
+".pr-detail{font-size:11px;color:var(--mut);margin-top:6px;}"
+".pr-detail b{color:var(--txt);font-weight:700;}"
+".perks{margin:11px 0 2px;padding:11px 13px;border-radius:8px;background:rgba(226,33,75,.06);border:1px solid rgba(226,33,75,.22);}"
+".perk{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--mut);padding:3px 0;}"
+".perk .pi{color:var(--brand);width:15px;text-align:center;flex-shrink:0;}"
+".perk b{color:var(--txt);font-weight:600;}";


// ---- UI i18n (configurator interface strings; data-lang picks the locale) ----
var I18N={
 en:{busy:"Loading…",vFront:"Front",vBack:"Back",hColours:"Colours",lPrimary:"Primary",lSecondary:"Secondary",
  lTrim:"Trim (collar &amp; cuffs)",hBadges:"Your badges",lCrest:"Team crest",lSponsor:"Sponsor",upload:"Upload ▸",
  svc:"JPG or PNG both work — plain backgrounds are auto-trimmed here in the preview. Every crest &amp; sponsor is then <b>vectorised &amp; cleaned by our design team</b>, placement refined, and you receive a <b>free proof to approve before printing</b>.",
  hPerso:"Personalisation · Back",lName:"Name &amp; number",hEstimate:"Order estimate",ktJersey:"Jersey only",ktKit:"Full kit",
  ksKit:"jersey + shorts",lQuantity:"Quantity",perkFlag:"<b>Free team flag</b> with crest · orders of 10+ pieces",
  perkArmband:"<b>Free captain armband</b> · orders of 10+ pieces",reset:"Reset",cta:"Add to cart ▸",swTitle:"Pick a colour",
  perJersey:"jersey",perKit:"full kit",badge:"READY-TO-PLAY · −10%",units:"units",estimated:"estimated",finalPrice:"final price at checkout"},
 fr:{busy:"Chargement…",vFront:"Avant",vBack:"Dos",hColours:"Couleurs",lPrimary:"Primaire",lSecondary:"Secondaire",
  lTrim:"Bordures (col &amp; poignets)",hBadges:"Vos badges",lCrest:"Blason de l'équipe",lSponsor:"Sponsor",upload:"Importer ▸",
  svc:"JPG ou PNG, les deux fonctionnent — les fonds unis sont détourés automatiquement dans l'aperçu. Chaque blason &amp; sponsor est ensuite <b>vectorisé &amp; nettoyé par notre équipe de design</b>, le placement affiné, et vous recevez un <b>bon à tirer gratuit à valider avant impression</b>.",
  hPerso:"Personnalisation · Dos",lName:"Nom &amp; numéro",hEstimate:"Estimation de commande",ktJersey:"Maillot seul",ktKit:"Kit complet",
  ksKit:"maillot + short",lQuantity:"Quantité",perkFlag:"<b>Drapeau d'équipe offert</b> avec blason · commandes de 10+ pièces",
  perkArmband:"<b>Brassard de capitaine offert</b> · commandes de 10+ pièces",reset:"Réinitialiser",cta:"Ajouter au panier ▸",swTitle:"Choisir une couleur",
  perJersey:"maillot",perKit:"kit complet",badge:"PRÊT À JOUER · −10%",units:"unités",estimated:"estimé",finalPrice:"prix final au paiement"},
 es:{busy:"Cargando…",vFront:"Frente",vBack:"Espalda",hColours:"Colores",lPrimary:"Primario",lSecondary:"Secundario",
  lTrim:"Ribete (cuello &amp; puños)",hBadges:"Tus escudos",lCrest:"Escudo del equipo",lSponsor:"Patrocinador",upload:"Subir ▸",
  svc:"JPG o PNG, ambos funcionan — los fondos lisos se recortan automáticamente en la vista previa. Cada escudo &amp; patrocinador se <b>vectoriza y limpia con nuestro equipo de diseño</b>, se refina la ubicación y recibes una <b>prueba gratuita para aprobar antes de imprimir</b>.",
  hPerso:"Personalización · Espalda",lName:"Nombre &amp; número",hEstimate:"Estimación del pedido",ktJersey:"Solo camiseta",ktKit:"Kit completo",
  ksKit:"camiseta + pantalón",lQuantity:"Cantidad",perkFlag:"<b>Bandera del equipo gratis</b> con escudo · pedidos de 10+ piezas",
  perkArmband:"<b>Brazalete de capitán gratis</b> · pedidos de 10+ piezas",reset:"Restablecer",cta:"Añadir al carrito ▸",swTitle:"Elegir un color",
  perJersey:"camiseta",perKit:"kit completo",badge:"LISTO PARA JUGAR · −10%",units:"unidades",estimated:"estimado",finalPrice:"precio final al pagar"},
 it:{busy:"Caricamento…",vFront:"Fronte",vBack:"Retro",hColours:"Colori",lPrimary:"Primario",lSecondary:"Secondario",
  lTrim:"Bordo (colletto &amp; polsini)",hBadges:"I tuoi stemmi",lCrest:"Stemma della squadra",lSponsor:"Sponsor",upload:"Carica ▸",
  svc:"JPG o PNG, entrambi vanno bene — gli sfondi uniti vengono ritagliati automaticamente nell'anteprima. Ogni stemma &amp; sponsor viene poi <b>vettorializzato &amp; ripulito dal nostro team di design</b>, il posizionamento perfezionato, e ricevi una <b>bozza gratuita da approvare prima della stampa</b>.",
  hPerso:"Personalizzazione · Retro",lName:"Nome &amp; numero",hEstimate:"Stima dell'ordine",ktJersey:"Solo maglia",ktKit:"Kit completo",
  ksKit:"maglia + pantaloncini",lQuantity:"Quantità",perkFlag:"<b>Bandiera della squadra in omaggio</b> con stemma · ordini di 10+ pezzi",
  perkArmband:"<b>Fascia da capitano in omaggio</b> · ordini di 10+ pezzi",reset:"Reimposta",cta:"Aggiungi al carrello ▸",swTitle:"Scegli un colore",
  perJersey:"maglia",perKit:"kit completo",badge:"PRONTI A GIOCARE · −10%",units:"unità",estimated:"stimato",finalPrice:"prezzo finale al checkout"}
};
function buildHTML(t){ return '' +
 '<div class="wrap">'
+'  <div class="stage"><canvas id="cv" width="1500" height="1500"></canvas><div id="busy">'+t.busy+'</div>'
+'    <div class="vtog" id="vtog"><button data-v="front" class="on">'+t.vFront+'</button><button data-v="back">'+t.vBack+'</button></div>'
+'  </div>'
+'  <div class="panel">'
+'    <h2>'+t.hColours+'</h2>'
+'    <div class="zone"><label>'+t.lPrimary+'</label><button class="sw" id="primarySw" data-k="primary"></button></div>'
+'    <div class="zone"><label>'+t.lSecondary+'</label><button class="sw" id="secondarySw" data-k="secondary"></button></div>'
+'    <div class="zone"><label>'+t.lTrim+'</label><button class="sw" id="trimSw" data-k="trim"></button></div>'
+'    <h2>'+t.hBadges+'</h2>'
+'    <div class="uploads">'
+'      <label class="up">'+t.lCrest+' <span class="pill" id="crestName">'+t.upload+'</span><input type="file" id="crest" accept="image/*" hidden></label>'
+'      <label class="up">'+t.lSponsor+' <span class="pill" id="sponsorName">'+t.upload+'</span><input type="file" id="sponsor" accept="image/*" hidden></label>'
+'    </div>'
+'    <p class="svc">'+t.svc+'</p>'
+'    <div id="perso" style="display:none">'
+'      <h2>'+t.hPerso+'</h2>'
+'      <div class="fonts" id="fonts"></div>'
+'      <div class="zone"><label>'+t.lName+'</label><button class="sw" id="nameColorSw" data-k="nameColor"></button></div>'
+'    </div>'
+'    <div class="presets" id="presets"></div>'
+'    <h2>'+t.hEstimate+'</h2>'
+'    <div class="kit" id="kit">'
+'      <button data-kit="jersey" class="on"><span class="kt">'+t.ktJersey+'</span><span class="kp" id="kpJersey"></span></button>'
+'      <button data-kit="kit"><span class="kt">'+t.ktKit+'</span><span class="kp" id="kpKit"></span><span class="ks">'+t.ksKit+'</span></button>'
+'    </div>'
+'    <div class="qtyrow"><label>'+t.lQuantity+'</label><div class="qstep"><button id="qminus" type="button">−</button><input id="qty" type="number" min="1" value="10"><button id="qplus" type="button">+</button></div></div>'
+'    <div class="priceblk" id="est"></div>'
+'    <div class="perks" id="promo" style="display:none">'
+'      <div class="perk"><span class="pi">&#9873;</span><span>'+t.perkFlag+'</span></div>'
+'      <div class="perk"><span class="pi">&#9733;</span><span>'+t.perkArmband+'</span></div>'
+'    </div>'
+'    <div class="row"><button class="reset" id="reset">'+t.reset+'</button><button class="cta" id="order">'+t.cta+'</button></div>'
+'  </div>'
+'</div>'
+'<div class="sw-modal" id="swModal"><div class="sw-card">'
+'  <div class="sw-head"><span id="swTitle">'+t.swTitle+'</span><button id="swClose">✕</button></div>'
+'  <div class="sw-grid" id="swGrid"></div>'
+'</div></div>'; }

// ---- per-instance engine ----
function run(root, opts){
  var T=opts.t||I18N.en;
  var A=opts.assets;
  var assetSrc=function(name){ return (ASSET_DATA && ASSET_DATA[name]) ? ASSET_DATA[name] : (A+name); };
  var cv=root.getElementById("cv"), ctx=cv.getContext("2d",{willReadFrequently:true});
  var views={}, active="front", fontImg={};
  // per-template signature colours via data-primary/secondary/trim/namecolor; falls back to marble
  var DEFAULTS={ primary:opts.primary||"#2e3238", secondary:opts.secondary||"#ffffff",
    trim:opts.trim||"#121212", nameColor:opts.nameColor||opts.trim||"#121212" };
  var state={ primary:DEFAULTS.primary, secondary:DEFAULTS.secondary, trim:DEFAULTS.trim, crest:null, sponsor:null, font:"vanguard", nameColor:DEFAULTS.nameColor, kit:"jersey", qty:10 };
  var CART={ base:"https://design.momuto.com", productId:opts.productId, oemId:opts.oemId,
    productIdKit:opts.productIdKit, oemIdKit:opts.oemIdKit, lang:opts.lang };

  async function init(){
    if(opts.mode==="composite") return initComposite();
    var slot = (ASSET_DATA && ASSET_DATA.slots) ? Promise.resolve(ASSET_DATA.slots) : fetch(A+"template-slots.json").then(function(x){return x.json();});
    var r=await Promise.all([
      load(assetSrc("blank-shirt-front.png")), load(assetSrc("front-design.png")), load(assetSrc("sleeve-design.png")),
      load(assetSrc("logo-momuto.png")), load(assetSrc("blank-shirt-back.png")), load(assetSrc("back-design.png")),
      slot ]);
    views.front=buildFront(r[0],r[1],r[2],r[3],r[6]);
    views.back =buildBack(r[4],r[5],r[2]);
    var fl=await Promise.all(FONTS.map(function(f){return load(assetSrc(f[2]));}));
    FONTS.forEach(function(f,i){fontImg[f[0]]=fl[i];});
    root.getElementById("busy").style.display="none";
    buildUI(); render();
  }

  // ---- COMPOSITE MODE ----------------------------------------------------
  // For panel-based designs supplied as a finished on-body PNG (garment + design
  // already in place, with real shading). We segment the composite into colour
  // regions (primary body / secondary panels / trim) and recolour each region by
  // its own luminance shading — so registration is exact (it IS the artwork) and
  // there is no blank+overlay cover-fit to misalign.
  async function initComposite(){
    var slot = (ASSET_DATA && ASSET_DATA.slots) ? Promise.resolve(ASSET_DATA.slots) : fetch(A+"template-slots.json").then(function(x){return x.json();});
    var r=await Promise.all([
      load(assetSrc("composite-front.png")), load(assetSrc("composite-back.png")),
      load(assetSrc("logo-momuto.png")), slot ]);
    views.front=buildComposite(r[0],"front",r[3],r[2]);
    views.back =buildComposite(r[1],"back",r[3],null);
    var fl=await Promise.all(FONTS.map(function(f){return load(assetSrc(f[2]));}));
    FONTS.forEach(function(f,i){fontImg[f[0]]=fl[i];});
    root.getElementById("busy").style.display="none";
    buildUI(); render();
  }

  // hsv helper for the palette matcher (h in [0,360), s,v in [0,1])
  function rgb2hsv(r,g,b){
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
    if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360; }
    return [h, mx?d/mx:0, mx/255];
  }
  function hueDist(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }

  function buildComposite(img,kind,slotJson,logo){
    var c=offscreen(W,H), x=c.getContext("2d"); x.drawImage(img,0,0,W,H);
    var d=x.getImageData(0,0,W,H).data, n=W*H;
    var region=new Uint8Array(n), ratio=new Float32Array(n), srcA=new Uint8ClampedArray(n), lumArr=new Float32Array(n);
    var minx=1e9,maxx=0,miny=1e9,maxy=0,i;
    // Palette (bundled per template) gives the design's NATIVE source colours so the
    // segmenter is generic. If absent, fall back to the original lime rule (Apex).
    var palette=(ASSET_DATA && ASSET_DATA.palette) || opts.palette || null;
    var SRC=null, trimNearSecondary=false;
    if(palette){
      SRC=["primary","secondary","trim"].map(function(role){ var c2=hx(palette[role]); var h=rgb2hsv(c2[0],c2[1],c2[2]); return [h[0],h[1],h[2]]; });
      var ts=hx(palette.trim), ss=hx(palette.secondary);
      trimNearSecondary=(Math.abs(ts[0]-ss[0])+Math.abs(ts[1]-ss[1])+Math.abs(ts[2]-ss[2])<60);
    }
    // shading-robust nearest-source classify -> region 0/1/2
    var classify=function(r,g,b){
      var hsv=rgb2hsv(r,g,b),hue=hsv[0],sat=hsv[1],val=hsv[2];
      var best=0,bs=1e9;
      for(var ri=0;ri<3;ri++){ var S=SRC[ri],hs=S[0],ss2=S[1],vs=S[2],sc;
        if(vs<0.24) sc=val+sat;                     // dark source (e.g. black)
        else if(ss2>0.25) sc=(sat<0.15?2.0:hueDist(hue,hs)/180);  // chromatic source
        else sc=sat+Math.abs(val-vs);               // neutral source
        if(sc<bs){bs=sc;best=ri;}
      }
      return best;
    };
    var brightN=new Uint8Array(n);   // bright near-white pixels (candidate inner-collar facing)
    // pass 1: classify. region 0=primary 1=secondary 2=trim 3=white-facing 255=empty
    for(i=0;i<n;i++){
      var r=d[i*4],g=d[i*4+1],b=d[i*4+2],a=d[i*4+3]; srcA[i]=a;
      if(a<20){region[i]=255;continue;}
      var X=i%W,Y=(i/W)|0; if(X<minx)minx=X;if(X>maxx)maxx=X;if(Y<miny)miny=Y;if(Y>maxy)maxy=Y;
      var lum=0.299*r+0.587*g+0.114*b; lumArr[i]=lum;
      var mx=Math.max(r,g,b),satv=mx?(mx-Math.min(r,g,b))/mx:0;
      if(satv<0.20 && mx>140) brightN[i]=1;
      if(palette){ region[i]=classify(r,g,b); }
      else {
        var lime=(g>110)&&(r>60)&&(b<110)&&(g>=b+40)&&(g>=r-12);
        region[i]= lime?1 : 0;
      }
    }
    var gw=maxx-minx+1, gh=maxy-miny+1, cx=(minx+maxx)/2;
    // inner-collar facing: the white lining inside the neck opening ALWAYS stays white.
    // When trim itself is near-white (Khala/Legacy/Mosaic, white collar RING that must
    // still recolour) we isolate only the small inner facing; when trim is a distinct
    // colour (Kinetic/Prism/Apex) all neck-white is facing, so catch it generously.
    var whiteTrim = !!(palette && SRC[2][1]<0.20 && SRC[2][2]>0.70);
    var fy = whiteTrim?0.11:0.16, fx = whiteTrim?0.20:0.30;
    for(i=0;i<n;i++){
      if(!brightN[i]) continue;
      var Xf=i%W,Yf=(i/W)|0;
      if(Yf<miny+fy*gh && Math.abs(Xf-cx)<fx*gw) region[i]=3;
    }
    // pass 2: spatial collar/cuff split — only when trim shares the secondary colour
    // (Apex: lime trim == lime panels). When trim is its own colour (Kinetic: cyan) it
    // is already separated by the matcher, so skip.
    if(!palette || trimNearSecondary){
      for(i=0;i<n;i++){
        if(region[i]!==1) continue;
        var X2=i%W,Y2=(i/W)|0;
        var collar=(Y2<miny+0.22*gh)&&(Math.abs(X2-cx)<0.20*gw);
        var cuff=(Y2<miny+0.46*gh)&&(X2<minx+0.17*gw||X2>maxx-0.17*gw);
        if(collar||cuff) region[i]=2;
      }
    }
    // pass 3: per-region shading ratio = lum / (region mean * 1.04). regions 0..3
    var sum=[0,0,0,0],cnt=[0,0,0,0];
    for(i=0;i<n;i++){var z=region[i]; if(z>3)continue; sum[z]+=lumArr[i]; cnt[z]++;}
    var ref=[0,1,2,3].map(function(z){return cnt[z]?(sum[z]/cnt[z])*1.04:1;});
    for(i=0;i<n;i++){var z2=region[i]; if(z2>3)continue; var k=lumArr[i]/(ref[z2]||1); ratio[i]=k<0.4?0.4:k>1.18?1.18:k;}
    var view={mode:"composite",kind:kind,region:region,ratio:ratio,srcA:srcA,logoA:null,slots:{},dy:0};
    if(kind==="front" && slotJson && slotJson.front){
      var DW=slotJson.front.root.w, DH=slotJson.front.root.h;
      var mkSlot=function(rc){return {x:minx+rc.x/DW*gw, y:miny+rc.y/DH*gh, w:rc.w/DW*gw, h:rc.h/DH*gh};};
      view.slots={ sponsor:mkSlot(slotJson.front.slots.sponsor), crest:mkSlot(slotJson.front.slots.crest) };
      if(logo){ var lp=placeDesign(logo, mkSlot(slotJson.front.slots["logo-momuto"]), {contain:true,pad:1.06});
        var logoA=new Uint8Array(n); for(i=0;i<n;i++) logoA[i]=lp.data[i*4+3]; view.logoA=logoA; }
    }
    if(kind==="back"){ view.nameSlot={ cx:cx, cy:miny+gh*0.38, w:gw*0.50, h:gh*0.50 }; }
    return view;
  }
  function renderComposite(V){
    cv.style.transform="";
    var region=V.region, ratio=V.ratio, srcA=V.srcA, logoA=V.logoA, n=W*H;
    var out=ctx.createImageData(W,H), o=out.data;
    var P=hx(state.primary), S=hx(state.secondary), T=hx(state.trim);
    for(var i=0;i<n;i++){
      var z=region[i]; if(z>3) continue;
      var col = z===0?P : z===1?S : z===2?T : WHITE;   // 3 = neutral inner collar, not recoloured
      if(logoA && logoA[i]>110) col=T;
      var k=ratio[i];
      o[i*4]=Math.min(255,col[0]*k); o[i*4+1]=Math.min(255,col[1]*k); o[i*4+2]=Math.min(255,col[2]*k); o[i*4+3]=srcA[i];
    }
    ctx.putImageData(out,0,0);
    if(V.kind==="front"){ drawLogo(state.crest,V.slots.crest); drawLogo(state.sponsor,V.slots.sponsor); }
    else drawNameNumber(V);
  }

  function buildFront(blank,front,sleeve,logo,slotJson){
    var bc=offscreen(W,H), bx=bc.getContext("2d"); bx.drawImage(blank,0,0,W,H);
    var bd=bx.getImageData(0,0,W,H).data, n=W*H;
    var zoneIdx=new Int8Array(n), ratio=new Float32Array(n*3), srcA=new Uint8ClampedArray(n);
    var Bs=BASES.map(function(b){var s=b[0]+b[1]+b[2]||1;return [b[0]/s,b[1]/s,b[2]/s];});
    var minx=1e9,maxx=0,bsumx=0,bcnt=0,bminy=1e9,bmaxy=0;
    for(var i=0;i<n;i++){
      var r=bd[i*4],g=bd[i*4+1],b=bd[i*4+2],a=bd[i*4+3]; srcA[i]=a;
      if(a<8){zoneIdx[i]=-1;continue;}
      var x=i%W,y=(i/W)|0; if(x<minx)minx=x; if(x>maxx)maxx=x;
      var s=(r+g+b)||1,cr=r/s,cg=g/s,cb=b/s, best=0,bd2=1e9;
      for(var z=0;z<Bs.length;z++){var dr=cr-Bs[z][0],dg=cg-Bs[z][1],db=cb-Bs[z][2],dd=dr*dr+dg*dg+db*db;if(dd<bd2){bd2=dd;best=z;}}
      zoneIdx[i]=best;
      if(best===0){bsumx+=x;bcnt++; if(y<bminy)bminy=y; if(y>bmaxy)bmaxy=y;}
    }
    var neckBottom=bminy+(bmaxy-bminy)*0.16;
    var cxc=bcnt? bsumx/bcnt : (minx+maxx)/2;
    var leftT=minx+(maxx-minx)*0.30, rightT=minx+(maxx-minx)*0.70;
    var neutral=new Uint8Array(n);
    for(i=0;i<n;i++){
      var zz=zoneIdx[i]; if(zz<0)continue;
      var X=i%W,Y=(i/W)|0, R=bd[i*4],G=bd[i*4+1],B=bd[i*4+2];
      var mx=Math.max(R,G,B),mn=Math.min(R,G,B),dl=mx-mn,sat=mx?dl/mx:0;
      var hue=0; if(dl){ hue= mx===R? 60*(((G-B)/dl)%6) : mx===G? 60*((B-R)/dl+2) : 60*((R-G)/dl+4); if(hue<0)hue+=360; }
      var collarBot=bminy+(bmaxy-bminy)*0.22;
      var inNeck=Y<collarBot && Math.abs(X-cxc)<(maxx-minx)*0.16;
      if(inNeck && sat<0.22 && mx>70){ zoneIdx[i]=5; neutral[i]=1; continue; }
      if(Y>collarBot && sat>0.55 && (hue<=14||hue>=346||(hue>=160&&hue<=195))){ zoneIdx[i]=6; neutral[i]=1; continue; }
      if(zz===1 && Y>bminy+(bmaxy-bminy)*0.45){ zoneIdx[i]= X<cxc?3:4; neutral[i]=1; continue; }
      if(zz===2 && Y<neckBottom) continue;
      if(zz===2){ zoneIdx[i]= X<leftT?3 : X>rightT?4 : 0; neutral[i]=1; }
    }
    var zbb={};
    for(i=0;i<n;i++){
      var z2=zoneIdx[i]; if(z2<0)continue;
      var rr=bd[i*4],gg=bd[i*4+1],bb2=bd[i*4+2],base=BASES[z2];
      var lum=0.299*rr+0.587*gg+0.114*bb2, k;
      if(z2===6){k=0.96;} else if(z2===5){k=lum/215;} else if(neutral[i]){k=lum/175;}
      else {k=lum/((0.299*base[0]+0.587*base[1]+0.114*base[2])||1);}
      k=k<0.45?0.45:k>1.15?1.15:k; ratio[i*3]=ratio[i*3+1]=ratio[i*3+2]=k;
      var x2=i%W,y2=(i/W)|0, bb=zbb[z2]||(zbb[z2]={x0:1e9,y0:1e9,x1:0,y1:0});
      if(x2<bb.x0)bb.x0=x2; if(x2>bb.x1)bb.x1=x2; if(y2<bb.y0)bb.y0=y2; if(y2>bb.y1)bb.y1=y2;
    }
    var bbox=function(z){return {x:zbb[z].x0,y:zbb[z].y0,w:zbb[z].x1-zbb[z].x0+1,h:zbb[z].y1-zbb[z].y0+1};};
    var designRGB=new Uint8ClampedArray(n*3), isDesign=new Uint8Array(n);
    var place={0:placeDesign(front,bbox(0)),1:placeDesign(sleeve,bbox(1),{anchorTop:true}),
      3:placeDesign(sleeve,bbox(3),{anchorBottom:true,pad:1.12}),4:placeDesign(sleeve,bbox(4),{mirror:true,anchorBottom:true,pad:1.12})};
    for(i=0;i<n;i++){ var z3=zoneIdx[i]; if(z3<0)continue;
      if(DESIGN_ZONES[z3]!==undefined){ var pd=place[z3].data,a2=pd[i*4+3];
        if(a2>10){designRGB[i*3]=pd[i*4];designRGB[i*3+1]=pd[i*4+1];designRGB[i*3+2]=pd[i*4+2];isDesign[i]=1;} else isDesign[i]=2; } }
    var fb=bbox(0), DW=slotJson.front.root.w, DH=slotJson.front.root.h;
    var sc=Math.max(fb.w/DW,fb.h/DH)*1.02, cx2=fb.x+fb.w/2, cy2=fb.y+fb.h/2;
    var map=function(dx,dy){return [cx2+(dx-DW/2)*sc, cy2+(dy-DH/2)*sc];};
    var mkSlot=function(rc){var p1=map(rc.x,rc.y),p2=map(rc.x+rc.w,rc.y+rc.h);return {x:p1[0],y:p1[1],w:p2[0]-p1[0],h:p2[1]-p1[1]};};
    var slots={ sponsor:mkSlot(slotJson.front.slots.sponsor), crest:mkSlot(slotJson.front.slots.crest) };
    var lp=placeDesign(logo, mkSlot(slotJson.front.slots["logo-momuto"]), {contain:true,pad:1.06});
    var logoA=new Uint8Array(n); for(i=0;i<n;i++) logoA[i]=lp.data[i*4+3];
    return {kind:"front",zoneIdx:zoneIdx,ratio:ratio,srcA:srcA,designRGB:designRGB,isDesign:isDesign,logoA:logoA,slots:slots,dy:centerDY(srcA,n)};
  }

  function buildBack(blank,bodyDesign,sleeve){
    var bc=offscreen(W,H), bx=bc.getContext("2d"); bx.drawImage(blank,0,0,W,H);
    var bd=bx.getImageData(0,0,W,H).data, n=W*H;
    var zoneIdx=new Int8Array(n), ratio=new Float32Array(n*3), srcA=new Uint8ClampedArray(n), tmp=new Int8Array(n);
    var HUEB=[[168,0],[220,1],[30,2],[314,6],[260,7]];
    var minx=1e9,maxx=0,bsumx=0,bcnt=0,bminy=1e9,bmaxy=0,i;
    for(i=0;i<n;i++){
      var r=bd[i*4],g=bd[i*4+1],b=bd[i*4+2],a=bd[i*4+3]; srcA[i]=a;
      if(a<8){tmp[i]=-1;continue;}
      var x=i%W,y=(i/W)|0; if(x<minx)minx=x; if(x>maxx)maxx=x;
      var mx=Math.max(r,g,b),mn=Math.min(r,g,b),dl=mx-mn,sat=mx?dl/mx:0;
      var hue=0; if(dl){ hue=mx===r?60*(((g-b)/dl)%6):mx===g?60*((b-r)/dl+2):60*((r-g)/dl+4); if(hue<0)hue+=360; }
      var z;
      if(sat<0.15) z=-2; else { var best=0,bh=1e9; for(var q=0;q<HUEB.length;q++){var dh=Math.abs(hue-HUEB[q][0]); if(dh>180)dh=360-dh; if(dh<bh){bh=dh;best=HUEB[q][1];}} z=best; }
      tmp[i]=z; if(z===0){bsumx+=x;bcnt++; if(y<bminy)bminy=y; if(y>bmaxy)bmaxy=y;}
    }
    var cxc=bcnt?bsumx/bcnt:(minx+maxx)/2, collarBot=bminy+(bmaxy-bminy)*0.22;
    var baseLum={0:lum3(0,160,128),1:lum3(32,96,224),2:lum3(224,160,96),6:lum3(208,0,160),7:lum3(128,96,192)};
    var zbb={};
    for(i=0;i<n;i++){
      var z=tmp[i]; if(z===-1){zoneIdx[i]=-1;continue;}
      var X=i%W,Y=(i/W)|0,R=bd[i*4],G=bd[i*4+1],B=bd[i*4+2];
      if(z===-2){ var inNeck=Y<collarBot && Math.abs(X-cxc)<(maxx-minx)*0.16; z=inNeck?5:(X<cxc?3:4); }
      zoneIdx[i]=z;
      var lum=lum3(R,G,B);
      var k = z===6?0.96 : z===5?lum/215 : (z===3||z===4)?lum/200 : z===7?lum/175 : lum/(baseLum[z]||175);
      k=k<0.45?0.45:k>1.15?1.15:k; ratio[i*3]=ratio[i*3+1]=ratio[i*3+2]=k;
      var bb=zbb[z]||(zbb[z]={x0:1e9,y0:1e9,x1:0,y1:0});
      if(X<bb.x0)bb.x0=X;if(X>bb.x1)bb.x1=X;if(Y<bb.y0)bb.y0=Y;if(Y>bb.y1)bb.y1=Y;
    }
    var bbox=function(z){return {x:zbb[z].x0,y:zbb[z].y0,w:zbb[z].x1-zbb[z].x0+1,h:zbb[z].y1-zbb[z].y0+1};};
    var designRGB=new Uint8ClampedArray(n*3), isDesign=new Uint8Array(n);
    var place={0:placeDesign(bodyDesign,bbox(0))};
    if(zbb[1])place[1]=placeDesign(sleeve,bbox(1),{anchorTop:true});
    if(zbb[3])place[3]=placeDesign(sleeve,bbox(3),{anchorBottom:true,pad:1.12});
    if(zbb[4])place[4]=placeDesign(sleeve,bbox(4),{mirror:true,anchorBottom:true,pad:1.12});
    for(i=0;i<n;i++){ var zd=zoneIdx[i]; if(zd<0)continue;
      if(DESIGN_ZONES[zd]!==undefined && place[zd]){ var pd=place[zd].data,a2=pd[i*4+3];
        if(a2>10){designRGB[i*3]=pd[i*4];designRGB[i*3+1]=pd[i*4+1];designRGB[i*3+2]=pd[i*4+2];isDesign[i]=1;} else isDesign[i]=2; } }
    var b0=bbox(0);
    var nameSlot={ cx:b0.x+b0.w/2, cy:b0.y+b0.h*0.38, w:b0.w*0.64, h:b0.h*0.54 };
    return {kind:"back",zoneIdx:zoneIdx,ratio:ratio,srcA:srcA,designRGB:designRGB,isDesign:isDesign,logoA:null,slots:{},nameSlot:nameSlot,dy:centerDY(srcA,n)};
  }

  function render(){
    var V=views[active]; if(!V) return;
    if(V.mode==="composite") return renderComposite(V);
    cv.style.transform="";
    var zoneIdx=V.zoneIdx,ratio=V.ratio,srcA=V.srcA,designRGB=V.designRGB,isDesign=V.isDesign,logoA=V.logoA;
    var out=ctx.createImageData(W,H), o=out.data, n=W*H, dyW=(V.dy||0)*W;
    var P=hx(state.primary), S=hx(state.secondary), T=hx(state.trim);
    for(var i=0;i<n;i++){
      var z=zoneIdx[i]; if(z<0) continue;
      var r,g,b;
      if(WHITE_ZONES.has(z)){ r=WHITE[0];g=WHITE[1];b=WHITE[2]; }
      else if(TRIM_ZONES.has(z)){ r=T[0];g=T[1];b=T[2]; }
      else if(isDesign[i]===1){
        var dr=designRGB[i*3],dg=designRGB[i*3+1],db=designRGB[i*3+2], bi=0,bdist=1e9;
        for(var s=0;s<4;s++){ var ds=(dr-SRC4[s][0])*(dr-SRC4[s][0])+(dg-SRC4[s][1])*(dg-SRC4[s][1])+(db-SRC4[s][2])*(db-SRC4[s][2]); if(ds<bdist){bdist=ds;bi=s;} }
        if(bdist>OFFTOL){ r=dr;g=dg;b=db; } else { var t=TONE_T[bi]; r=P[0]+t*(S[0]-P[0]); g=P[1]+t*(S[1]-P[1]); b=P[2]+t*(S[2]-P[2]); }
      } else if(isDesign[i]===2 && (z===3||z===4)){ r=T[0];g=T[1];b=T[2]; }
      else { r=S[0];g=S[1];b=S[2]; }
      if(logoA && logoA[i]>110){ r=T[0];g=T[1];b=T[2]; }
      var oi=i+dyW; if(oi<0||oi>=n) continue;
      o[oi*4]=Math.min(255,r*ratio[i*3]); o[oi*4+1]=Math.min(255,g*ratio[i*3+1]); o[oi*4+2]=Math.min(255,b*ratio[i*3+2]); o[oi*4+3]=srcA[i];
    }
    ctx.putImageData(out,0,0);
    ctx.save(); ctx.translate(0, V.dy||0);
    if(V.kind==="front"){ drawLogo(state.crest,V.slots.crest); drawLogo(state.sponsor,V.slots.sponsor); }
    else drawNameNumber(V);
    ctx.restore();
  }
  function tintFont(f,dw,dh,color){
    var c=offscreen(Math.max(1,Math.ceil(dw)),Math.max(1,Math.ceil(dh))), x=c.getContext("2d");
    x.drawImage(f,0,0,dw,dh); x.globalCompositeOperation="source-in"; x.fillStyle=color; x.fillRect(0,0,c.width,c.height); return c;
  }
  function drawNameNumber(V){
    var f=fontImg[state.font], sl=V.nameSlot; if(!f||!sl) return;
    var s=Math.min(sl.w/f.width, sl.h/f.height), dw=f.width*s, dh=f.height*s, dx=sl.cx-dw/2, dy=sl.cy-dh/2;
    var near=function(a,b){var A1=hx(a),B1=hx(b);return Math.abs(A1[0]-B1[0])+Math.abs(A1[1]-B1[1])+Math.abs(A1[2]-B1[2])<70;};
    var strokeCol=state.trim;
    if(near(strokeCol,state.nameColor)) strokeCol=state.secondary;
    if(near(strokeCol,state.nameColor)) strokeCol=state.primary;
    if(near(strokeCol,state.nameColor)){ var c=hx(state.nameColor); strokeCol=lum3(c[0],c[1],c[2])>140?"#111111":"#ffffff"; }
    var fill=tintFont(f,dw,dh,state.nameColor), stroke=tintFont(f,dw,dh,strokeCol);
    var rad=Math.max(1.25,dh*0.007);
    for(var a=0;a<20;a++){ var tt=a/20*Math.PI*2; ctx.drawImage(stroke, dx+Math.cos(tt)*rad, dy+Math.sin(tt)*rad); }
    ctx.drawImage(fill,dx,dy);
  }
  function drawLogo(img,slot){ if(!img||!slot)return; var s=Math.min(slot.w/img.width,slot.h/img.height),dw=img.width*s,dh=img.height*s;
    ctx.drawImage(img, slot.x+(slot.w-dw)/2, slot.y+(slot.h-dh)/2, dw, dh); }

  function buildUI(){
    var swModal=root.getElementById("swModal"), swGrid=root.getElementById("swGrid"), swTitle=root.getElementById("swTitle");
    var paintSw=function(k){ root.getElementById(k+"Sw").style.background=state[k]; };
    var openSw=function(k,label){ swTitle.textContent=label; swGrid.innerHTML="";
      PALETTE.forEach(function(p){ var d=document.createElement("div"); d.style.background=p[0]; d.title=p[1];
        if(p[0].toLowerCase()===String(state[k]).toLowerCase()) d.classList.add("sel");
        d.onclick=function(){ state[k]=p[0]; paintSw(k); render(); swModal.classList.remove("open"); };
        swGrid.appendChild(d); });
      swModal.classList.add("open"); };
    root.querySelectorAll(".sw").forEach(function(b){ var k=b.dataset.k; paintSw(k);
      b.onclick=function(){ openSw(k, b.previousElementSibling.textContent); }; });
    root.getElementById("swClose").onclick=function(){ swModal.classList.remove("open"); };
    swModal.onclick=function(e){ if(e.target===swModal) swModal.classList.remove("open"); };
    var repaintAll=function(){ ["primary","secondary","trim"].forEach(paintSw); };
    var handleUp=function(inputId,nameId,key){
      root.getElementById(inputId).addEventListener("change",function(e){
        var f=e.target.files[0]; if(!f)return;
        root.getElementById(nameId).textContent=f.name.slice(0,14);
        var im=new Image(); im.onload=function(){state[key]=knockoutBg(im);render();}; im.src=URL.createObjectURL(f); });
    };
    handleUp("crest","crestName","crest"); handleUp("sponsor","sponsorName","sponsor");
    var perso=root.getElementById("perso");
    root.querySelectorAll("#vtog button").forEach(function(btn){
      btn.onclick=function(){ active=btn.dataset.v;
        root.querySelectorAll("#vtog button").forEach(function(x){x.classList.toggle("on",x===btn);});
        perso.style.display = active==="back"?"block":"none"; render(); };
    });
    var fb=root.getElementById("fonts");
    FONTS.forEach(function(F){ var key=F[0],label=F[1], f=fontImg[key], c=document.createElement("button");
      c.className="fontchip"+(state.font===key?" on":"");
      var ph=120, srcY=f.height*0.25, srcH=f.height*0.73, sc=ph/srcH, pw=Math.round(f.width*sc);
      var pcv=offscreen(pw,ph), px=pcv.getContext("2d");
      px.drawImage(f,0,srcY,f.width,srcH,0,0,pw,ph);
      px.globalCompositeOperation="source-in"; px.fillStyle="#e9ecf1"; px.fillRect(0,0,pw,ph);
      var im=document.createElement("img"); im.src=pcv.toDataURL();
      var sp=document.createElement("span"); sp.textContent=label;
      c.appendChild(im); c.appendChild(sp);
      c.onclick=function(){ state.font=key; root.querySelectorAll(".fontchip").forEach(function(x){x.classList.remove("on");}); c.classList.add("on"); render(); };
      fb.appendChild(c); });
    var pc=root.getElementById("presets");
    Object.keys(PRESETS).forEach(function(name){ var m=PRESETS[name], b=document.createElement("button"); b.textContent=name;
      b.onclick=function(){ Object.assign(state,m); repaintAll(); render(); }; pc.appendChild(b); });
    root.getElementById("reset").onclick=function(){ Object.assign(state,{primary:DEFAULTS.primary,secondary:DEFAULTS.secondary,trim:DEFAULTS.trim,nameColor:DEFAULTS.nameColor}); repaintAll(); render(); };
    // order estimate: kit type + quantity -> RTP price + free flag/armband promo
    function updateEstimate(){
      var q=Math.max(1, parseInt(state.qty,10)||1);
      var euro=function(n){return "€"+n.toFixed(2);};
      // per-option prices on the kit cards
      root.getElementById("kpJersey").innerHTML="<s>"+euro(tierBase("jersey",q))+"</s>"+euro(unitPrice("jersey",q));
      root.getElementById("kpKit").innerHTML="<s>"+euro(tierBase("kit",q))+"</s>"+euro(unitPrice("kit",q));
      // live price block for the selected kit
      var unit=unitPrice(state.kit,q), orig=tierBase(state.kit,q), total=unit*q, label=state.kit==="kit"?T.perKit:T.perJersey;
      root.getElementById("est").innerHTML=
        '<div class="pr-row"><div class="pr-main"><span class="pr-cur">'+euro(unit)+'</span><span class="pr-orig">'+euro(orig)+'</span><span class="pr-per">/ '+label+'</span></div><span class="pr-badge">'+T.badge+'</span></div>'
        +'<div class="pr-detail">'+q+' '+T.units+' · '+T.estimated+' <b>'+euro(total)+'</b> · '+T.finalPrice+'</div>';
      root.getElementById("promo").style.display=(state.kit==="kit")?"block":"none";
    }
    root.querySelectorAll("#kit button").forEach(function(btn){
      btn.onclick=function(){ state.kit=btn.dataset.kit;
        root.querySelectorAll("#kit button").forEach(function(x){x.classList.toggle("on",x===btn);}); updateEstimate(); };
    });
    var qtyEl=root.getElementById("qty");
    var setQty=function(v){ v=Math.max(1, v|0); state.qty=v; qtyEl.value=v; updateEstimate(); };
    root.getElementById("qminus").onclick=function(){ setQty((parseInt(qtyEl.value,10)||1)-1); };
    root.getElementById("qplus").onclick=function(){ setQty((parseInt(qtyEl.value,10)||1)+1); };
    qtyEl.addEventListener("change",function(){ setQty(parseInt(qtyEl.value,10)||1); });
    qtyEl.addEventListener("input",function(){ if(qtyEl.value){ state.qty=parseInt(qtyEl.value,10)||1; updateEstimate(); } });
    updateEstimate();
    root.getElementById("order").onclick=function(){ handoffToCart(); };
  }

  function captureView(v){ var prev=active; active=v; render(); var url=cv.toDataURL("image/png"); active=prev; render(); return url; }
  function buildDesignPayload(){
    return { tool:"rtp-2d-configurator", template:opts.template, suit:"mamuto3",
      colours:{ primary:state.primary, secondary:state.secondary, trim:state.trim },
      nameNumber:{ font:state.font, fill:state.nameColor },
      logos:{ crest:!!state.crest, sponsor:!!state.sponsor },
      preview:{ front:captureView("front"), back:captureView("back") } };
  }
  async function handoffToCart(){
    var design=buildDesignPayload();
    // Full kit -> route to the Kit SKU (separate product with the RTP-Kit rebate); else the Jersey SKU.
    var isKit=(state.kit==="kit");
    var pid=(isKit && CART.productIdKit) ? CART.productIdKit : CART.productId;
    var oid=(isKit && CART.oemIdKit)     ? CART.oemIdKit     : CART.oemId;
    try{ console.log("[rtp] handoff ->", {kit:isKit, productId:pid, oemId:oid, template:design.template, colours:design.colours}); }catch(e){}
    // 1) embedded on the product page -> reuse the page's goto3d/jump3d; prefer a kit-specific hook for full kit
    var goto3d=(isKit && (document.getElementById("goto3d-kit") || (typeof window.jump3d_kit==="function" && window.jump3d_kit)))
            || document.getElementById("goto3d") || (typeof window.jump3d==="function" && window.jump3d);
    if(goto3d){ if(typeof goto3d==="function") goto3d(); else goto3d.click(); return; }
    // 2) standalone (preview/testing) -> replicate the same flow with the selected SKU
    var userId=genUserId();
    var body=new URLSearchParams({ productId:pid, quantity:"1", userId:userId, oemId:oid,
      lanType:CART.lang, timestamp:String(Math.floor(Date.now()/1000)), ranstr:String(Math.floor(Math.random()*1e10)) });
    try{ var resp=await fetch(CART.base+"/v1/addToEcart",{ method:"POST",
          headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"}, body:body });
         console.log("[rtp] addToEcart ->", resp.status); }
    catch(e){ console.warn("[rtp] addToEcart failed (will still redirect):", e); }
    window.location.href = CART.base+"/cart?uuid="+userId+"&langguage="+CART.lang;
  }

  // small handle for host page / testing
  init();
  return { get state(){return state;}, render:render, setView:function(v){active=v;
    root.querySelectorAll("#vtog button").forEach(function(x){x.classList.toggle("on",x.dataset.v===v);});
    var p=root.getElementById("perso"); if(p)p.style.display=v==="back"?"block":"none"; render();},
    captureView:captureView, payload:buildDesignPayload, addToCart:handoffToCart };
}

function mount(host){
  if(host.__rtpMounted) return; host.__rtpMounted=true;
  var opts={ template:host.dataset.template||"the-fracture", productId:host.dataset.product||"16534",
    oemId:host.dataset.oem||"10294534", lang:host.dataset.lang||"en",
    productIdKit:host.dataset.productKit||null, oemIdKit:host.dataset.oemKit||null,
    mode:host.dataset.mode||null,
    primary:host.dataset.primary||null, secondary:host.dataset.secondary||null,
    trim:host.dataset.trim||null, nameColor:host.dataset.namecolor||null,
    assets: host.dataset.assets ? host.dataset.assets.replace(/\/?$/,"/") : DEFAULT_ASSETS };
  opts.t=I18N[opts.lang]||I18N.en;
  var root=host.attachShadow({mode:"open"});
  root.innerHTML="<style>"+CSS+"</style>"+buildHTML(opts.t);
  host.__rtp=run(root,opts);
}
function boot(){ document.querySelectorAll("#momuto-rtp,[data-momuto-rtp]").forEach(mount); }
if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
