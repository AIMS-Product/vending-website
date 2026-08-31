# Technical SEO + Sitemap Audit — vendingpreneurs.com (2026-08-31)

## Summary

Site-wide soft-404: every nonexistent URL returns HTTP 200 (not 404) because a root
`loading.tsx` forces streaming SSR, which flushes the 200 status before `notFound()`
runs — this is documented, expected Next.js streaming behavior, triggered by an
app-level file choice. `/sitemap.xml` intermittently resolves to the wrong route
(`[legacyLeadPath]` instead of the static metadata route) under production traffic —
a real routing race, not a config error; robots.txt and the sitemap's own content
are otherwise correct. Indexability holdbacks (`/process`, 7 of 8 `/solutions/*`,
all `/booking-*` funnel pages) are deliberate, complete, and correctly wired end to
end. No apex→www redirect exists at the domain layer (mitigated by correct
self-canonicals).

## Findings

### 1. [Critical] Site-wide soft-404: every 404 returns HTTP 200

**Evidence:**

```
$ curl -sD - -o /dev/null https://www.vendingpreneurs.com/zzz-does-not-exist-12345
HTTP/2 200
x-matched-path: /[legacyLeadPath]
```

Body renders the real not-found UI (`<h1>Page not found</h1>`) and
`<meta name="robots" content="noindex"/>`, but the transport-level status is `200`,
not `404`. This is true for **every** unmatched URL on the site (any path that falls
through to `[legacyLeadPath]`), because that route is the app's terminal catch-all
for single-segment paths.

**Root cause:** `src/app/loading.tsx:1-23` is a **root-level** `loading.tsx`. Per
Next.js's own file-convention docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`,
"Status Codes" section): _"When streaming, a `200` status code will be returned...
Because the response headers have already been sent to the client, the status code
of the response cannot be updated."_ A root `loading.js` wraps `page.js` (and any
`not-found.js`) in a `<Suspense>` boundary for **every route in the app**, so the
200 shell is flushed to the client before `src/app/[legacyLeadPath]/page.tsx:52`'s
`notFound()` call ever executes. The `noindex` meta tag is Next's own mitigation for
exactly this case, but the HTTP status itself cannot be recovered once streaming has
started — this is identical in kind to the streaming-redirect caveat already
documented in `src/proxy.ts:74-81` for `permanentRedirect()`.

This also explains why `robots: { index: false, follow: false }` in
`generateMetadata` (page.tsx:38) renders correctly as a meta tag but the response
code doesn't follow it, and it's the same reason `/sitemap.xml` (finding #2) served
a 200 HTML page when it briefly mis-routed — it hit this exact code path.

**Fix:** Per the Next.js docs' own recommendation: _"To return a real 404 status,
the resource has to be checked before the response body streams... run that check
in `proxy` instead."_ Two options, in order of effort:

- Move the `legacyLeadRoutes` existence check into `src/proxy.ts` (it already has a
  `notFoundResponse()` helper returning a real `404` — see proxy.ts:41-49) so
  unknown single-segment paths get a real 404 before Next ever streams.
- Or scope `loading.tsx` down from the app root to only the route segments that
  actually want a loading skeleton (e.g. move it into `src/app/(marketing)/...`
  wrapping only pages with real async data fetches), removing the blanket root
  Suspense boundary that this soft-404 depends on.
  The proxy fix is smaller (`[legacyLeadPath]`'s route list is already static data via
  `legacyLeadRoutes`) and matches the pattern the codebase already uses for
  `REMOVED_PUBLIC_PATHS` (proxy.ts:51,158-160).

**Impact:** Google and other engines generally still treat 200+noindex "soft 404s"
as suspect signals across a whole domain when they're this systemic (not one-off);
Search Console's Page Indexing report will flag these as "Soft 404" rather than
excluding them cleanly, and any scraper/monitoring tooling relying on real status
codes for link-rot checks is blind to broken links across the entire site.

---

### 2. [High] `/sitemap.xml` intermittently mis-routes to `[legacyLeadPath]` (returns HTML, not XML)

**Evidence:** First request in this audit:

```
$ curl -sD - https://www.vendingpreneurs.com/sitemap.xml
HTTP/2 200
content-type: text/html; charset=utf-8
x-matched-path: /[legacyLeadPath]
cache-control: public, max-age=0, must-revalidate
age: 0
x-vercel-cache: MISS
```

25 immediately-following requests (serial and 15-way concurrent, cache-busted and
bare) all resolved correctly:

```
content-type: application/xml
x-matched-path: /sitemap.xml
x-vercel-cache: MISS
```

`age: 0` / `MISS` on both the good and bad response rules out stale CDN cache as the
cause — this was a live origin routing decision, not a cache-serving artifact.

**Root cause:** Two registered Next.js routes both match the path `/sitemap.xml`:

- `src/app/sitemap.ts` → static metadata route `/sitemap.xml`
  (`.next/routes-manifest.json` staticRoutes: `regex: "^/sitemap\\.xml(?:/)?$"`)
- `src/app/[legacyLeadPath]/page.tsx` → dynamic catch-all
  (`.next/routes-manifest.json` dynamicRoutes: `regex: "^/([^/]+?)(?:/)?$"`, which
  matches any single path segment including one containing a dot, e.g.
  `sitemap.xml`)

Static/file-convention routes are supposed to always win over a same-shape dynamic
segment, and 25/26 requests confirm that's the normal outcome. The one wrong
resolution is a genuine (rare) route-precedence race at request-routing time — most
plausibly in how the Vercel/Next build output map disambiguates a static
`.xml`-suffixed metadata route from a single-segment dynamic catch-all under load,
rather than a config mistake in this repo. When it does mis-route, the request lands
in `[legacyLeadPath]/page.tsx`, `getLegacyLeadRoute("sitemap.xml")` returns
`undefined`, `notFound()` fires (page.tsx:52), and finding #1's streaming bug turns
that into the 200-status HTML shell seen in the seed report — i.e. **finding #1 is
also why this failure mode looks like "sitemap.xml returns 200 HTML" instead of a
clean 404 when it happens.**

**Fix:** Cannot be fully fixed in application code (it's a build-output routing
resolution race), but two mitigations reduce/eliminate exposure:

1. Fixing finding #1 removes the visible symptom (a mis-route would 404 cleanly
   instead of serving a fake sitemap page to a crawler).
