# Security and data handling

Verified against `main` at `faac091` on 2026-10-02. This document describes how the system is
built and where its limits are. Items marked **(outside the repo)** depend on settings in a
vendor dashboard (Vercel, Supabase, GitHub, Close) that cannot be read from the code and must
be confirmed there. No secret values appear in this document; secrets live in the Vercel
project environment.

## 1. Reporting a vulnerability

Email the site owner or the engineering contact for Vendingpreneurs privately; do not open a
public issue with exploit detail. **(Owner to fill in the monitored security contact address
before this file is published externally.)**

## 2. Authentication and authorization

### 2.1 Admin studio (`/admin/*`)

- **Identity:** Supabase Auth, email and password (`signInWithPassword` in
  `src/app/admin/login/actions.ts`). Password reset runs through `/admin/forgot-password`
  and `/auth/callback`.
- **Authorization:** the `app_users` table is the allowlist. A signed-in user who is not in it
  is signed out and refused. Roles: `viewer` (read-only), `admin`, `super_admin`
  (`AdminRole`, `src/lib/supabase/auth.ts`). User management is super-admin only.
- **Three layers**, so one failing does not expose data:
  1. `src/proxy.ts` redirects unauthenticated or unlisted users away from `/admin/*`.
  2. Every admin page and server action calls `requireAdmin()`, `requireSuperAdmin()` or the
     read-only gate itself. Server actions are public HTTP endpoints, so this layer is the one
     that matters most.
  3. Row-level security is enabled on every table created in `supabase/migrations/`
     (74 of 74 by a script scan of the migration files; 28 tables carry policies, the rest are
     service-role only, with RLS on and no policy). Production state **(outside the repo)**
     depends on which migrations have been applied; see [DATABASE.md](DATABASE.md).
- **Dev bypass:** `ADMIN_DEV_AUTH_BYPASS` is honoured only when `NODE_ENV === "development"`; in
  any other mode it is ignored and a warning is logged (`src/lib/supabase/dev-auth.ts`).
- **Shared guest login:** `ADMIN_GUEST_EMAIL` backs a "Continue as guest" button for a shared
  read-only `viewer` account. Everyone holding that password shares one session with no audit
  trail. Viewers may open the lead list and lead detail pages and the chatbot conversation pages
  (the allowlist is `READ_ONLY_PAGES` in `src/lib/admin/viewer-access.test.ts`), so treat the
  shared password as access to that data, subject to any field-level masking those pages apply.
  Use named `admin` accounts where accountability matters, and rotate the password with
  `scripts/create-shared-viewer.mjs` when someone leaves. Leaving the variable unset hides the
  button.

### 2.2 Machine endpoints

All comparisons are constant time (`timingSafeEqual`) and fail closed: an unset secret makes the
route answer 503.

| Endpoints                                       | Credential                                               |
| ----------------------------------------------- | -------------------------------------------------------- |
| 22 `/api/admin/<job>/run` routes                | `CRON_SECRET` bearer                                     |
| `/api/admin/manychat-ingest`                    | `MANYCHAT_INGEST_SECRET` bearer                          |
| `/api/admin/webinar-ingest`                     | `WEBINAR_INGEST_SECRET` bearer                           |
| `/api/reporting/kpi`, `/api/reporting/channels` | `REPORTING_API_KEY` bearer (read only)                   |
| `/api/webhooks/calendly`                        | Calendly HMAC signature (`CALENDLY_WEBHOOK_SIGNING_KEY`) |

The full route table is in [ARCHITECTURE.md](ARCHITECTURE.md).

### 2.3 Public, unauthenticated surface

- The lead forms and qualification steps (server actions), six `/api/chatbot/*` routes,
  `/api/attribution/events`, `/api/csp-report`, and the masterclass registration flow.
