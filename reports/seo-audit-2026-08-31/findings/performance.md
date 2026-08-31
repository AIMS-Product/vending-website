# Performance Audit — vendingpreneurs.com — 2026-08-31

## Method note (read this first)

PageSpeed Insights was unreachable for the entire run: every call returned
`PSI rate limit exceeded (240 QPM / 25,000 QPD)`, including retries spaced
several minutes apart with other work in between. This audit runs multiple
specialist agents in parallel against the same keyless PSI quota, which is
almost certainly what exhausted it. `crux_history.py` / `lcp_subparts.py`
additionally require a configured `GOOGLE_API_KEY`, which is not set in this
environment (`Error: API key required`).

**No Lighthouse score, LCP/INP/CLS lab or field number in this report is a
PSI/CrUX number.** Per the task's fallback instruction, everything below was
derived from: production HTML payloads (curl, real byte counts, `Accept-Encoding:
gzip, br, zstd` to get realistic wire sizes), HTTP response headers, and the
repo source. `preload_check.py` (a local static analyzer, no API dependency)
did run successfully and its output is included. Treat this report as a
resource-weight / implementation audit, not a substitute for a live Lighthouse
run — re-run PSI standalone (not inside the parallel audit) once quota resets.

Pages tested: `/` (home), `/apply` (301 → `/contact`, tested `/contact`),
`/book-now`, `/news/best-vending-locations` (article).

---

## Finding 1 — SEVERITY: CRITICAL — ~400KB of third-party JS fires on every page, all in the same `afterInteractive` burst

`src/components/tracking/TrackingScripts.tsx`, mounted once in
`src/app/layout.tsx:65`, so it renders on **every route**. All six of its
primary tags use `strategy="afterInteractive"` (lines 44, 62, 86, 96, 103,
110, 117, 124) — Next.js schedules all of them to execute together right
after hydration, not staggered. Real wire sizes (production, browser-realistic
`Accept-Encoding`):

| Script                                                | Wire size                                                                                     | Strategy             | Line                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- | ----------------------- |
| `googletagmanager.com/gtm.js` (GTM-57QRC275)          | 157.6 KB (br)                                                                                 | afterInteractive     | TrackingScripts.tsx:48  |
| `connect.facebook.net/en_US/fbevents.js` (Meta Pixel) | 105.0 KB (gzip)                                                                               | afterInteractive     | TrackingScripts.tsx:70  |
| `t.rightmessage.com/46855491.js`                      | 102.7 KB (br)                                                                                 | afterInteractive     | TrackingScripts.tsx:127 |
| `fast.vidalytics.com/js/global.min.js`                | 17.5 KB (gzip)                                                                                | afterInteractive     | TrackingScripts.tsx:119 |
| `cdn.idpixel.app/…min.js`                             | 7.3 KB (gzip)                                                                                 | afterInteractive     | TrackingScripts.tsx:105 |
| `js.hs-scripts.com/48512363.js` (HubSpot loader stub) | 0.7 KB (gzip)                                                                                 | afterInteractive     | TrackingScripts.tsx:112 |
| `cm.vendingpreneurs.ai/e00dc3b0.js` (ClickMagick)     | unverifiable — returns HTTP 403 to curl (referrer/bot-gated, likely fine from a real browser) | afterInteractive     | TrackingScripts.tsx:98  |
| `widget.manychat.com/…js`                             | 0.4 KB stub                                                                                   | lazyOnload (correct) | TrackingScripts.tsx:138 |
| `mccdn.me/…widget.js`                                 | —                                                                                             | lazyOnload (correct) | TrackingScripts.tsx:143 |
| `wisepops.net/…loader.js`                             | —                                                                                             | lazyOnload (correct) | TrackingScripts.tsx:149 |

Sum of the `afterInteractive` group ≈ **390 KB of JS parsed/executed in one
burst immediately after every page becomes interactive**, on every route
including thin marketing and article pages that don't need most of it. This
is a direct INP risk on mid/low-end mobile (Vendingpreneurs' audience is
likely majority-mobile). ManyChat/Wisepops are already correctly deferred to
`lazyOnload` — the rest are not.