2. Add an explicit proxy-level short-circuit for `/sitemap.xml` and `/robots.txt`
   (`NextResponse.next()` immediately, before any dynamic matching) — the current
   proxy matcher's catch-all (`proxy.ts:359`) already excludes both via the
   `.*\\.` dot exclusion, so they don't currently pass through proxy at all; that's
   correct and not the cause, but it does mean proxy can't currently intervene if
   Next's own router resolves them wrong. Given this is intermittent at low
   frequency, recommend filing a Vercel support ticket / Next.js issue with this
   reproduction rather than a code change, and adding an uptime-style
   `content-type: application/xml` check on `/sitemap.xml` to CI or a monitor so a
   silent regression before the next Search Console recrawl is caught.

**Live sitemap content itself is correct** — 40 URLs, valid XML, `<lastmod>` real
timestamps (not boilerplate/identical), no `priority`/`changefreq` misuse beyond
Google's documented "ignored, harmless" tags (`sitemap.ts:26-27` sets both), all
`<loc>` entries returned 200 on spot-check (case-studies, solutions/vendscout,
resources pages, news articles).

---

### 3. [Medium] No apex → www redirect at the domain layer

**Evidence:**

```
$ curl -s -o /dev/null -w "%{http_code}" https://vendingpreneurs.com/
200   (x-matched-path: /)
$ curl -s -o /dev/null -w "%{http_code}" https://www.vendingpreneurs.com/
200
```

Both hosts serve full 200 content with no redirect between them (http→https 308
redirects work correctly on both hosts individually — see finding evidence below).
Every page checked self-canonicalizes to `https://www.vendingpreneurs.com/...`
regardless of which host served it (confirmed on `/` and `/about` from the apex
host), so this is a real duplicate-content surface but a mitigated one — Google
should consolidate via the `rel=canonical` signal rather than indexing both hosts.

**Root cause:** This is DNS/Vercel-project domain configuration
(`AGENTS.md`: "apex + www A records at `76.76.21.21`"), not application code — there
is no redirect rule for this in `next.config.ts` or `vercel.json`, and there
shouldn't be (a `next.config.ts` `redirects()` rule can't fire before Next resolves
which domain served the request in a way that's cheaper than what Vercel's
project-level "Redirect to" domain setting already does for free).

