# PostHog: the pre-submit behaviour layer, on every public page

**Date:** 2026-09-18 · **Repo:** `~/vending-website` · **Branch:** `feat/posthog-conversion-tracking`
(built in worktree `~/vending-website-posthog`) · **Status:** BUILT, verifying on preview.

## What PostHog owns, and what it does not

Our funnel was blind before the first form submit. No row is written anywhere until a
visitor accepts consent and submits stage 1, so someone who lands, scrolls, opens the
form, types a name and leaves was invisible. PostHog now covers exactly that stretch,
on every public page, and hands off at the first submit.

| PostHog owns (browser, pre-submit)                                                                                                             | Supabase / Close own (server, from first submit)                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$pageview`, `$pageleave` with scroll depth, autocaptured clicks, rage clicks, dead clicks, heatmaps, session replay                           | `lead_submissions` (lead counts), `qualification_sessions` (post-contact abandonment), `calendly_bookings`, `close_lead_funnel` (booked / showed / won / revenue), `channel_daily` |
| `form_viewed → form_started → form_field_completed → form_submit_attempted → form_submitted / form_submit_failed / form_abandoned`             | `resolveChannel()` is the only channel definition. PostHog carries the raw `utm_source`, never a channel name.                                                                     |
| `calendar_viewed`, `calendar_booked` (behaviour markers), `chat_opened`, `chat_started`, mirrored `landing_viewed` / `cta_clicked` / `popup_*` | `/admin/analytics` tabs stay the numbers the team quotes                                                                                                                           |

**Never quote PostHog `form_submitted` as a lead count** (ad blockers, consent, bots). Never
build a booked / won goal in PostHog. The seam is `vp_session_id`.

## The join key

Every PostHog event carries, stamped in `before_send` (`src/instrumentation-client.ts` →
`eventContext()` in `src/lib/tracking/event-context.ts`):

| Property                                                                                                  | Value                                                                                                                                                                                          | Matches                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp_session_id`                                                                                           | our first-party session (`vp_attr` localStorage / `vp_sid` cookie)                                                                                                                             | `lead_submissions.vp_session_id`, `lead_page_views.vp_session_id`                                                                                    |
| `source_path`                                                                                             | `?source_path=` (or `?source=`) if a redirect set one, else the page; both folded through `canonicalFunnelPath()` (query stripped, lowercased, trailing slash off, `FUNNEL_REDIRECTS` applied) | the funnel report's page key, byte for byte: the normaliser was extracted to `src/lib/analytics/canonical-path.ts` so both sides import one function |
| `page_group`                                                                                              | `funnel` / `post_conversion` / `lead_magnet` / `legacy_lead` / `content` / `admin`, driven by `BOOKING_FUNNEL_PATHS` and the legacy-route registry                                             | adding a funnel page to its registry adds it here                                                                                                    |
| `vp_utm_source` … `vp_utm_content`, `vp_paid_platform`, `vp_first_landing_path`, `vp_latest_landing_path` | the session's latest-touch attribution, what the lead row will carry                                                                                                                           | `lead_submissions.utm_*`                                                                                                                             |
| `utm_source`                                                                                              | PostHog's own per-visit value; only filled from the session when PostHog saw none                                                                                                              | raw, never a channel                                                                                                                                 |
| `environment`                                                                                             | `NEXT_PUBLIC_VERCEL_ENV` (`production` / `preview` / `development`)                                                                                                                            | filter previews out in PostHog                                                                                                                       |

The session is created **before** `posthog.init` (`refreshStoredSession()`, now exported
from `src/lib/attribution-client.ts` and shared with `AttributionSessionTracker`), so a
brand-new visitor's very first pageview already carries `vp_session_id`.

Nobody is identified. `person_profiles: 'identified_only'` and no `identify()` call:
visitors are anonymous in PostHog and join to our tables on the property, not on a
person. That keeps every pre-consent event pseudonymous and is the cheapest PostHog tier.

## What was built

