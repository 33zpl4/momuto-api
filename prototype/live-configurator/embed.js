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
function unitPrice(kind,qty){ var t=PRICING[kind]||PRICING.jersey, p=t[0][1];
  for(var i=0;i<t.length;i++){ if(qty>=t[i][0]) p=t[i][1]; } return p*(1-RTP_OFF); }
var lum3=function(r,g,b){return 0.299*r+0.587*g+0.114*b;};
var hx=function(h){h=h.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
var load=function(src){return new Promise(function(r){var i=new Image();i.crossOrigin="anonymous";i.onload=function(){r(i);};i.src=src;});};
function offscreen(w,h){var c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function centerDY(srcA,n){ var y0=1e9,y1=0; for(var i=0;i<n;i++){ if(srcA[i]>8){ var y=(i/W)|0; if(y<y0)y0=y; if(y>y1)y1=y; } } return (y1<y0)?0:Math.round(H/2-(y0+y1)/2); }
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
+".wrap{display:flex;gap:24px;flex-wrap:wrap;}"
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
+".kit button{flex:1;padding:9px;border:1px solid var(--line);background:#22252c;color:var(--txt);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;}"
+".kit button.on{background:var(--brand);color:#fff;border-color:var(--brand);}"
+".qtyrow{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);}"
+".qtyrow label{font-size:14px;}"
+".qstep{display:flex;align-items:center;}"
+".qstep button{width:30px;height:30px;border:1px solid var(--line);background:#22252c;color:var(--txt);cursor:pointer;font-size:16px;line-height:1;}"
+".qstep input{width:54px;height:30px;text-align:center;border:1px solid var(--line);border-left:0;border-right:0;background:#15171c;color:var(--txt);font-size:14px;-moz-appearance:textfield;}"
+".qstep input::-webkit-outer-spin-button,.qstep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}"
+".est{margin:9px 0 0;font-size:12px;color:var(--mut);line-height:1.5;}"
+".est b{color:var(--txt);font-size:20px;font-weight:800;}"
+".promo{margin:9px 0 2px;padding:8px 10px;border-radius:8px;background:rgba(226,33,75,.12);border:1px solid rgba(226,33,75,.45);color:#ffd2dc;font-size:12px;}";

var HTML =
 '<div class="wrap">'
+'  <div class="stage"><canvas id="cv" width="1500" height="1500"></canvas><div id="busy">Loading…</div>'
+'    <div class="vtog" id="vtog"><button data-v="front" class="on">Front</button><button data-v="back">Back</button></div>'
+'  </div>'
+'  <div class="panel">'
+'    <h2>Colours</h2>'
+'    <div class="zone"><label>Primary</label><button class="sw" id="primarySw" data-k="primary"></button></div>'
+'    <div class="zone"><label>Secondary</label><button class="sw" id="secondarySw" data-k="secondary"></button></div>'
+'    <div class="zone"><label>Trim (collar &amp; cuffs)</label><button class="sw" id="trimSw" data-k="trim"></button></div>'
+'    <h2>Your badges</h2>'
+'    <div class="uploads">'
+'      <label class="up">Team crest <span class="pill" id="crestName">Upload ▸</span><input type="file" id="crest" accept="image/*" hidden></label>'
+'      <label class="up">Sponsor <span class="pill" id="sponsorName">Upload ▸</span><input type="file" id="sponsor" accept="image/*" hidden></label>'
+'    </div>'
+'    <p class="svc">JPG or PNG both work — plain backgrounds are auto-trimmed here in the preview. Every crest &amp; sponsor is then <b>vectorised &amp; cleaned by our design team</b>, placement refined, and you receive a <b>free proof to approve before printing</b>.</p>'
+'    <div id="perso" style="display:none">'
+'      <h2>Personalisation · Back</h2>'
+'      <div class="fonts" id="fonts"></div>'
+'      <div class="zone"><label>Name &amp; number</label><button class="sw" id="nameColorSw" data-k="nameColor"></button></div>'
+'    </div>'
+'    <div class="presets" id="presets"></div>'
+'    <h2>Order estimate</h2>'
+'    <div class="kit" id="kit"><button data-kit="jersey" class="on">Jersey</button><button data-kit="kit">Full kit</button></div>'
+'    <div class="qtyrow"><label>Quantity</label><div class="qstep"><button id="qminus" type="button">−</button><input id="qty" type="number" min="1" value="10"><button id="qplus" type="button">+</button></div></div>'
+'    <div class="est" id="est"></div>'
+'    <div class="promo" id="promo" style="display:none">✓ Includes a free team flag + captain&#39;s armband</div>'
+'    <div class="row"><button class="reset" id="reset">Reset</button><button class="cta" id="order">Add to cart ▸</button></div>'
+'  </div>'
+'</div>'
+'<div class="sw-modal" id="swModal"><div class="sw-card">'
+'  <div class="sw-head"><span id="swTitle">Pick a colour</span><button id="swClose">✕</button></div>'
+'  <div class="sw-grid" id="swGrid"></div>'
+'</div></div>';

// ---- per-instance engine ----
function run(root, opts){
  var A=opts.assets;
  var assetSrc=function(name){ return (ASSET_DATA && ASSET_DATA[name]) ? ASSET_DATA[name] : (A+name); };
  var cv=root.getElementById("cv"), ctx=cv.getContext("2d",{willReadFrequently:true});
  var views={}, active="front", fontImg={};
  var state={ primary:"#2e3238", secondary:"#ffffff", trim:"#121212", crest:null, sponsor:null, font:"vanguard", nameColor:"#121212", kit:"jersey", qty:10 };
  var CART={ base:"https://design.momuto.com", productId:opts.productId, oemId:opts.oemId, lang:opts.lang };

  async function init(){
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
    var nameSlot={ cx:b0.x+b0.w/2, cy:b0.y+b0.h*0.34, w:b0.w*0.64, h:b0.h*0.54 };
    return {kind:"back",zoneIdx:zoneIdx,ratio:ratio,srcA:srcA,designRGB:designRGB,isDesign:isDesign,logoA:null,slots:{},nameSlot:nameSlot,dy:centerDY(srcA,n)};
  }

  function render(){
    var V=views[active]; if(!V) return;
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
    root.getElementById("reset").onclick=function(){ Object.assign(state,{primary:"#2e3238",secondary:"#ffffff",trim:"#121212",nameColor:"#121212"}); repaintAll(); render(); };
    // order estimate: kit type + quantity -> RTP price + free flag/armband promo
    function updateEstimate(){
      var q=Math.max(1, parseInt(state.qty,10)||1);
      var unit=unitPrice(state.kit,q), total=unit*q, label=state.kit==="kit"?"full kit":"jersey";
      root.getElementById("est").innerHTML="Estimated <b>€"+total.toFixed(2)+"</b><br>€"+unit.toFixed(2)+"/unit · "+label+" · "+q+" units · RTP price (10% off) — final at checkout";
      root.getElementById("promo").style.display=(state.kit==="kit" && q>=10)?"block":"none";
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
    try{ console.log("[rtp] design ->", {template:design.template, colours:design.colours, nameNumber:design.nameNumber,
      logos:design.logos, preview:{front:design.preview.front.length+"b", back:design.preview.back.length+"b"}}); }catch(e){}
    // 1) embedded on the product page -> reuse the page's exact goto3d/jump3d procedure
    var goto3d=document.getElementById("goto3d") || (typeof window.jump3d==="function" && window.jump3d);
    if(goto3d){ if(typeof goto3d==="function") goto3d(); else goto3d.click(); return; }
    // 2) standalone (preview/testing) -> replicate the same flow
    var userId=genUserId();
    var body=new URLSearchParams({ productId:CART.productId, quantity:"1", userId:userId, oemId:CART.oemId,
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
    assets: host.dataset.assets ? host.dataset.assets.replace(/\/?$/,"/") : DEFAULT_ASSETS };
  var root=host.attachShadow({mode:"open"});
  root.innerHTML="<style>"+CSS+"</style>"+HTML;
  host.__rtp=run(root,opts);
}
function boot(){ document.querySelectorAll("#momuto-rtp,[data-momuto-rtp]").forEach(mount); }
if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
