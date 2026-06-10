# Decisions: ux-verified-technical-fixes

## Confirmed Decisions

- 2026-06-11: Scope = the 31 technically-defensible findings from `reports/ux-review-status-2026-06-11/` (strategy IDs I1–I16). Judgment-call items (39) and Kody-deferred items (29) are explicitly out of scope this round.
- 2026-06-11: User authorized the full feature-orchestrator flow until completion, without pausing between phases (command args).
- 2026-06-11: Local-only release train — no push, no PR, no Vercel preview (AGENTS.md standing rule). Orchestrator commits one checkpoint per accepted wave.
- 2026-06-11: Gates must demand measured evidence (CLS numbers, axe output, browser screenshots). This round exists because the prior round's disposition tables misreported 4 issues as handled; disposition prose does not count as proof.

## Safe Defaults

- I13 privacy line: ship boilerplate "By applying you agree to our Privacy Policy. We never sell your data." linking /privacy-policy. Wording flagged for Kody review post-hoc (does not block: presence of a privacy link at collection is the compliance fix; copy is editable content).
- I10 news archive: reuse existing news archive semantics (status → archived, reversible). No hard delete added — destructive delete would be a new product decision.
- I15 schedule-failed surfacing: red count badge/alert linking to the existing "Schedule failed" filter, shown only when count > 0. No new notification channel.
- I12: render "(optional)" next to non-required fields in the shared form components rather than only contact's State, so the rule is systemic.
- I2/I3 touch targets: enlarge the _tappable area_ via padding/min-height; visual text size and James's preferred compact admin visuals unchanged (see memory: seo_builder_ui_preferences).
- I1 CLS: target < 0.1 on cold loads for /, /about, /news, one article. Footer space reservation + next/font display handling; no redesign.
- I16: verify-first — C132 (axe on /admin/pages/new), C145 (Save visibility at 375px), SEO-P3d (immediate create-gate click). Fix only what reproduces; non-reproductions recorded as ALREADY_RESOLVED with evidence.

## Open Questions

- None blocking. Kody items K1–K10 remain parked in plans/ux-review-fixes/decisions.md.

## Rejected Options

- Including opinion/judgment fixes in this round (rejected: user scoped to technically-inferable fixes).
- Hard delete on news rows (rejected: archive only — delete is a product decision).
- Restructuring the footer to avoid streaming (rejected as first resort: reserve height first, smallest change).
