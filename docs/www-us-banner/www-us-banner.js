/* MOMUTO — www.momuto.com script-manager entry, two jobs (3 Nov 2026, docs/seo-targets-2026-11.md T1 / "found on the way"):
 *  1. H1 DEMOTION (every store page): the theme prints the CMS title as <h1 class="title"> above every page fragment
 *     (.page_detail_default > h1.title) and above every blog post (.blog_detail_default .plugin-container-header h1.title),
 *     so each page carries TWO h1s. The element is swapped for a <div> with the same class and text — the title-hide CSS keeps
 *     applying, nothing visible changes, and the rendered DOM has one h1 (ours). Probe runs 41618821013 / 41617219868 are the source.
 *  2. US BANNER (www only, never a redirect — owner ruling in docs/us-launch-status.md): a dismissible bar above the header for
 *     visitors whose browser says en-US + an America/* time zone: "Shopping from the US?" with a link to the same path on us.momuto.com.
 *     Dismissed = 30 days in localStorage. No cookie, no beacon, no personal data. ?nobanner hides it for a test; ?usbanner forces it.
 * Idempotent; safe to paste twice. Text is textContent only. To undo: disable or delete the entry. README: docs/www-us-banner/README.md */
(function () {
  if (window.__moWwwEntry_) return;
  window.__moWwwEntry_ = true;
  var VERSION = 'v1';

  function demoteTitles() {
    var list = document.querySelectorAll('.page_detail_default > h1.title, .blog_detail_default .plugin-container-header h1.title');
    for (var i = 0; i < list.length; i++) {
      var h = list[i], d = document.createElement('div');
      d.className = h.className; d.setAttribute('data-mo-demoted', 'h1');
      while (h.firstChild) d.appendChild(h.firstChild);
      h.parentNode.replaceChild(d, h);
    }
  }

  function wantsBanner() {
    if (location.hostname !== 'www.momuto.com') return false;
    var q = location.search || '';
    if (/[?&]nobanner\b/.test(q)) return false;
    if (/[?&]usbanner\b/.test(q)) return true;
    try { var until = +localStorage.getItem('mo_us_banner_off') || 0; if (until > Date.now()) return false; } catch (e) {}
    var lang = (navigator.language || '').toLowerCase();
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return lang === 'en-us' && /^America\//.test(tz) && !/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Mexico_City|Sao_Paulo|Buenos_Aires|Bogota|Lima|Santiago|Caracas)/.test(tz);
  }

  function usUrl() {
    var p = location.pathname || '/';
    var keep = p === '/' || /^\/pages\/[a-z0-9-]+\/?$/.test(p) || /^\/blogs\/[a-z0-9-]+\/?$/.test(p);
    return 'https://us.momuto.com' + (keep ? p : '/') + '?from=www-banner';
  }

  function banner() {
    if (document.getElementById('mo-us-banner')) return;
    if (!wantsBanner()) return;
    var bar = document.createElement('div'); bar.id = 'mo-us-banner'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'US store');
    var inner = document.createElement('div'); inner.className = 'mo-in';
    var txt = document.createElement('p'); txt.className = 'mo-txt';
    var b = document.createElement('b'); b.textContent = 'Shopping from the US?';
    txt.appendChild(b); txt.appendChild(document.createTextNode(' Prices in USD and US delivery on our US store.'));
    var go = document.createElement('a'); go.className = 'mo-go'; go.href = usUrl(); go.textContent = 'Go to us.momuto.com →';
    var x = document.createElement('button'); x.className = 'mo-x'; x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
    x.addEventListener('click', function () {
      try { localStorage.setItem('mo_us_banner_off', String(Date.now() + 30 * 86400000)); } catch (e) {}
      bar.parentNode && bar.parentNode.removeChild(bar);
    });
    inner.appendChild(txt); inner.appendChild(go); inner.appendChild(x); bar.appendChild(inner);
    document.body.insertBefore(bar, document.body.firstChild);
    bar.className = 'mo-on';
    bar.setAttribute('data-mo-version', VERSION);
  }

  function run() { demoteTitles(); banner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // the theme can re-render page sections after load; demote again once, late
  window.addEventListener('load', function () { setTimeout(demoteTitles, 800); });
})();