- **Rate limiting** (`src/lib/public-rate-limit.ts`): sliding windows per action, keyed on request
  IP and, where relevant, a SHA-256 of the lowercased email. Hit rows are kept 24 hours and pruned
  by the Close sync cron. The limiter **fails open** by design (a database outage must not drop
  leads), except for the chatbot's resource-email action, which fails closed. The backing table
  comes from migration `20260801090000_public_request_hits.sql`, which is applied by hand; if it is
  missing, limits are not enforced. Confirm it exists in production **(outside the repo)**.
- The chatbot has a global daily cap and a per-IP new-conversation budget (`input-budget.ts`,
  `public-rate-limit.ts`).
- `/api/attribution/events` uses a first-party request check, which is not authentication; the
  rate limit is what bounds abuse.
- `/api/csp-report` stores nothing: it logs the first report per directive and blocked host per
  instance and answers 204.

## 3. Secrets

- Secrets are read from environment variables through `src/lib/config.ts` (validated with zod)
  and are never committed. `.env*` is git-ignored except `.env.example`, which holds
  placeholders only. The complete variable list, with what each does and what happens when it is
  unset, is [ENV.md](ENV.md).
- Server-only values (anything not prefixed `NEXT_PUBLIC_`) are used from server modules that
  import `server-only`. The browser receives only `NEXT_PUBLIC_*` values: the site URL, the
  Supabase URL and anon key, the Sentry DSN, the PostHog project token, tracking flag and the
  Calendly/roadmap links.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is used by server code and by operational scripts.
  Treat it as the most sensitive value in the system.
- Sentry events are scrubbed of email, phone and name URL parameters before they leave
  (`src/lib/tracking/sentry-scrub.ts`), and `sendDefaultPii` is false.
- Rotation: change the value in Vercel, redeploy, then update the other party (Close, Calendly,
  GitHub Actions secret, ManyChat). Steps are in [RUNBOOK.md](RUNBOOK.md).

## 4. Browser hardening

