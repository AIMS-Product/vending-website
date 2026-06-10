# Decisions: seo-builder-ux-fixes (round 2, 2026-06-10)

Source of authority: `reports/ux-persona-review-seo-builder/fix-strategy.md` (issue-fix-strategy triage, accepted by James 2026-06-10).

## Confirmed Decisions

- 2026-06-10: Business is US WEST COAST. Pacific Time scheduling is CORRECT. Do NOT change timezone handling anywhere (review finding WITHDRAWN-1).
- 2026-06-10: I4 acceptance includes deleting the 3 stuck test redirects via the new delete UI: `/resources/ux-old-test-1781071681847`, `/resources/ux-old-test-1781071765035`, `/resources/ux-explore-old-1781071765035`. This destructive op on prod rows is pre-approved as acceptance-by-cleanup — these exact 3 rows only.
- 2026-06-10: Final proof benchmark — re-run publish + schedule Playwright journeys (`reports/ux-persona-review-seo-builder/scripts/journeys2.mjs` pattern); current scores 1.2 and 1.3 / 5; target ≥3.5 behaviour: all blockers visible upfront, schedule visibly confirmed.
- 2026-06-10: I1, I2, I3, I6 share `SeoPublishPanel.tsx` + `useSeoPageEditorController.ts` — must run as a single-threaded chain, never in parallel.
- 2026-06-10: Pre-existing untracked review artifacts (`reports/ux-persona-review-seo-builder/`) committed separately BEFORE any worker launches, kept out of orchestrator fix commits.

## Safe Defaults (accepted at triage; proceed without re-asking)

- I5: KEEP create-on-start draft row. Add navigation/beforeunload guard (Save draft / Discard draft / Keep editing) where Discard deletes the never-explicitly-saved auto-row. Add visible "Draft created" notice at editor open. (Rejected alternative: defer creation to first save — breaks autosave/preview-token assumptions.)
- I9: Snapshot a revision on every manual "Save draft" reusing `page_revisions` with `revision_type='manual_save'` (already in the CHECK constraint — no schema migration). Prune keep-last-20 manual-save revisions per page.

## Scope Adjustments During Execution

- 2026-06-10 (N2/I2): the schedule-field round-trip bug (part a) does NOT reproduce on current code — already fixed by the June 10 scheduler-ownership rework (20260610091000), which postdates the review evidence. Disposition: regression-lock test added; sub-behavior ALREADY_RESOLVED; N2 ships part (b) only (always-visible scheduled status + Cancel + failed state + de-burial). Verified by worker-n1 code trace + browser repro.
- 2026-06-10 (N5/I4): "enable/disable" realized as delete — redirects table has no enabled column and adding one would require a resolution-touching migration on a risky surface. Edit + delete fully cover correction and removal. Reversible-disable would be a new migration node if product wants it later.

## Open Questions

- None blocking. (Both intake items above were resolved with defaults at triage.)

## Rejected Options

- Changing schedule display/storage to any non-Pacific timezone — withdrawn finding, business context says Pacific is right.
- Deferring draft-row creation to first save (I5 alternative) — breaks autosave + preview-token assumptions.
- Treating round-1 plan (`plan-2026-05-29-round1-complete.md`) as the live graph — it is COMPLETE and archived; this round is a separate fix set from the 2026-06-10 persona review.