**Fix:** In the Vercel project's Domains settings, set the apex domain
(`vendingpreneurs.com`) to redirect to `www.vendingpreneurs.com` (or vice versa,
whichever is the intended canonical host — the codebase's own canonical tags already
say `www` is canonical). This is a dashboard change, not a PR.

---

### 4. [Low / Informational] Indexability holdbacks are deliberate and correctly implemented — not a bug

Confirmed as intentional (matches commit `56997b0`'s "hold the new pages back from
search until the copy is signed off"), and wired consistently across every layer:

- `/process` and all 7 `/process/[slug]` steps: `noindex: true` on every step
  (`src/lib/content/process.ts:34,134,247,347,449,568,680`) →
  `processSectionIsHeldBack` (process.ts:808-810) derives `true` from that →
  `sitemap.ts:51-60` excludes `/process` from the sitemap →
  `listIndexableProcessSlugs()` (process.ts:799-801) also empty → confirmed live,
  `/process` returns `<meta name="robots" content="noindex, follow"/>`.
- `/solutions/*`: 7 of 8 solutions (`marketplace`, `equipment`,
  `national-contracts`, `coaching`, `partners`, `financing`, `support` —
  `src/lib/content/solutions.ts:159,284,400,509,615,721,830`) are `noindex: true`;
  only `vendscout` is indexable. `listIndexableSolutionSlugs()`
  (solutions.ts:935-937) correctly feeds only `vendscout` into `sitemap.ts:42-47`.
  Confirmed live: all 7 held-back pages serve `noindex, follow` with correct
  self-canonicals; `vendscout` has no robots meta (indexable) and is the only
  solution in the live sitemap.
- All `/booking-*` funnel pages (`booking-youtube`, `booking-t5-socials`,
  `booking-meta`, `booking-ak-t5`, `booking-b5-socials`, `booking-ak-b5`) and
  `/book-now`: confirmed live `noindex, nofollow` with `canonical` pointing to
  `/contact`, consistent across every one checked.
- No accidental holdback found: nothing in `staticRoutes`
  (`src/lib/content/site-routes.ts:12-22`) is noindexed, and nothing indexable is
  missing from the sitemap (spot-checked news, case-studies, resources, solutions).

No action needed. Flagging only so this doesn't get miscategorized as a gap in a
future audit.

---

### 5. [Low] CSP is report-only site-wide (by design, not yet promoted)

**Evidence:** Every response carries `Content-Security-Policy-Report-Only` and no
enforcing `Content-Security-Policy` header
(`src/lib/security-headers.ts:13-20`, applied via `next.config.ts:49-56`). HSTS is
present and reasonably strong (`max-age=63072000; includeSubDomains`,
`security-headers.ts:40-43`) but not preloaded — also a deliberate, documented
choice (security-headers.ts:10-11: "submitting to the preload list is effectively
irreversible and is a domain-owner decision, not a code one"). `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` are all present
and correctly scoped.

**Not a bug** — `content-security-policy.ts`'s own comments say an enforcing policy
"cannot be written from source alone" and this is staged intentionally behind
`/api/csp-report` violation collection. Noting only as a maturity item: promoting
CSP from report-only to enforcing is a meaningful hardening step once report data is
clean, and HSTS preload submission is a low-effort follow-up once the team is ready
to commit irreversibly.

---

### 6. [Informational] Redirects checked — no chains, no unexpected hops

- `/apply` → `/contact` : single 301/308 hop (`next.config.ts:76-80`).
- `/booking-website`, `/booking-organicmisc`, and the other 8
  `legacyLeadRedirects` (`next.config.ts:5-46`) → single hop to `/contact` with
  `source_path` query param preserved.
- `/business`, `/about-us`, `/privacy-policy`, 3 retired `/news/*` slugs: single
  301 hop each (`next.config.ts:65-97`).
- `http://` → `https://` : single 308 hop on both apex and `www`.
- Trailing slash (`/about/` → `/about`): single 308 hop, consistent direction
  (strips trailing slash), no conflicting rule found.
- No 3+ hop chains found in any path checked.

## Robots.txt

Live and correct:

```
User-Agent: *
Allow: /
Disallow: /admin/

Host: https://www.vendingpreneurs.com
Sitemap: https://www.vendingpreneurs.com/sitemap.xml
```

Matches `src/app/robots.ts:4-14` exactly. `/admin/` is correctly the only
disallowed path (auth-gated in `src/proxy.ts` regardless, so this is defense in
depth, not the only gate).
