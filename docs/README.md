# Documentation index

Status as of 2026-10-02 (`main` at `faac091`). **Current** documents are kept in step with the
code. **Reference** documents describe a system or decision and are still useful but are not
re-verified on every change. **Historical** documents record a past state and carry a banner
saying so; do not treat them as instructions.

## Start here

| Document                                       | Status                         | What it answers                                               |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| [`../README.md`](../README.md)                 | Current                        | What the repo is, how to run it                               |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | Current                        | How the system fits together, route and auth table            |
| [RUNBOOK.md](RUNBOOK.md)                       | Current                        | Release, rollback, cron table, monitoring, incidents          |
| [SECURITY.md](SECURITY.md)                     | Current                        | Auth model, PII inventory, subprocessors, hardening status    |
| [ENV.md](ENV.md)                               | Current                        | Every runtime environment variable                            |
| [DATABASE.md](DATABASE.md)                     | Current                        | Tables, migration process, ledger to complete                 |
| [`../scripts/README.md`](../scripts/README.md) | Current                        | Script inventory and which ones write to production           |
| [`../AGENTS.md`](../AGENTS.md)                 | Current                        | Working rules and learnings (`CLAUDE.md` links to it)         |
| [`../METRICS.md`](../METRICS.md)               | Current, line references drift | Metric definitions; search the symbol if a `file:line` is off |
| [`../REPORTING.md`](../REPORTING.md)           | Current                        | External reporting API and report definitions                 |
| [`../DESIGN.md`](../DESIGN.md)                 | Current                        | Admin studio `--ui-*` tokens                                  |

## By folder

| Path                                     | Status     | Contents                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design/`                                | Current    | Admin studio and page builder design contracts (required reading before admin UI work)                                                                                                                                                                                 |
| `marketing/`                             | Reference  | Data audit, reporting API, Search Console, SEO command center, ManyChat ingest, link standard, DataForSEO notes. Files with a date in the name (`funnel-baseline-2026-09-18.md`, `seo-baseline-2026-09-29.md`, `keyword-ideas-2026-09.md`) are point-in-time snapshots |
| `seo-page-builder/`                      | Reference  | Page builder roadmap and PRD. `roadmap.md` was last edited 2026-06-01 and may be behind the code                                                                                                                                                                       |
| `case-studies/`                          | Reference  | Case-study import notes                                                                                                                                                                                                                                                |
| `ad-attribution-url-templates.md`        | Reference  | Paid ad URL templates                                                                                                                                                                                                                                                  |
| `cutover/`                               | Historical | The 2026-07-27 domain cutover: go-live handoff, redirect matrix, Webflow URL inventory, launch-day runbook                                                                                                                                                             |
| `migration/`                             | Historical | Webflow to Next.js migration mapping and staging checklist                                                                                                                                                                                                             |
| `news-cms/`                              | Historical | News CMS import report and handoff                                                                                                                                                                                                                                     |
| `slice-3-brief.md`, `slice-3b-plan.md`   | Historical | May 2026 slice briefs                                                                                                                                                                                                                                                  |
| `launch-blockers.md`, `stack-release.md` | Historical | Pre-cutover launch blockers and the stacked-release plan                                                                                                                                                                                                               |
| `archive/`                               | Historical | Superseded root-level handoffs and plans: `HANDOFF.md`, `PLAN.md`, `HANDOFF-HARDENING.md`, `AUTONOMOUS_IMPROVEMENT_LOG.md`                                                                                                                                             |

## Repository map

| Path                                                               | Kind                | What it is                                                                        |
| ------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------- |
| `src/`, `public/`, `next.config.ts`, `vercel.json`, `package.json` | Runtime             | The application                                                                   |
| `supabase/`                                                        | Database            | SQL migrations (hand-applied) and local config                                    |
| `apps/mike-newsletter/`                                            | Runtime             | Separate newsletter site, its own Vercel project                                  |
| `data/`                                                            | Data                | Case-study JSON and the YouTube registry used by import scripts                   |
| `scripts/`                                                         | Tooling             | Operational and one-off scripts                                                   |
| `docs/`                                                            | Docs                | This folder                                                                       |
| `.husky/`                                                          | Tooling             | Git hooks: pre-commit lint and typecheck, pre-push branch guard                   |
| `.claude/`, `.agents/`                                             | Agent tooling       | Agent skills and rules; `.claude/specs/` holds about 90 per-slice specs           |
| `evals/`                                                           | Test data           | Chatbot opening-exchange fixtures                                                 |
| `plans/`                                                           | Historical evidence | Agent feature graphs, run logs and screenshots (about 50 MB). Not read at runtime |
| `reports/`                                                         | Historical evidence | Audit and QA reports with screenshots. Not read at runtime                        |

`plans/` is not excluded from Vercel uploads (`.vercelignore` excludes `reports/` but not
`plans/`); adding `plans/` there is a candidate cleanup that this documentation change did not
make.