Headers set on every route (`src/lib/security-headers.ts`, applied in `next.config.ts`):
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
`X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (two years, `includeSubDomains`,
no preload), a restrictive `Permissions-Policy`, and `Content-Security-Policy-Report-Only`.

**The CSP is report-only and blocks nothing.** The site loads many third-party marketing tags, and
an enforcing policy cannot be written safely from source alone. Violations go to
`/api/csp-report`. Promoting it needs a quiet report log over real traffic and nonces for the
inline tag bootstraps (see `src/lib/content-security-policy.ts`). Third-party tags are loaded only
when `NEXT_PUBLIC_TRACKING_ENABLED=1`.

## 5. Personal data inventory

Public forms write through server actions using the service-role client; browsers do not write
to these tables directly (`supabase/migrations/20260504090000_lead_submissions.sql` documents the
model for the lead table).

| Store (table)                                          | What it holds                                                                                         | Retention in code                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `lead_submissions`                                     | Name, email, phone, city/state, business stage, budget, timeline, message, UTMs, referrer, user agent | None automatic; admin can delete a lead (`adminDeleteLead`), cascading to sessions, answers and sync events |
| `qualification_sessions`, `qualification_answers`      | Funnel answers per session; the session token is the only credential for `/qualify/<token>`           | Removed with the lead (cascade)                                                                             |
| `close_sync_events`                                    | Outbox payloads destined for Close                                                                    | Removed with the lead (cascade)                                                                             |
| `calendly_bookings`                                    | Invitee name and email, event details, UTMs, raw Calendly payload                                     | None; kept (unlinked) when a lead is deleted                                                                |
| `chatbot_conversations` and related `chatbot_*` tables | Chat transcripts, captured name/email/phone, prospect profiles                                        | None automatic                                                                                              |
| `close_lead_funnel`                                    | Mirror of Close leads that booked a first call (display name, email, setter, dates)                   | Pruned to Close after each complete crawl                                                                   |
| `manychat_events`, `webinar_events`                    | Inbound ManyChat events (may carry Instagram handle, email, phone); webinar snapshots                 | None automatic                                                                                              |
| `lead_video_views`, `lead_page_views`                  | Browser session id, video progress, landing paths; no email or name                                   | None automatic; readers filter by trust date                                                                |
| `public_request_hits`                                  | Request IP and email hash (rate limiting)                                                             | 24 hours, pruned by cron                                                                                    |
| `app_users`, `app_user_emails`, `app_user_events`      | Admin emails and roles, access events                                                                 | While the account exists                                                                                    |

Deleting a person completely currently needs an admin delete of the lead **plus** manual removal of
their rows in `calendly_bookings`, `chatbot_conversations` and the other tables above, and a
deletion in Close, GoHighLevel and the other processors below. There is no automated erasure job and
no automatic retention policy for these tables **(owner decision pending)**.

## 6. Subprocessors and data recipients

Derived from outbound hosts in the code and the CSP allowlist. Whether each is contractually
covered is **(outside the repo)**.

| Processor                                              | Purpose                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Vercel                                                 | Hosting, cron, analytics and speed insights                                                    |
| Supabase                                               | Database, authentication, storage                                                              |
| Close                                                  | CRM; every captured lead is synced                                                             |
| Calendly                                               | Booking and webhook                                                                            |
| OpenAI                                                 | Site chatbot, SEO page-builder assistant                                                       |
| Resend, Slack                                          | Lead, chatbot and report notifications (these messages carry lead details)                     |
| GoHighLevel / WeScale                                  | Lead forwarding (admin-controlled), masterclass registration, form and email stats             |
| Kit, ActiveCampaign                                    | Newsletter signups (Kit from the main site, ActiveCampaign from `apps/mike-newsletter`)        |
| Money Page                                             | Funnel tracking webhook for captures and attribution events                                    |
| Sentry                                                 | Error monitoring                                                                               |
| PostHog                                                | Behaviour analytics through a same-origin proxy (`/api/ph`)                                    |
| Google (GA4, Search Console, YouTube, Tag Manager)     | Analytics and reporting                                                                        |
| Metricool, Bitly, ManyChat, DataForSEO                 | Marketing data connectors                                                                      |
| Marketing tags (behind `NEXT_PUBLIC_TRACKING_ENABLED`) | Meta Pixel, HubSpot, ClickMagick, idpixel, Vidalytics, RightMessage, Wisepops, ManyChat widget |

## 7. Dependency and hardening status (2026-10-02)

`npm audit --package-lock-only --omit=dev` on `main` reports 13 findings in production
dependencies: 1 critical, 6 high, 4 moderate, 2 low. Fixes are available for all of them.

- **Critical:** `next`. The advisory range (`9.3.4-canary.0` to `16.3.5`) covers the pinned
  `16.2.6` and also `16.2.11`, the target named in `docs/archive/HANDOFF-HARDENING.md`, so that target is stale:
  take the patched version from `npm audit fix` output, then verify the proxy contract on a
  preview (`/about/` returns 308; `POST /api/ph/e/` returns 200; `/admin` redirects when signed
  out). A proxy bypass alone does not expose data because every admin page and action checks the
  session itself (section 2.1).
- **High:** `brace-expansion`, `browserslist`, `fast-uri`, `nanoid`, `postcss`, `sharp`
  (libvips). Mostly build-time or image-pipeline packages.
- No dependency upgrade is part of the documentation change that introduced this section.
- **No CI and no branch protection in the repository.** No `.github/` directory exists. Branch
  protection is **(outside the repo)** and should be confirmed. Local Husky hooks are the only gate.
- **Report-only CSP** (section 4).
- **Hand-applied migrations:** security-relevant tables such as the rate-limit table depend on an
  operator having applied the SQL; there is no migration ledger in the repo yet.
- A Close contact-overwrite weakness reported in `docs/archive/HANDOFF-HARDENING.md` was fixed in
  `src/lib/close/sync.ts` (commit `2bccb46`): matched contacts only receive appended emails and
  phones.

## 8. Not covered

No penetration test, SOC 2 or similar attestation exists in the repository. Backups, point-in-time
recovery, Vercel access control, GitHub access control and vendor agreements are outside the
repository and need owner confirmation.
