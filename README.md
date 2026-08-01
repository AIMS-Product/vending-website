# Vendingpreneurs

Marketing site, lead-capture funnel, and admin CMS for **vendingpreneurs.com** — a Next.js 16
replacement for the original Webflow site.

Production is live at `https://www.vendingpreneurs.com`. Pushes to `main` deploy to the custom
domains. Read `AGENTS.md` before changing anything.

## Stack

| Layer               | Choice                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Framework           | Next.js 16 (App Router, React 19)                                                               |
| Styling             | Tailwind CSS 4                                                                                  |
| Data                | Supabase (Postgres + Auth + Storage)                                                            |
| CRM                 | Close, via a queued sync drained by cron                                                        |
| Errors              | Sentry                                                                                          |
| Tests               | Vitest (`*.test.ts` beside each source file); Playwright for the scripted checks under `plans/` |
| Mutation testing    | Stryker (`npm run mutate`)                                                                      |
| Structural analysis | Fallow (`fallow.toml`)                                                                          |

> **Next.js 16 is not the Next.js in your training data.** APIs, conventions, and file layout
> differ. Read `node_modules/next/dist/docs/` before writing framework code. Note that
> middleware lives in `src/proxy.ts`, not `src/middleware.ts`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

To reach `/admin` locally without a Supabase session, set `ADMIN_DEV_AUTH_BYPASS=1`. It is
honored **only** when `NODE_ENV === "development"` and is ignored everywhere else
(`src/lib/supabase/dev-auth.ts`).

### Environment variables

`.env.example` is the authoritative list. The ones that gate real behavior:

| Variable                                                     | Required for                            | Notes                                           |
| ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                       | canonical/OG/RSS tags, auth email links |                                                 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all data access                         |                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | admin + server writes                   | **server-only**, never expose                   |
| `CLOSE_API_KEY`                                              | Close sync runner                       | absent = the runner records a retryable failure |
| `CLOSE_*_FIELD_ID`                                           | Close custom fields                     | see the Close section below                     |
| `RESEND_API_KEY` + `LEAD_NOTIFICATION_*`                     | lead email alerts                       |                                                 |
| `SLACK_WEBHOOK_URL`                                          | lead Slack alerts                       | posts to `#vp-site-leads`                       |
| `OPENAI_API_KEY`                                             | SEO page-builder AI proposals           |                                                 |
| `CALENDLY_WEBHOOK_SIGNING_KEY`                               | booking capture                         | HMAC verify, fail-closed                        |
| `CRON_SECRET`                                                | cron route auth                         | bearer token on `/api/admin/*/run`              |
| `ADMIN_DEV_AUTH_BYPASS`                                      | local admin access                      | dev only; ignored in production                 |

Vercel env vars only apply to builds created **after** the change — setting one does not affect
the running deployment until the next deploy.

## Scripts

| Command                           | What it does                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | dev server                                                           |
| `npm run build`                   | production build (blocked while a dev server is running — see below) |
| `npm test`                        | full Vitest suite                                                    |
| `npm run test:coverage`           | suite + V8 coverage report                                           |
| `npm run typecheck`               | `tsc --noEmit`                                                       |
| `npm run lint`                    | ESLint                                                               |
| `npm run format` / `format:check` | Prettier                                                             |
| `npm run check:launch`            | launch-readiness checks                                              |
| `npm run mutate`                  | Stryker mutation testing                                             |

`scripts/guard-next-build.mjs` runs on `prebuild` and **blocks `next build` while a Next dev
server is running** — a concurrent dev server poisons the build's CSS chunks. Kill the dev
server first.

## Architecture

```
src/
  app/
    (builder-pages)/[...builderPath]   CMS-authored pages from the SEO page builder
    [legacyLeadPath]/                  legacy Webflow conversion URLs (registry-driven)
    contact/  booking-*/               lead-capture landing pages
    admin/                             CMS: pages, news, leads, forms, media, analytics, users
    api/                               6 route handlers (see below)
  components/
    sections/                          public page sections
    admin/                             admin studio UI (see DESIGN.md for the --ui-* contract)
    forms/  qualification/             public lead + qualification forms
  lib/
    services/                          business logic; most of the real work lives here
    close/                             Close CRM client, sync queue, dedupe
    qualification/                     scoring, bands, form field definitions
    supabase/                          clients + auth
    page-builder/  content/  media/
  proxy.ts                             middleware: admin auth gate + redirects
supabase/migrations/                   SQL migrations
```

### API routes