| File                                                             | Change                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/instrumentation-client.ts`                                  | Sentry init (unchanged) + PostHog init: same-origin `api_host` `/api/ph`, `ui_host` us.posthog.com, `defaults: '2026-08-30'` (pageviews on history change, pageleave, scroll), dead clicks on, `before_send` stamping. Off without `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and on `/admin`.                                        |
| `next.config.ts`                                                 | `beforeFiles` rewrites `/api/ph/static/*`, `/api/ph/array/*` → us-assets.i.posthog.com, `/api/ph/*` → us.i.posthog.com. `skipTrailingSlashRedirect: true` (PostHog posts to `/e/`, `/s/`, `/flags/`).                                                                                                                          |
| `src/proxy.ts` + `src/lib/routing/trailing-slash.ts`             | The public-page trailing-slash 308 Next used to do, now in the proxy (which never runs on `/api/*`). Prod behaviour `/about/` → 308 `/about` is preserved.                                                                                                                                                                     |
| `src/lib/tracking/posthog.ts`                                    | `captureEvent()` (no-op when off / SSR / not loaded) and `SEND_NOW` (sendBeacon, skip queue) for events raced against unload.                                                                                                                                                                                                  |
| `src/lib/tracking/event-context.ts`                              | `pageGroupFor`, `sourcePathFor`, `eventContext` (pure, tested).                                                                                                                                                                                                                                                                |
| `src/lib/tracking/form-tracking.ts`                              | Pure form progress state, `abandonmentProperties`, resolved-form registry, `trackFormResult` (tested).                                                                                                                                                                                                                         |
| `src/components/tracking/FormTracker.tsx`                        | Mounted once in the root layout. Delegated `focusin` / `change` / `submit` listeners plus IntersectionObserver on every `form[data-form-step]`. Field **names only, never values**; hidden and bookkeeping inputs skipped. `form_abandoned` fires on `pagehide` and on client-side navigation away (effect keyed on pathname). |
| `PublicLeadForm.tsx`, `NewsletterSignupForm.tsx`                 | `trackFormResult()` beside each existing GTM push (stage 1 and 2, success and error). GTM events untouched.                                                                                                                                                                                                                    |
| `CalendlyBookingRedirect.tsx` (+ `CalendlyEmbed` passes the url) | `calendar_viewed` on mount, `calendar_booked` on `calendly.event_scheduled`. Calendar URL stripped of the name/email prefill.                                                                                                                                                                                                  |
| `ChatWidget.tsx`                                                 | `chat_opened` (trigger: launcher / teaser / exit_intent), `chat_started` (first message per session), `calendar_booked {surface: chat}`.                                                                                                                                                                                       |
| `src/lib/attribution-client.ts`                                  | `emitAttributionEvent` mirrors `landing_viewed`, `cta_clicked`, `popup_*` into PostHog. First-party route unchanged.                                                                                                                                                                                                           |
| `src/lib/analytics/canonical-path.ts`                            | `canonicalFunnelPath` extracted from `funnel-monthly.ts` (re-exported there; existing tests unchanged).                                                                                                                                                                                                                        |
| `src/lib/config.ts`, `.env.example`, `.env.local`                | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (optional).                                                                                                                                                                                                                                                                                |

Event names follow the handoff (`form_viewed`, `form_started`, `form_field_completed`,
`form_abandoned`, `form_submit_attempted`, `form_submit_failed`, `form_submitted`).
`page_viewed` is PostHog's own `$pageview`; no duplicate custom event.

Forms covered without any per-form code: every `PublicLeadForm` surface (all ten booking
funnels, `/contact` stage 1 + 2, the social landers via `BookingForm`, lead magnets), the
newsletter form (both stages). Any future `<form id="…-step-N" data-form-step="N">` is
tracked automatically.

## Environment

- Vercel already had `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`
  (Preview + Production, added by the PostHog setup ~11:00 on 2026-09-18), plus unused
  `VITE_*`, `NUXT_*`, `PUBLIC_*` copies of the same values. The code reads only
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`; the host is the proxy. The `VITE_` / `NUXT_` /
  `PUBLIC_` vars can be deleted at leisure.
- `NEXT_PUBLIC_*` is inlined at build time: a value change needs a redeploy.
- Rollback: delete the token from the Production env and redeploy. No code revert.

## Verification (fill in as it happens)

Local, in the worktree: `tsc --noEmit` 0 errors · targeted vitest green · eslint 0 ·
prettier clean · full suite and `next build --webpack` (worktree needs `--webpack`,
symlinked node_modules) — see PR body for counts.

Preview (`$P` = preview URL):

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$P/api/ph/e/?ip=1" -H 'content-type: application/json' -d '{"api_key":"<token>","batch":[]}'   # 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$P/about/"                                                                          # 308 → /about
curl -s -o /dev/null -w '%{http_code}\n' "$P/api/ph/static/array.js"                                                                         # 200
```

Local production build (`next build --webpack` + `next start`, 2026-09-18 ~12:30 PT), same
checks against `http://localhost:3811`:

```
/about/                 -> 308 /about          (was 308 /about/, a loop; fixed in cac06a8)
/contact/?utm_source=x  -> 308 /contact?utm_source=x
/news/some-post//       -> 308 (Next collapses //) -> 308 /news/some-post ; terminates
POST /api/ph/e/ empty batch     -> 400 "request holds no event"  (PostHog's answer; the rewrite works)
POST /api/ph/e/ one event       -> 200
GET  /api/ph/static/array.js    -> 200
scripts/ph-preview-check.mjs    -> 13 events, ALL carry vp_session_id:
  $pageview /contact (funnel) · form_viewed · form_started first_field=first_name ·
  form_field_completed · $autocapture · $pageview /privacy (client-side link) ·
  form_abandoned source_path=/contact (beacon) · $pageview / · $set · landing_viewed
```