**Recommendation:** keep GTM and the Meta Pixel (both are needed site-wide for
attribution) on `afterInteractive`, but move RightMessage and the HubSpot
loader to `lazyOnload` (personalization popups and forms are not
interaction-blocking-critical the instant the page loads), and gate Vidalytics
behind actual usage (see Finding 2). Expected impact: cuts the immediate
post-hydration JS burst roughly in half (~390KB → ~185KB: GTM + Pixel only).

---

## Finding 2 — SEVERITY: HIGH — Vidalytics player script loads site-wide but is currently unused anywhere

`TrackingScripts.tsx:116-121` loads `fast.vidalytics.com/js/global.min.js`
(17.5 KB) on every single page. But `src/components/sections/PreCallResourcesPage.tsx:20-24`
says explicitly:

> "VSL SWAP: the video band is the shared ApplyVsl frame pointed at Mike's
> YouTube VSL. When Alysia hands over the Vidalytics embed, replace this one
> `<ApplyVsl>` with the Vidalytics div + its per-video script... the global
> player script already loads site-wide from TrackingScripts."

Confirmed against production HTML: `/contact` and `/book-now` (the VSL pages)
render an `i.ytimg.com` YouTube-thumbnail click-to-play facade
(`ApplyVsl`), not a Vidalytics embed. So this is a script loaded and executed
on every page of the site for a video player that has zero current callers.
Pure dead weight until the Vidalytics embed actually ships.

**Recommendation:** remove the Vidalytics `<Script>` from `TrackingScripts.tsx`
now and add it back (scoped to `/contact` + `/book-now` only, not site-wide)
in the same change that wires the real Vidalytics embed.

---

## Finding 3 — SEVERITY: HIGH — Next.js auto-preloads 4 third-party scripts, competing with the real LCP resource

`preload_check.py` confirms `fetchpriority_high: 2` and 7-9 `<link rel=preload>`
hints per page. Inspecting the actual `<head>` on all four pages shows Next.js
(because these `<Script>` tags carry a `src` under `afterInteractive`) emits:

```
<link rel="preload" href="https://cm.vendingpreneurs.ai/e00dc3b0.js" as="script"/>
<link rel="preload" href="https://cdn.idpixel.app/v1/idp-analytics-....min.js" as="script"/>
<link rel="preload" href="https://js.hs-scripts.com/48512363.js" as="script"/>
<link rel="preload" href="https://fast.vidalytics.com/js/global.min.js" as="script"/>
```

These sit in `<head>` alongside the two font preloads and the hero-image
preload, all fighting for the browser's limited early-connection/priority
slots on every page load — on a page where the real LCP element is the hero
image or the YouTube facade thumbnail, not any of these four scripts. One of
the four (Vidalytics) is dead code per Finding 2.

**Recommendation:** switching RightMessage/HubSpot/Vidalytics to
`lazyOnload` (Finding 1) also removes their auto-preload, which directly
fixes this. No separate code change needed beyond Finding 1's fix.

---

## Finding 4 — SEVERITY: MEDIUM — In-article body images bypass next/image entirely

Verified on `/news/best-vending-locations`: the cover image correctly uses
`next/image` with `priority` (`src/components/sections/NewsArticle.tsx:62-68`),
gets a proper AVIF-capable responsive `srcset`, and is preloaded. But the
**body content** (rendered via `dangerouslySetInnerHTML` at
`NewsArticle.tsx:75`, built by `src/lib/markdown.ts` from raw markdown) emits
plain `<img>` tags straight from the CMS content — no `next/image`, per
`.claude/rules/components.md`'s own "never `<img>`" rule:

```html
<img src="https://aacisvhkmsaabqdvdmmf.supabase.co/.../restock.jpg" alt="..." />
<img
  src="https://aacisvhkmsaabqdvdmmf.supabase.co/.../micromarket.jpg"
  alt="..."
/>
<img src="https://aacisvhkmsaabqdvdmmf.supabase.co/.../tap.jpg" alt="..." />
```

Confirmed sizes: `restock.jpg` = 351.6 KB raw JPEG (no resize, no AVIF/WebP,
no `width`/`height` attributes → CLS risk as each image pops in at its
natural size). This one article carries 3 such images; at ~350KB each that's
roughly **1 MB of unoptimized image weight** the reader downloads regardless
of viewport, versus what a `next/image` pass (AVIF, responsive `w=`, correct
display size) would cost.