| Route                                        | Auth                      | Purpose                                   |
| -------------------------------------------- | ------------------------- | ----------------------------------------- |
| `POST /api/webhooks/calendly`                | HMAC signature            | records bookings, matches them to leads   |
| `GET /api/admin/close-sync/run`              | `CRON_SECRET` bearer      | drains the Close sync queue (every 2 min) |
| `GET /api/admin/qualification-lifecycle/run` | `CRON_SECRET` bearer      | lifecycle follow-ups (every 10 min)       |
| `GET /api/admin/scheduled-publishing/run`    | `CRON_SECRET` bearer      | publishes scheduled pages (every 5 min)   |
| `POST /api/attribution/events`               | public, first-party check | client-side attribution events            |
| `POST /api/page-builder/ai/chat`             | admin session             | AI page-builder assistant                 |

Cron schedules live in `vercel.json`. **Vercel crons run on production only** — they never fire
on preview deployments, so a staging queue must be drained by hand.

Every admin page and server action calls `requireAdmin()`/`requireSuperAdmin()` itself rather
than relying on the proxy alone; RLS on every table is the third layer.

## Key flows

### Lead capture → Close

The `/contact` funnel is two-stage and lives in one card (the URL never changes):

1. **Stage 1** — first/last name, email, phone, both consent opt-ins →
   `startInlineQualification` persists a `lead_submissions` row and fires the Slack alert. The
   lead is contactable from this moment even if they never finish.
2. **Stage 2** — purchase timeline + available capital → `finishInlineQualification` scores the
   answers, writes the band, and renders the fit result inline.

Scoring lives in `src/lib/qualification/scoring.ts`. Bands: `0-30` disqualify, `31-45` setting,
`46-75` lane_1, `76-100` top_closers. Each band routes to a different Calendly link
(`src/lib/qualification/thank-you-links.ts`).

> Three things must change together or submissions break: `scoring.ts` (points and bands),
> `vp-fields.ts` (what the form renders), and the **published form version stored in Supabase**
> (the server validates each answer against it). Published `qualification_form_versions` rows
> are immutable — a scoring change means inserting a new version row and repointing
> `qualification_forms.current_published_version_id`.

Close writes are queued as `close_sync_events` rows and pushed by the cron runner, so a Close
outage never fails a customer's form submit. The queue is also drained opportunistically by an
`after()` hook on each submit stage, so **overlapping drains are normal** — events are claimed
with a compare-and-swap on `attempt_count` plus a short lease before any Close call.

### Close custom fields

Close custom fields are **scoped** to either Lead or Contact objects, and sending a
contact-scoped field id in a lead update makes Close reject the **entire** update with a 400.
This has caused three separate production incidents.

**Always check scope before wiring a new field id:**
`GET /custom_field/{lead|contact}/{id}/`

The current split lives in `src/lib/close/client.ts`: answers, consents, source path, and UTMs
are contact-scoped; attribution, status, score, and band are lead-scoped.

### SEO page builder

Admin-authored pages are stored as block documents in `seo_pages` with revisions, previews,
scheduled publishing, and AI-assisted proposals. Rendering happens through
`src/app/(builder-pages)/[...builderPath]`. The design contracts in `docs/design/` are
execution contracts, not suggestions.

## Testing

```bash
npm test                 # full suite
npm run test:coverage    # with coverage
```

Tests sit next to their sources. Supabase is faked in-memory rather than mocked per call — see
`qualification-intake.test.ts` and `close/sync.test.ts` for the pattern. Those fakes deliberately
enforce real database constraints (the unique index on `close_sync_events.dedupe_key`, and
conditional updates matching zero rows); keep new fakes just as strict, because a lenient fake
lets a missing guard pass tests and fail in production.

## Deploying

- `main` is the release branch. Deploy by merging into it, never with `vercel --prod` from a
  working tree.
- Verify on the deployment's own `*.vercel.app` URL before promoting to the custom domains.
- Changes under `src/lib/close/*` or the qualification intake path are customer-visible the
  moment they deploy. Verify on preview against the real Close org first.
- Rollback: re-promote the previous production deployment. DNS does not change.

## Further reading

| Doc                                | Contents                                     |
| ---------------------------------- | -------------------------------------------- |
| `AGENTS.md` (= `CLAUDE.md`)        | working rules for this repo                  |
| `DESIGN.md`                        | admin studio `--ui-*` design tokens          |
| `docs/design/`                     | admin studio + page builder design contracts |
| `docs/seo-page-builder/roadmap.md` | active product roadmap                       |
| `docs/cutover/`                    | domain cutover and go-live handoffs          |
| `docs/migration/`                  | Webflow → Next.js migration mapping          |
| `.claude/specs/`                   | per-slice implementation specs               |
