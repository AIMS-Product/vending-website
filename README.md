# Vendingpreneurs

Marketing site, lead-capture funnel, and admin CMS for **vendingpreneurs.com** — a Next.js 16
replacement for the original Webflow site.

Production is live at `https://www.vendingpreneurs.com`. Pushes to `main` deploy to the custom
domains. Read `AGENTS.md` before changing anything.

## Stack

| Layer               | Choice                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js 16 (App Router, React 19)                                                                                                                                           |
| Styling             | Tailwind CSS 4                                                                                                                                                              |
| Data                | Supabase (Postgres + Auth + Storage); migrations are applied by hand, see `docs/DATABASE.md`                                                                                |
| CRM                 | Close, via a queued sync (`close_sync_events`) drained by cron                                                                                                              |
| Other integrations  | Calendly, GoHighLevel, Kit, Resend, Slack, OpenAI (chatbot and page-builder AI), Money Page, GA4, Search Console, Metricool, YouTube Analytics, Bitly, ManyChat, DataForSEO |
| Errors / analytics  | Sentry; PostHog through a same-origin proxy at `/api/ph`                                                                                                                    |
| Hosting             | Vercel (two projects: this app, and `apps/mike-newsletter`)                                                                                                                 |
| Tests               | Vitest (`*.test.ts` beside each source file); Playwright for the scripted checks under `plans/`                                                                             |
| Mutation testing    | Stryker (`npm run mutate`)                                                                                                                                                  |
| Structural analysis | Fallow (`fallow.toml`)                                                                                                                                                      |

> **Next.js 16 is not the Next.js in your training data.** APIs, conventions, and file layout
> differ. Read `node_modules/next/dist/docs/` before writing framework code. Note that
> middleware lives in `src/proxy.ts`, not `src/middleware.ts`.

## Getting started

```bash
npm ci
npx next typegen          # a fresh checkout needs next-env.d.ts before typecheck
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

To reach `/admin` locally without a Supabase session, set `ADMIN_DEV_AUTH_BYPASS=1`. It is
honored **only** when `NODE_ENV === "development"` and is ignored everywhere else
(`src/lib/supabase/dev-auth.ts`).

### Environment variables

`docs/ENV.md` is the complete list of runtime variables, with scope, what each does and what
happens when it is unset. `.env.example` holds the most common ones but is **not** complete
(for example `CRON_SECRET` and `CALENDLY_WEBHOOK_SIGNING_KEY` are only in `docs/ENV.md`).
Only three variables are mandatory (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`); everything else is optional and fails closed.

Vercel env vars only apply to builds created **after** the change; setting one does not affect
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
| `npm run check:launch`            | pre-cutover readiness checks (historical; see `scripts/README.md`)   |
| `npm run mutate`                  | Stryker mutation testing                                             |

`scripts/guard-next-build.mjs` runs on `prebuild` and **blocks `next build` while a Next dev
server is running** — a concurrent dev server poisons the build's CSS chunks. Kill the dev
server first.

## Architecture

The full picture, with diagrams, the complete route table and the authentication layers, is in
`docs/ARCHITECTURE.md`. In short:

```
src/
  app/
    (builder-pages)/[...builderPath]   CMS-authored pages from the SEO page builder
    [legacyLeadPath]/                  legacy Webflow conversion URLs (registry-driven)
    contact/  booking-*/  masterclass*/ lead-capture and funnel landing pages
    admin/                             CMS and analytics studio
    api/                               36 route handlers (webhooks, chatbot, ingest, reporting, 22 job runners)
  components/                          sections/, admin/ (see DESIGN.md), forms/, qualification/
  lib/
    services/                          business logic; most of the real work lives here
    close/  qualification/  chatbot/   Close sync queue, scoring, site chatbot
    ga4/ metricool/ youtube-analytics/ search-console/ bitly/ dataforseo/ ghl/ kit/   external clients
    supabase/                          clients + auth
  proxy.ts                             Next 16 proxy (not middleware.ts): redirects, 404s, admin gate
supabase/migrations/                   SQL migrations (hand-applied; see docs/DATABASE.md)
apps/mike-newsletter/                  separate newsletter site, own Vercel project
scripts/                               operational scripts; see scripts/README.md
```

Thirty-six routes live under `src/app/api`; there are 26 cron entries in `vercel.json`. The
route table (which authentication each route uses) and the cron table (schedule, effect, how to
re-run) are in `docs/ARCHITECTURE.md` and `docs/RUNBOOK.md`. **Vercel crons run on production
only**; they never fire on preview deployments, so a staging queue must be drained by hand.

Every admin page and server action calls `requireAdmin()`/`requireSuperAdmin()` (or the
read-only gate) itself rather than relying on the proxy alone; RLS on every table is the third
layer.

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

Full procedure, rollback and incident checks are in `docs/RUNBOOK.md`. The rules:

- `main` is the release branch. Deploy by merging into it, never with `vercel --prod` from a
  working tree.
- Verify on the deployment's own `*.vercel.app` URL before relying on it.
- Changes under `src/lib/close/*` or the qualification intake path are customer-visible the
  moment they deploy. Verify on preview against the real Close org first.
- Rollback: re-promote the previous production deployment of this app in Vercel. DNS does not
  change. The Webflow rollback proxy was retired at the 2026-07-27 cutover.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and a production `npm audit` on
  every PR into `main`. It does not run `next build`; run that locally or rely on the Vercel
  preview build.

## Further reading

`docs/README.md` indexes every document and marks each as current or historical.

| Doc                                | Contents                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| `docs/ARCHITECTURE.md`             | system context, data flows, route and auth table             |
| `docs/RUNBOOK.md`                  | release, rollback, cron table, monitoring, incident checks   |
| `docs/SECURITY.md`                 | auth model, PII inventory, subprocessors, hardening status   |
| `docs/ENV.md`                      | every runtime environment variable                           |
| `docs/DATABASE.md`                 | tables, migration process, migration ledger to complete      |
| `scripts/README.md`                | script inventory, marking which ones write to production     |
| `METRICS.md`, `REPORTING.md`       | metric definitions and the external reporting API            |
| `AGENTS.md` (= `CLAUDE.md`)        | working rules and learnings for this repo                    |
| `DESIGN.md`, `docs/design/`        | admin studio and page builder design contracts               |
| `docs/seo-page-builder/roadmap.md` | page builder roadmap (last edited 2026-06-01; may be behind) |
| `docs/archive/`                    | superseded handoffs and plans, kept as history               |
| `.claude/specs/`                   | per-slice implementation specs                               |