**Recommendation:** run the markdown→HTML pipeline (`src/lib/markdown.ts`)
through a rehype plugin that rewrites `<img src>` to `/_next/image?url=...`
equivalents, or intercept image nodes before `rehype-stringify` and replace
with server-rendered `next/image` output. This affects every article, not
just the one sampled — check `src/lib/markdown.ts` and any other post with
inline images.

---

## Finding 5 — SEVERITY: MEDIUM — /contact and /book-now are bfcache-disqualified

`preload_check.py` flagged both pages (score 50/100 vs. 75/100 for home and
article) for:

```
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
```

confirmed via `curl -I` against production. Root cause: both routes read
`searchParams` for attribution (`buildLeadAttribution`, `book-now/page.tsx:26-30`)
and call `randomUUID()` per request, which forces Next.js into fully dynamic
(uncached) rendering — the default `Cache-Control` for a dynamic response is
`no-store`. That's defensible for correctness (each visit needs fresh
attribution/idempotency data), but it also means the browser can never
restore these pages from bfcache. These are the two highest-intent
conversion pages on the site — a visitor who taps back after checking
something else gets a full reload + re-hydration instead of an instant
bfcache restore.

**Recommendation:** if the attribution/idempotency data can be computed
client-side (e.g., in a small client island) instead of forcing the whole
route dynamic, the rest of the page could ship with a cacheable
`Cache-Control`. If not feasible without a larger refactor, at minimum
confirm this is an accepted tradeoff — don't let it regress further pages
that don't need per-request dynamism.

---

## Finding 6 — SEVERITY: LOW — No Speculation Rules API anywhere

`preload_check.py` on all four URLs: `speculation_rules.inline_blocks: 0`,
`header_present: false`. No `<script type="speculationrules">` and no
`Speculation-Rules` response header on any tested page. Adding
prerender/prefetch rules for the top navigation paths (home → /contact,
article → article, home → /book-now) would eliminate next-navigation paint
cost for those flows. Standard-severity opportunity, not a regression.

---

## What's already solid (no action needed)

- Homepage/article hero images: `next/image`, AVIF, `priority` +
  `fetchPriority="high"`, full responsive `srcSet`, properly preloaded —
  textbook LCP handling.
- `/contact` / `/book-now` hero uses an `i.ytimg.com` YouTube-thumbnail
  click-to-play facade via `next/image`, not an eagerly-loaded video embed —
  good pattern, avoids loading a real player until the user opts in.
- Fonts are self-hosted via `next/font`, only 2 woff2 files (48.4 KB + 12.0
  KB), both preloaded, no external font-CSS round trip.
- The one shared global CSS chunk (`0p6~si~thya2x.css`) is 142.6 KB
  uncompressed but only **22.85 KB over the wire** (br) — fine, not a
  render-blocking concern despite the large raw number.
- DOM size ~791 elements on the homepage — well under the 1,500-element
  Lighthouse flag threshold.
- No client-side Sentry SDK: only `src/sentry.server.config.ts` and
  `src/sentry.edge.config.ts` exist, no `sentry.client.config.ts` — Sentry
  adds zero client bundle weight here.
- `package.json` dependency list is lean. The markdown/rehype/remark/unified
  stack (`src/lib/markdown.ts`) is confirmed server-only (no `"use client"`
  in that file or its importers) — it never reaches the client bundle.
  No heavyweight client-side libraries (chart/animation/UI-kit bloat) found.

---

## Files referenced

- `/Users/adamwolfe/vending-website/src/components/tracking/TrackingScripts.tsx`
- `/Users/adamwolfe/vending-website/src/app/layout.tsx`
- `/Users/adamwolfe/vending-website/src/components/sections/PreCallResourcesPage.tsx`
- `/Users/adamwolfe/vending-website/src/components/sections/NewsArticle.tsx`
- `/Users/adamwolfe/vending-website/src/lib/markdown.ts`
- `/Users/adamwolfe/vending-website/src/app/book-now/page.tsx`
- `/Users/adamwolfe/vending-website/src/app/contact/page.tsx`
- `/Users/adamwolfe/vending-website/next.config.ts` (`/apply` → `/contact` 301)
- `/Users/adamwolfe/vending-website/package.json`
