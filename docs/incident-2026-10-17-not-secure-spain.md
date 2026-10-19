# 17 Oct 2026 — "Not secure" / `ERR_CERT_AUTHORITY_INVALID` on the stores, seen from Spain

**Verdict: not a site fault. It is the Spanish ISP block of Cloudflare IPs during LaLiga match windows.** Nothing to fix in the
code, Cloudflare or the stores. Written down so the next session does not repeat the hunt.

## What the owner saw (Sat 17 Oct, ~20:15 Madrid)
- Chrome on `www.momuto.com` and `es.momuto.com` (also fr, us): red "Not secure" pill, popup "Your connection to this site is not
  secure … Certificate is valid", on EVERY page, "suddenly".
- With the VPN OFF: full-page `NET::ERR_CERT_AUTHORITY_INVALID` ("Your connection is not private") on `www.momuto.com/pages/about`.
- `design.momuto.com` (DNS-only, NOT behind Cloudflare, A 198.11.178.106) looked normal with the lock. `discord.com` (other
  Cloudflare IPs) opened fine. The owner can only load the stores from Spain with a VPN on match days.

## Evidence that it is not us
| Check | Result |
|---|---|
| `whynopadlock.com` on `https://www.momuto.com/` (from the US, 14:24 ET) | SSL Pass: Let's Encrypt, issued 2026-08-23, expires 2026-11-21 (35 days; Cloudflare renews it), matches `www.momuto.com`, HTTPS forced, **no mixed content** |
| DevTools console on `es.momuto.com` | no "Mixed Content" line anywhere |
| Cloudflare SSL/TLS (owner screenshot) | encryption mode **Full (strict)**, running; "all activated" |
| Repo audit (`public/`, `static/`, `pages/`, `cms/pages/`) | no real `http://` URL; only SVG XML namespaces (`inkscape.org`, `w3.org`) that are never fetched |
| Deploy Static Files runs of 17 Oct (11:52, 11:56, 11:58 UTC = 13:52/13:56/13:58 Madrid) | all five domains ✓, no errors; the only static changes were `llms.txt` x2, `pricing.js`, `custom-content.js` |
| Our WhatsApp work | `wa-chat.js` loads only on the 3D tool and the cart, never on store pages; its fetches go to `https://momuto-api.vercel.app` |

Why the ISP explanation fits: an invalid certificate from the user's side while an external checker sees a valid one means someone
on the path presents a different certificate. That is what an ISP block device does on a blocked IP. It is also why the unproxied
`design.momuto.com` (a non-blocked IP) is fine while the Cloudflare-proxied stores are not, and why it starts "suddenly" and for all
pages/stores at once (it is the IP, not the page), and why the timing is a match window.

## Background (sources)
- Since Feb 2025 Spanish ISPs block **IP addresses** (many of them Cloudflare's, shared by thousands of sites) during LaLiga match
  windows under court "dynamic injunctions"; Telefónica is among the most consistent. OONI measured 7,441 blocked IPs across 36+
  providers, mostly confined to match windows, and reported **TLS man-in-the-middle interference on Digi Mobil**.
  https://ooni.org/post/2026-laliga-collateral , https://bandaancha.eu/bloqueos-futbol ,
  https://www.genbeta.com/actualidad/tebas-dice-que-bloqueos-afectan-a-cuatro-gatos-este-fin-semana-tiraron-chatgpt-unicas-quejas-vienen-frikis
- Cloudflare's appeal was rejected (Mar 2025); blocks continue.
- NOT sourced: that the block shows as `ERR_CERT_AUTHORITY_INVALID` on every ISP (the owner's own screenshot shows it on theirs), and
  why the VPN-on session still showed the "Not secure" pill (unexplained; the VPN route evidently still touches the interfered path).

## Side finding (not the cause, not fixed)
The `es.momuto.com` home page logs `Uncaught SyntaxError: Identifier 'targetUrl' has already been declared` (inline scripts at
index lines ~2215 and ~2494) and `Invalid or unexpected token` (~2963). `targetUrl` is **not in this repo or design-momuto**, so it
comes from the platform theme or a pasted block (homepage blocks are pasted into the theme by the owner, `docs/store-theme-css.md`).
The second inline script does not run. `ERR_BLOCKED_BY_CLIENT` for HubSpot (`hscollectedforms.js`) and doubleclick in the same
console is the owner's ad blocker, not a site fault.

## Business impact and what to do
Spanish visitors on an affected ISP see this error page instead of the store during match windows (weekend afternoons/evenings,
Madrid time), on every Cloudflare-proxied store. Cheap, useful moves:
1. Do not buy Spanish traffic or send Spanish emails inside LaLiga windows (the click lands on an error page).
2. Measure it: compare Spain visits/orders in match windows vs other times (not done yet; offered, owner paused it).
3. WhatsApp, email and Instagram are not affected: keep them as the way to reach us.
4. Structural fixes (dedicated Cloudflare IPs/BYOIP) are paid and the store platform's CDN is Cloudflare: not recommended unless
   step 2 shows a large loss.

## Next time someone says "Not secure" / cert error on the stores
1. Is it Spain, on a weekend or a match day? Ask for the exact Chrome error code (`ERR_CERT_AUTHORITY_INVALID` = interception).
2. Run `whynopadlock.com` on the URL (an outside view of cert + mixed content) and open another site from the same browser.
3. Only if the outside view is bad: Cloudflare SSL/TLS mode (must stay Full strict), certificate expiry, then DevTools Console
   "Mixed Content" lines and Security tab. The sandbox cannot reach the stores (CLAUDE.md rule 2): never diagnose live pages from here.
4. Never click "Proceed" past the warning on a network that may be intercepting.
