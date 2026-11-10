# Incident 10 Nov 2026 — US brief form dead ("Next step" did nothing) for 4 days

**Window:** 6 Nov 2026 19:01 UTC → 10 Nov 2026 07:47 UTC (~84 h). **Store:** us.momuto.com only.
**Page:** `/pages/request-custom-kit-design` (the €15/$15 deposit gate + the 3-step brief form).
**Impact:** a customer who paid the $15 deposit landed on the form (`?paid=true`), filled in step 1 and could not
go further: no Style step (badge, colours, style) and no Submit. Reported by a paying customer by email on 9 Nov
("I can fill in all preliminary information but there is no way to add colors, style, or submit").
EN, ES, FR and IT were NOT affected (probe: all completed the form before the fix).

## What happened

1. The request pages are **templates**. Their source (`pages/request-custom-kit-design`, `pages/us/request-custom-kit-design`,
   the ES/FR/IT twins) holds two markers, `<!-- inject:design-request.css -->` and `<!-- inject:design-request.js -->`.
   Their own deployers (`deploy-request-design-page.js` for EN/ES/FR/IT, `deploy-us-pages.js` for US) paste
   `shared/design-request.css` and `shared/design-request.js` (the step logic: NEXT, BACK, the colour picker, validation) into those markers.
2. A bulk "Pull CMS Content" had also left a **copy** of the US page in `cms/pages/us/request-custom-kit-design.json`,
   and that copy held the raw markers, not the script.
3. On 6 Nov a copy edit (PR #393, hero line) changed that **copy** instead of the source `pages/us/request-custom-kit-design`.
4. On merge, **Deploy CMS Page** (`deploy-cms-page.js`, run 42275987121) deployed every changed `cms/pages/**/*.json`. It does not
   inject anything, so it pushed the template raw. The markers are HTML comments, so the page *looked* normal: only the buttons
   did nothing. The run was green.
5. Nothing checked the form itself after the deploy. The only signal was the customer's email.

Side effect of the same deploy: the copy was a stale 3 Sep snapshot, so the page also went back from "15+ countries" to "10+".

## Root cause, in one line

**Two files claimed to be the same page, and the wrong one was edited and deployed by a deployer that cannot build it.**
A green deploy was taken as proof the page worked; no check exercised the form.

## Fix (PR #402, 10 Nov)

- The hero line now lives in the source `pages/us/request-custom-kit-design`. Deploy US Pages (run 42777794424) redeployed it with the script injected.
- Verified live: **Probe request form (all stores)** run 42777830732 → **10/10** store×viewport walks complete the form
  (details → NEXT → badge + colour + style → CONTINUE → terms → SUBMIT; the submit is intercepted, nothing is sent).

## How it cannot happen again (four layers)

| Layer | What | Where |
|---|---|---|
| 1. One source per page | The template copy `cms/pages/us/request-custom-kit-design.json` is deleted | repo |
| 2. PR check (before merge) | `scripts/check-page-sources.js` in the *Check copy rules* PR workflow fails a PR that **edits a `cms/pages/<loc>/<handle>.json` copy when a source `pages/<handle>` / `pages/us/<handle>` exists**, and fails if any `cms/pages` copy holds inject markers. Shadow copies today: EN contact, ES contacto, IT contattaci, US ai-concept-to-real-kit, custom-basketball-jerseys, ready-to-play. | `.github/workflows/check-copy-rules.yml` |
| 3. Deploy guard (at merge) | `deploy-cms-page.js` refuses content with `<!-- inject:… -->` markers and fails the run | `scripts/deploy-cms-page.js` |
| 4. Live probe (after deploy) | `scripts/probe-request-form.js` walks the paid form on all 5 stores, desktop + mobile, after every Deploy US Pages / Deploy CMS Page / Deploy Request Design Pages run, and on demand. A red run = the form is broken somewhere. | `.github/workflows/probe-request-form.yml` |

## Rules for whoever edits pages next (human or agent)

- **Edit the source, never the copy.** If `pages/<handle>` (or `pages/us/<handle>`) exists, that file is the page. `cms/pages/*/<handle>.json`
  is only a pulled snapshot. The PR check now enforces this.
- **Green deploy ≠ working page.** For the request pages, "done" is a green *Probe request form* run (docs/verification-map.md).
- **Paid flows get a probe.** Any page where a customer has already paid and must then act (brief form, account, cart) needs an automated walk, not an eyeball.

## Customer follow-up

- The customer who reported it (US, deposit 9 Nov): told the form is fixed and that a reply to the email with the details also works.
- **Owner:** check Stripe (US payment link) for other $15 deposits paid between 6 Nov 19:00 UTC and 10 Nov 08:00 UTC with no brief
  received, and send each one the same note (tracked in `docs/open-items.md`).
