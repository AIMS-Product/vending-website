# Decisions: website-builder-round-3-feedback

## Confirmed Decisions

- 2026-06-11: User authorized the full Round 3 flow autonomously via
  `/issue-fix-strategy into /feature-orchestrator until done`.
- 2026-06-11: Local-only release train per AGENTS.md — no push, no PR, no Vercel
  preview. Orchestrator commits wave checkpoints on `ux-review-fixes`.
- 2026-06-11: Pre-existing uncommitted work (`src/app/home-v2/`,
  `src/components/sections/home-v2/`, `src/lib/content/home-v2.ts`, modified
  `Benefits.tsx`, `Testimonials.tsx`) must not be touched or committed.

## Safe Defaults (overridable)

- I6 route prefixes: curated super-admin-managed list in a settings table, NOT
  free-text per-page input. Reserved blocklist: /admin, /api, /authors, /news,
  and all existing top-level app routes. Rationale: arbitrary prefixes risk
  shadowing real routes; curated list keeps SEO path discipline.
- I3 legacy meta descriptions (156-180 chars): saving remains allowed (warn-only);
  the 155 hard cap applies to new/edited input. Rationale: never block publishing
  of existing content over a copy-length rule.
- I2 substring matching: first occurrence of the entered link text; empty link
  text falls back to existing whole-paragraph behavior.
- I7 scope: truncation warning only; bold/italic span support and nested lists
  deferred (documented in review doc as importer-hardening candidates).
- S5 proof imagery: no new migration — `proof_items.asset_id` already exists.

## Open Questions

- None blocking. I6 prefix policy is a labeled default the user can override.

## Rejected Options

- Free-text per-page route prefixes (route shadowing + SEO sprawl risk).
- Blocking saves for legacy >155 meta descriptions (would block publishing).
