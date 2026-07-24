/*!
 * MOMUTO — Iconic Series product-page runtime.
 *
 * ONE file for every Iconic Series product page, on every store. Carries the
 * things that have no SEO value and were previously copy-pasted into each
 * page's CMS blocks: all CSS, the theme overrides, accordion behaviour, and
 * the size-guide modal (display:none, so nothing indexable is lost).
 *
 * Everything indexable — banner, moment copy, accordion TEXT, series-grid
 * links — stays baked into each page's HTML by scripts/build-iconic-pages.js.
 * Do not move page copy in here: it is the only text distinguishing these
 * pages from one another, and JS-injected content is a second-pass gamble.
 *
 * Guard: runs only when the page carries <div data-iconic-page>. Deliberately
 * NOT a URL match — product handles differ per store and slugs change.
 */
(function () {
  'use strict';

  if (!document.querySelector('[data-iconic-page]')) return;

  // ── Styles (blocks 1–4, deduplicated) ─────────────────────────────────────

  var CSS = [
    // theme overrides — dark mode
    'body{background-color:#0a0a0a!important;color:#f4f2ee!important;}',
    '.product-router-nav-warp,.product-router-nav{display:none!important;}',
    // NOTE: drop 01 hid #product-tabs because its content lived in a custom
    // per-product template. Ours arrives as body_html, which renders INSIDE
    // that tab — hiding it would hide the whole page. Instead strip the tab
    // chrome and let the panel read as page content.
    '.product-tabs-card .tab-nav,.product-tabs-card .tabs-header,#product-tabs .tab-nav{display:none!important;}',
    '#product-tabs,.product-tabs-card{background:transparent!important;border:none!important;padding:0!important;}',
    'h1{font-family:"Playfair Display",serif;font-size:24px;font-weight:400;color:#f4f2ee!important;margin:12px 0;letter-spacing:-.01em;}',
    '.product-info-describe h2,.control-product_detail-describe h2{color:#f4f2ee!important;font-family:"Playfair Display",serif;font-size:28px!important;font-weight:400!important;margin:12px 0;}',
    '.product-info-subtitle{color:#8c8882!important;}',
    '.product-info-describe,.control-product_detail-describe,.product-info-describe *{color:#8c8882!important;}',
    '.product-price,.product-price *{color:#f4f2ee!important;}',
    '.product-sku-values-item{color:#f4f2ee!important;border-color:rgba(244,242,238,.2)!important;}',
    '.product-sku-values-item-active{border-color:#c8a96e!important;}',
    '.product-sku-name{color:#f4f2ee!important;}',
    '.secondary_btn.product-cart{background-color:#f4f2ee!important;border-color:#f4f2ee!important;color:#0a0a0a!important;}',
    '.secondary_btn.product-cart:hover{background-color:#1a1a1a!important;border-color:#c8a96e!important;color:#f4f2ee!important;}',
    '@media(min-width:768px){.product-grid-bottom .product-left.product-preview{width:100%!important;}' +
      '.preview_bigtiledown_wrapper{grid-template-columns:1fr!important;gap:12px!important;}' +
      '.swiper-slide.control-product_detail-picture_item{width:100%!important;}}',

    // banner
    '.iconic-series-banner{background:#0a0a0a;color:#f4f2ee;padding:32px 24px;margin:30px 0;border-left:3px solid #c8a96e;}',
    '.banner-inner{max-width:640px;}',
    '.banner-label{font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:#c8a96e;margin-bottom:12px;font-weight:500;}',
    '.banner-title{font-family:"Playfair Display",serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#f4f2ee;}',
    '.banner-subtitle{font-family:"DM Sans",sans-serif;font-size:14px;font-weight:300;line-height:1.7;color:#8c8882;margin:0;}',

    // accordions
    '.accordion-content p,.accordion-content li{font-size:15px;line-height:1.5;color:#8c8882;}',
    '.accordion-content strong{color:#f4f2ee;}',
    '.accordion-header{cursor:pointer;font-family:"DM Sans",sans-serif;font-size:14px;font-weight:500;letter-spacing:.15em;padding:15px 0;border-bottom:1px solid rgba(244,242,238,.1);transition:all .3s ease;display:flex;align-items:center;gap:10px;color:#f4f2ee;}',
    '.accordion-header.active{border-bottom:2px solid #c8a96e;}',
    '.accordion-content{max-height:0;overflow:hidden;opacity:0;transition:max-height .3s ease,opacity .3s ease;padding:0;margin-bottom:20px;}',
    '.accordion-item.open .accordion-content{max-height:1000px;opacity:1;padding:10px 0;}',
    '.accordion-icon svg{flex-shrink:0;}',
    '.flex-container{display:flex;flex-wrap:wrap;gap:40px;}',
    '.flex-item{flex:1;min-width:250px;}',
    '.flex-item h3{font-size:15px;font-weight:600;color:#f4f2ee;}',
    '.flex-item ul{list-style-type:disc;padding-left:20px;color:#8c8882;}',
    '#size-guide-button{background:none;border:none;color:#c8a96e;text-decoration:underline;font-weight:500;cursor:pointer;padding:0;font-size:14px;}',

    // moment
    '.moment-section{padding:60px 20px;background-color:#0a0a0a;color:#f4f2ee;}',
    '.moment-inner{max-width:800px;margin:0 auto;}',
    '.moment-label{font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:#c8a96e;margin-bottom:20px;font-weight:500;}',
    '.moment-title{font-family:"Playfair Display",serif;font-size:clamp(28px,4vw,42px);font-weight:400;line-height:1.15;margin-bottom:24px;color:#f4f2ee;}',
    '.moment-title em{font-style:italic;}',
    '.moment-body{font-family:"DM Sans",sans-serif;font-size:16px;font-weight:300;line-height:1.85;color:#8c8882;max-width:600px;}',
    '.moment-detail{margin-top:40px;padding-top:24px;border-top:1px solid rgba(244,242,238,.1);display:flex;gap:40px;flex-wrap:wrap;}',
    '.moment-detail-item{display:flex;flex-direction:column;gap:4px;}',
    '.moment-detail-label{font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#c8a96e;font-weight:500;}',
    '.moment-detail-value{font-family:"Playfair Display",serif;font-size:18px;color:#f4f2ee;}',

    // series grid
    '.series-section{padding:60px 20px;background-color:#0a0a0a;}',
    '.series-inner{max-width:1000px;margin:0 auto;}',
    '.series-label{font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:#c8a96e;margin-bottom:12px;font-weight:500;}',
    '.series-heading{font-family:"Playfair Display",serif;font-size:28px;font-weight:400;color:#f4f2ee;margin-bottom:40px;}',
    '.series-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}',
    '.series-card{text-decoration:none;color:inherit;display:block;}',
    '.series-card-image{display:flex;align-items:center;justify-content:center;background:#111!important;}',
    '.series-card-image img{width:100%;height:100%;object-fit:contain;padding:12px;transition:transform .5s ease;}',
    '.series-card:hover .series-card-image img{transform:scale(1.05);}',
    '.series-card-ref{font-family:"DM Sans",sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#c8a96e;font-weight:600;margin-bottom:4px;}',
    '.series-card-name{font-family:"Playfair Display",serif;font-size:18px;color:#f4f2ee;transition:color .3s ease;}',
    '.series-card:hover .series-card-name{color:#c8a96e;}',
    '.series-card-price{font-family:"DM Sans",sans-serif;font-size:14px;color:#8c8882;font-weight:300;margin-top:4px;}',
    '.back-to-top{display:block;text-align:center;margin-top:48px;font-family:"DM Sans",sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8c8882;text-decoration:none;transition:color .3s ease;}',
    '.back-to-top:hover{color:#c8a96e;}',
    '@media(max-width:767px){.series-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:16px;padding-bottom:10px;scrollbar-width:none;}' +
      '.series-grid::-webkit-scrollbar{display:none;}.series-card{flex:0 0 70vw;scroll-snap-align:start;}.moment-detail{gap:24px;}}',
    '@media(max-width:768px){.accordion-header{font-size:13px;}}',

    // size-guide modal
    '#size-guide-modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,.7);z-index:1000;align-items:center;justify-content:center;}',
    '#size-guide-modal .modal-content{background-color:#fff;color:#1a1a1a;width:90%;max-width:800px;max-height:90vh;overflow-y:auto;position:relative;border-radius:4px;padding:30px;font-size:15px;line-height:1.5;}',
    '#close-modal-button{position:absolute;top:15px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;color:#333;}',
    '#size-guide-modal .modal-header{text-align:center;margin-bottom:20px;}',
    '#size-guide-modal .modal-header h2{font-family:"DM Sans",sans-serif;font-size:18px;font-weight:500;letter-spacing:.15em;color:#1a1a1a;margin:0;}',
    '#size-guide-modal .modal-header h3{font-size:14px;font-weight:400;color:#8c8882;margin:5px 0 0;}',
    '#size-guide-modal .measurement-container{display:flex;flex-wrap:wrap;margin-bottom:30px;}',
    '#size-guide-modal .image-container{flex:1 1 300px;padding:0 15px;display:flex;justify-content:center;}',
    '#size-guide-modal .image-container img{max-width:100%;height:auto;}',
    '#size-guide-modal .table-container{flex:2 1 400px;padding:0 15px;}',
    '#size-guide-modal table{width:100%;border-collapse:collapse;}',
    '#size-guide-modal th{padding:10px;text-align:left;font-weight:600;border-bottom:1px solid #ddd;background-color:#f5f5f5;font-size:15px;color:#1a1a1a;}',
    '#size-guide-modal td{padding:10px;border-bottom:1px solid #eee;font-size:15px;color:#1a1a1a;}',
    '#size-guide-modal .size-cell{font-weight:600;}',
    '#size-guide-modal .how-to-measure{margin-top:30px;}',
    '#size-guide-modal .how-to-measure h3{font-size:14px;font-weight:500;letter-spacing:.1em;color:#1a1a1a;margin-bottom:20px;}',
    '#size-guide-modal .measure-container{display:flex;flex-wrap:wrap;gap:20px;}',
    '#size-guide-modal .measure-item{flex:1 1 200px;}',
    '#size-guide-modal .measure-title{font-weight:600;margin-bottom:5px;font-size:15px;color:#1a1a1a;}',
    '#size-guide-modal .measure-desc{color:#555;line-height:1.4;font-size:15px;}'
  ].join('');

  var style = document.createElement('style');
  style.setAttribute('data-iconic', '');
  style.appendChild(document.createTextNode(CSS));
  document.head.appendChild(style);

  // ── Size-guide modal (hidden by default — no indexable content) ───────────

  var SIZE_ROWS = [
    ['XS', '80-88', '65-73', '80-88'], ['S', '88-96', '73-81', '88-96'],
    ['M', '96-104', '81-89', '96-104'], ['L', '104-112', '89-97', '104-112'],
    ['XL', '112-124', '97-109', '112-120'], ['XXL', '124-136', '109-121', '120-128']
  ];

  var SIZE_I18N = {
    en: { title: 'SIZE GUIDE', units: 'MEASUREMENTS IN CM', how: 'HOW TO MEASURE',
      cols: ['SIZE', 'CHEST', 'WAIST', 'HIPS'],
      steps: [
        ['1. CHEST CIRCUMFERENCE', 'Measure at the widest point of the chest under the armpits and make sure the tape is straight and taut in back as well.'],
        ['2. WAIST CIRCUMFERENCE', 'Measure at the narrowest point of the waist just above the navel.'],
        ['3. HIPS CIRCUMFERENCE', 'Measure at the widest point of the hips and make sure the tape is straight and taut in back as well.']
      ] }
  };

  function buildModal(lang) {
    var t = SIZE_I18N[lang] || SIZE_I18N.en;
    var head = t.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
    var body = SIZE_ROWS.map(function (r) {
      return '<tr><td class="size-cell">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    }).join('');
    var steps = t.steps.map(function (s) {
      return '<div class="measure-item"><p class="measure-title">' + s[0] + '</p><p class="measure-desc">' + s[1] + '</p></div>';
    }).join('');

    var el = document.createElement('div');
    el.id = 'size-guide-modal';
    el.innerHTML =
      '<div class="modal-content"><button id="close-modal-button" aria-label="Close">×</button>' +
      '<div class="modal-header"><h2>' + t.title + '</h2><h3>' + t.units + '</h3></div>' +
      '<div class="measurement-container">' +
        '<div class="image-container"><img loading="lazy" alt="" src="https://cdn.staticsoe.com/pics/0523959d6ddaed948b20194f68b96a3825ef17a570104ccac9dfe5770d23a243.webp"></div>' +
        '<div class="table-container"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '</div>' +
      '<div class="how-to-measure"><h3>' + t.how + '</h3><div class="measure-container">' + steps + '</div></div>' +
      '</div>';
    return el;
  }

  // ── Behaviour ─────────────────────────────────────────────────────────────

  function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(function (header) {
      if (header.hasAttribute('data-bound')) return; // init runs twice; don't double-bind
      header.setAttribute('data-bound', '');
      header.addEventListener('click', function () {
        var item = header.parentElement;
        document.querySelectorAll('.accordion-item').forEach(function (i) {
          if (i !== item) {
            i.classList.remove('open');
            var h = i.querySelector('.accordion-header');
            if (h) h.classList.remove('active');
          }
        });
        item.classList.toggle('open');
        header.classList.toggle('active');
      });
    });
  }

  function initSizeGuide(lang) {
    var btn = document.getElementById('size-guide-button');
    if (!btn) return;
    var modal = buildModal(lang);
    document.body.appendChild(modal);

    var open = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };
    var close = function () {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    btn.addEventListener('click', open);
    modal.querySelector('#close-modal-button').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') close();
    });
  }

  // Theme buttons render after our script; poll briefly rather than racing.
  function whenPresent(selector, cb, tries) {
    tries = tries == null ? 40 : tries;
    var el = document.querySelector(selector);
    if (el) return cb(el);
    if (tries <= 0) return;
    setTimeout(function () { whenPresent(selector, cb, tries - 1); }, 150);
  }

  function initCartArea() {
    whenPresent('.main_btn.product-now', function (el) { el.style.display = 'none'; }, 20);
    whenPresent('.control-product_detail-quantity_box', function (el) { el.style.display = 'none'; }, 20);
    whenPresent('.secondary_btn.product-cart', function (btn) {
      var marker = document.querySelector('[data-iconic-page]');
      btn.textContent = (marker && marker.getAttribute('data-cart-label')) || 'ADD TO CART';
      btn.style.cssText += ';background-color:#0a0a0a;border-color:#0a0a0a;color:#f4f2ee;' +
        'font-family:"DM Sans",sans-serif;font-weight:500;font-size:13px;text-transform:uppercase;' +
        'letter-spacing:.2em;transition:all .3s ease;';
    });
  }

  // The banner sits at the very top of a drop 01 page, above the gallery. Our
  // copy arrives inside the detail tab, i.e. below the product — so lift it to
  // the top of the content area to match. Purely visual: the markup is already
  // in the HTML source either way, so nothing changes for crawlers.
  function liftBanner() {
    var banner = document.querySelector('.iconic-series-banner');
    if (!banner || banner.hasAttribute('data-lifted')) return;

    // Walk up from the banner to the outermost block that still sits inside
    // the page body, and insert above THAT. Anchoring to a named container
    // fails because every candidate already contains the banner (it arrives
    // inside the detail tab, which is nested in the product wrapper).
    var top = banner;
    while (top.parentNode && top.parentNode !== document.body &&
           top.parentNode.tagName !== 'MAIN' && top.parentNode !== document.documentElement) {
      top = top.parentNode;
    }
    if (!top.parentNode || top === banner) return;
    top.parentNode.insertBefore(banner, top);
    banner.setAttribute('data-lifted', '');
  }

  function init() {
    var marker = document.querySelector('[data-iconic-page]');
    var lang = (marker && marker.getAttribute('data-lang')) || 'en';
    initAccordions();
    initSizeGuide(lang);
    initCartArea();
    liftBanner();
    // The theme mounts the detail tab and the cart controls asynchronously,
    // so re-run the DOM-dependent bits once things settle.
    setTimeout(function () { liftBanner(); initAccordions(); }, 400);
    console.log('[iconic] ready · lang ' + lang +
      ' · banner ' + (document.querySelector('.iconic-series-banner') ? 'found' : 'MISSING') +
      ' · cart ' + (document.querySelector('.secondary_btn.product-cart') ? 'found' : 'MISSING'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