Two defects found and fixed by this pass: the proxy's trailing-slash 308 redirected to itself
(`NextURL.clone()` re-appends the incoming slash to any pathname set later), and
`form_abandoned` fired from the pathname-effect cleanup carried the _next_ page's
`source_path` (stamped with the form's own URL now, 3312840). `$set` events are posthog-js's
own initial-property events, no code here sets person properties.

Preview, 2026-09-18 ~13:05 PT, branch alias at `ccd8e9e`, reached with the local development
OIDC token (`vercel env pull` → `VERCEL_OIDC_TOKEN`, header `x-vercel-trusted-oidc-idp-token`;
Trusted Sources admits same-project previews, no Protection Bypass secret was created):

```
/about/                -> 308 /about            /contact/?utm_source=x -> 308 /contact?utm_source=x
POST /api/ph/e/ (one event) -> 200              GET /api/ph/static/array.js -> 200
scripts/ph-preview-check.mjs -> 11 events, ALL carry vp_session_id, environment=preview:
  $pageview /contact funnel · form_viewed · form_started first_field=first_name ·
  form_field_completed · $autocapture ×2 · $pageview /privacy · $pageview / ·
  form_abandoned source_path=/contact (beacon)
```

PostHog → Activity: `$pageview` from `/`, `/contact`, `/booking-youtube`, a `/news/*`
post, `/start`, with `vp_session_id`, `source_path`, `page_group`, `environment=preview`.
Fill a field on `/contact` and leave: `form_viewed → form_started → form_field_completed →
form_abandoned`. Nothing from `/admin/*`.

## PostHog configuration (clicks, not code)

1. Project settings: enable session replay (mask all inputs, default), heatmaps, autocapture.
   Authorized URLs for the toolbar: `https://www.vendingpreneurs.com`, `https://*.vercel.app`.
2. "Filter out internal and test users": `environment != production`; person/event property
   filters on `@modern-amenities.com` and `@vendingpreneurs.com` emails once known.
3. Insights, one dashboard "Website funnels (pre-submit)":
   - Funnel per booking page: `$pageview` (page_group = funnel) → `form_viewed` → `form_started`
     → `form_submitted`, breakdown by `source_path`. The headline chart.
   - Same funnel, breakdown by `vp_utm_source`.
   - `form_field_completed` breakdown by `field`, filtered to one `form_name`: which field loses people.
   - `form_abandoned` breakdown by `last_field`.
   - `calendar_viewed` → `calendar_booked` (behaviour, not a booked count).
   - Chat: `chat_opened` → `chat_started`.
4. Replay saved filters: "started, no submit" (`form_started` and not `form_submitted`, 7 d);
   "submit failed"; "saw calendar, no booking".
5. Alert: `form_submitted / $pageview(page_group=funnel)` down > 25% week over week.
6. `/privacy`: one sentence on analytics and session recording (Adam approves copy).

## Reconciling with the server side

- PostHog `form_submitted` (browser) ÷ `lead_submissions` rows (server), per day = the share
  of visitors the browser can see. Expect 0.85–0.95 through the proxy; below 0.8 means the
  proxy is broken, not that leads dropped.
- Stitch a PostHog funnel to the server funnel on `vp_session_id`: a HogQL query over
  `events` joined to an export of `lead_submissions(vp_session_id, call_booked_at, …)`,
  or the reverse in Supabase once PostHog's warehouse export is on. Not this sprint.
- PostHog sessions vs GA4 sessions on `/booking-youtube` should sit within ~10%.

## Decisions and risks

- **Reverse proxy vs trailing slash.** PostHog needs `skipTrailingSlashRedirect`; set globally
  that removed the site's `/about/` → `/about` 308 (duplicate URLs for SEO). Moved the 308 into
  `src/proxy.ts`, which already runs on every public page and never on `/api`. Verified by curl
  on preview. Cookies (including admin Supabase session cookies for staff browsing the public
  site) are forwarded to PostHog by the rewrite like any external rewrite; accepted. A route
  handler proxy that strips cookies is the alternative if that ever matters.
- **No identify.** Pre-consent, nothing personal leaves the browser; PostHog persons are
  anonymous devices. The join to a lead is our property, not PostHog's person model.
- **Bundle.** `instrumentation-client` imports the funnel and legacy-route registries (content
  modules) for `page_group`. Checked in the build output; split a paths-only module if it grows.
- **Cost.** ~22k pageviews/month (GA4: 142k views / 196 days). Anonymous events, far inside the
  free tier even with autocapture and replay.
- **Concurrent session.** Another session was committing in `~/vending-website` while this
  was built. Its Close UTM commit (`09f1aa6`) landed on this branch by accident when the
  checkout was switched; cherry-picked onto `main` as `c799a47`. Work moved to the worktree.
  `src/instrumentation-client.ts` was restored from HEAD (Sentry) before adding PostHog.

## Not built, on purpose

- Server-side `lead_captured` / `call_booked` events into PostHog. The handoff's boundary:
  Close and Supabase own everything from the first submit. Add only if replay filters by
  "became a lead" turn out to matter; it is one `posthog-node` call in `submitLead`.
- A PostHog cookie banner. GA4 and Meta already run without one.
- `@posthog/wizard`: interactive and rewrites files its own way; hand-wired per Next 16 docs.
