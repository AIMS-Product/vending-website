# Autonomous Hardening Log

**Started:** 2026-07-31
**Branch:** `autonomous-hardening-20260731` (cut from `main` @ `0097749`)
**Worktree:** `/Users/adamwolfe/vending-website-hardening` (see "Isolation" below)
**Scope:** local commits only. No push, no deploy, no remote DB writes, no dependency installs, no `.env` changes.

### Isolation — why this run moved to a worktree

Minutes after this session started, untracked files appeared in the main checkout that this
session did not create (`src/lib/content/lead-magnets.ts`,
`src/components/sections/CodedLeadMagnetPage.tsx`, `src/app/resources/roadmap*`), with birth
timestamps one minute old. **A concurrent session is actively building a lead-magnet feature in
`/Users/adamwolfe/vending-website`.**

Two hazards followed from that:
1. This run's commits would have swept up their in-progress, uncommitted work.
2. Creating `autonomous-hardening-20260731` moved *their* checkout onto this branch, so their
   commits would have landed here.

Mitigation applied immediately: the main checkout was returned to `main` (a no-op for files —
both refs pointed at `0097749`, so nothing was touched and their untracked work is intact), and
this run moved to a dedicated git worktree at `/Users/adamwolfe/vending-website-hardening` with
`node_modules` symlinked and `.env.local` copied. Verified in the worktree: 1212 tests pass,
`tsc --noEmit` clean.

**Nothing in this log touches the other session's files.**

---

## Phase 1 — Reconnaissance (baseline)

**Project:** `vending-website` — Vendingpreneurs marketing site (Webflow → Next.js 16 migration),
React 19, Tailwind 4, Supabase, Close CRM sync, Vitest. **LIVE in production** at
`www.vendingpreneurs.com` since 2026-07-27. Handles real customer lead PII.

**Structure:** 558 source files under `src/`, 183 test files.
6 API routes, admin CMS + SEO page builder, public lead-capture/qualification funnel,
Close CRM sync queue drained by a 10-minute cron.

### Baseline measurements

| Check | Command | Result |
|---|---|---|
| Tests | `npx vitest run` | **1212 passed, 0 failed** |
| Types | `npx tsc --noEmit` | **0 errors** |
| Lint | `npx eslint .` | **0 errors, 6 warnings** (all `@typescript-eslint/no-unused-vars`) |
| Coverage | `npx vitest run --coverage` | **66.9% statements** (8182/12235) |
| Git | working tree | clean (tracked files) |

Lowest-covered files carrying real logic (statement coverage, files >20 statements):

| Coverage | Statements | File |
|---|---|---|
| 6.5% | 123 | `src/app/admin/media/actions.ts` — **server actions, untested mutations** |
| 7.3% | 357 | `src/components/admin/seo-page-editor/AiBuilderAssistant.tsx` |
| 7.9% | 114 | `src/components/admin/seo-page-editor/useUnsavedExitGuard.ts` |
| 9.1% | 22 | `src/app/admin/libraries/actions.ts` — **server actions** |
| 11.4% | 167 | `src/components/admin/MediaPickerProvider.tsx` |
| 13.3% | 256 | `src/components/admin/MediaLibraryManager.tsx` |
| 18.0% | 139 | `src/components/admin/seo-page-editor/SeoReadinessHelpers.ts` |
| 27.3% | 55 | `src/lib/services/news.ts` |
| 31.3% | 492 | `src/components/admin/seo-page-editor/useSeoPageEditorController.ts` |

The gap is concentrated in admin editor client components and two **server-action files** —
server actions are public HTTP endpoints, so those two are the highest-risk untested surface.

Lint warnings by file:
- `src/app/admin/pages/page.tsx` (2)
- `src/app/admin/pages/actions.test.ts` (1)
- `s17-s20-clickthrough.mjs` (1)
- `s17-smoke.mjs` (1)
- `s4-axe.mjs` (1)

**Implication:** section 2a of the brief ("fix what's broken") is effectively empty — the suite is
green and the type/lint gates pass. All value in this run comes from 2b–2g: missing tests,
security hardening, bug hunting, performance, code quality, and documentation.

### Project conventions found

- `AGENTS.md` / `CLAUDE.md` (symlinked) — Next.js 16 API warnings, production deploy rules,
  admin studio design contracts, release-train rules.
- `.claude/rules/` — `components.md`, `pages.md`.
- `.claude/specs/` — 8 slice specs, most recent `2026-07-29-studio-admin-brand-restyle.md`.
- `DESIGN.md` — admin `--ui-*` token contract.
- `fallow.toml`, `stryker.conf.mjs` — structural analysis + mutation testing already configured.
- No `.claude/commands/`. One skill: `.claude/skills/react-doctor/`.
- Husky pre-push guard blocks stack-branch pushes (irrelevant here — no pushes).

---

## Phase 2 — Improvement backlog

Populated below as parallel investigators report. Items are marked
`- [ ]` open · `- [x]` done · `- [~]` BLOCKED.

