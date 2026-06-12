# Verification: seo-builder-ux-fixes (round 2)

Date: 2026-06-10 · HEAD at proof: 39b5301 + final contrast fix · Owner: feature-orchestrator

## Final Status

**PASS**

Both benchmark journeys pass decisively; all 20 accepted issues are fixed or evidence-verified already-resolved; full repo gates green; axe serious/critical = 0 on all swept surfaces after the final contrast fix.

## Proof Benchmark (the headline requirement)

| Journey                                                | Review baseline | Final proof                                                                                                                                                                   | Verdict            |
| ------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Publish (create → see blockers → fix → publish → live) | 1.2 / 5         | ~4.5 / 5 — ALL blockers visible upfront at once + verdict/fix-next + deep links; gated confirm; success block; "Open live page" → 200; re-publish needs fresh confirm         | PASS (target ≥3.5) |
| Schedule (set → see → persist → cancel)                | 1.3 / 5         | 5 / 5 — control reachable without Advanced; "Scheduled to publish — Jun 11, 2026, 12:00 PM PDT (Pacific Time)" + Cancel; persists across reload; inline cancel visibly clears | PASS (target ≥3.5) |

All four original publish failure modes (blockers one-at-a-time, hover-only tooltip, no success feedback, dead-link 404 window) confirmed FIXED. Evidence: `agent-runs/N20-journeys-1.md`, `n20-results.json`, `n20-publish-results.json`, 43 screenshots in `n20-screens/`.

## Requirement Audit (I1–I20)

| Issue                            | Node(s)               | Result                                                                        | Evidence                                                                                                                              |
| -------------------------------- | --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| I1 publish blocker communication | N1                    | DONE                                                                          | N1-1.md; rule-parity test; N20 journey shows all blockers + deep links upfront                                                        |
| I2 schedule status honesty       | N2                    | DONE (part a ALREADY_RESOLVED by June 10 scheduler rework, regression-locked) | N2-1.md; N20 schedule journey 5/5                                                                                                     |
| I3 publish success state         | N3                    | DONE                                                                          | N3-1.md; root cause confirm-stays-armed; N20 live-link 200 + fresh confirm                                                            |
| I4 redirect CRUD                 | N5                    | DONE                                                                          | N5-1.md; 3 sanctioned stuck redirects deleted via new UI → 404; resolution provably unchanged                                         |
| I5 unsaved-exit / orphan drafts  | N6                    | DONE                                                                          | N6-1.md; Discard deletes never-saved auto-row w/ server floor; 9/9 browser                                                            |
| I6 autosave failure surfacing    | N4                    | DONE                                                                          | N4-1.md; capped backoff; honest never-says-saved indicator; toast dedupe                                                              |
| I7 list status labels            | N7                    | DONE                                                                          | N7-1.md; visible labels + legend; axe clean                                                                                           |
| I8 aria-prohibited-attr          | N8                    | DONE                                                                          | N8-1.md; role="img"; count 0                                                                                                          |
| I9 manual-save revisions + prune | N9                    | DONE                                                                          | N9-1.md; gated migration 20260610100000; live prune proof type+page-scoped                                                            |
| I10 mobile editor                | N11                   | DONE                                                                          | N11-1.md; overflow-x-hidden sticky-trap root cause; fixed bottom bar; desktop unchanged                                               |
| I11 jargon sweep                 | N18 (+N12 panel copy) | DONE                                                                          | N18-1.md; Overline (eyebrow), Call to action (CTA), words-first redirect codes; Slug→URL ending (slug), Governance→Internal & social  |
| I12 a11y batch                   | N17                   | DONE                                                                          | N17-1.md; tab stops 17→15; landmarks fixed; portal outline; archive glyph; targets ≥24px                                              |
| I13 duplicate slug               | N10                   | DONE                                                                          | N10-1.md; {source}-copy/-copy-N vs real unique index; edge cases tested                                                               |
| I14 panel verdict + tabs         | N12                   | DONE                                                                          | N12-1.md; verdict consumes N1 derivation (unit-asserted); mounted tabs preserve form fields; thin-page advisory in confirm (addendum) |
| I15 one-step create              | N13                   | DONE                                                                          | N13-1.md; zero Continue buttons; N6 guard regression intact                                                                           |
| I16 keyboard shortcuts           | N14                   | DONE                                                                          | N14-1.md; Cmd+S/Cmd+Enter/"/" via real affordances; gates respected                                                                   |
| I17 tour opt-in                  | N15                   | DONE                                                                          | N15-1.md; no auto-start; launcher; positioning fix untouched                                                                          |
| I18 revision page                | N16 + N21             | DONE                                                                          | N16-1.md (UTC-vs-local root cause, one Pacific formatter), N21-1.md (editor times unified)                                            |
| I19 placeholder cues             | folded into N1        | DONE                                                                          | human-readable blocker names                                                                                                          |
| I20 P3 batch                     | N19                   | DONE                                                                          | N19-1.md; 6 fixed + 6 verified already-resolved, per-item table; one DONE claim rejected then fixed (mock omission)                   |

## Evidence Table (final fresh runs)

| Claim                                 | Fresh evidence                                                               | Result | Remaining risk                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Typecheck clean                       | `npx tsc --noEmit` exit 0 (after contrast fix)                               | PASS   | —                                                                                                              |
| Full test suite                       | `npx vitest run` 97 files / 584 tests                                        | PASS   | —                                                                                                              |
| Production build                      | `npm run build` completes, all routes emitted                                | PASS   | —                                                                                                              |
| Editor axe                            | full AxeBuilder scan post-contrast-fix: serious [], critical [], moderate [] | PASS   | heading-order (moderate) seen on one earlier throwaway page; not reproduced on final scan                      |
| List / Redirects / Revisions-list axe | N20 sweep: 0 serious/critical each                                           | PASS   | revision DETAIL not re-scanned in N20 (no revision link on throwaway); covered by N16/N17 scans (0 violations) |
| PROD data hygiene                     | N20 orphan check: zero active throwaway rows; published throwaway 404s       | PASS   | sanctioned archived throwaways remain (terminal status, consistent with round-1 precedent)                     |

## Commands

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → 584/584
- `npm run build` → success
- `node plans/seo-builder-ux-fixes/agent-runs/n20-axe-recheck.mjs <page-id>` → serious/critical/moderate all []
- Journey runners: `agent-runs/n20-proof.mjs`, `n20-publish.mjs` (dev server :3001, dev-bypass auth)

## Runtime And Boundary Proof

- Migration 20260610100000 (prune fn): applied alone (migration list before/after in N9-1.md); additive CREATE FUNCTION; service-role-only grant; exception-safe trigger re-enable; live mixed-type prune proof.
- Redirect resolution: `src/lib/redirects.ts`, `src/proxy.ts`, middleware — zero diffs across the whole round; control-redirect curl identical before/after CRUD ops (N5).
- Scheduler: `seo-page-scheduler.ts` + its 8 tests untouched and green throughout.
- Publish/cancel semantics: reuse of existing paths verified per node; no new scheduled*publish*\* writers.

## Skipped Checks

- Revision DETAIL page in the final N20 axe sweep (no revision link on the throwaway at scan time) — accepted: surface scanned clean during N16/N17 with fresh evidence.
- Full `supabase gen types` regen — deferred (CLI v2.75 drifts unrelated nullability vs committed types; needs CLI bump). New RPC hand-typed additively; tsc green.
- Public custom-domain checks — out of scope until DNS cutover (per AGENTS.md).

## Behavior Preservation

- Previous intended behaviors: readiness RULES (parity test green at N1 and re-asserted at N12); confirm-before-every-publish (strengthened — fresh confirm enforced); debounced autosave semantics (timing unchanged; failure path added); scheduler runner + cancel; live redirect semantics; publish revisions + restore; round-1 fixes (draft-on-type, dirty guard, glyphs, tour positioning).
- Intentional changes: all per plan.md Working Brief — single canonical blocker surface, visible schedule/success/failure states, redirect delete/edit, nav guard with Discard, manual-save revisions, opt-in tour, one-step create, Pacific-consistent timestamps.
- Evidence: per-node reports + orchestrator fresh-gate re-runs at every integration + N20 journeys.
- Confidence: **95%**. Residual 5%: prod-Supabase-backed verification rather than isolated fixtures; breadth of UI churn in one day.

## Residual Risk

- Archived (terminal) throwaway pages accumulate on PROD from verification runs — sanctioned pattern, invisible to active lists; periodic purge via the guarded fn is available if wanted.
- Redirect "disable" = delete (no soft-disable without a resolution-touching migration) — recorded decision.
- Controller's legacy walkthrough functions are now unused (tour is component-local) — cleanup candidate.
- Editor heading-order (moderate axe) may appear on some pages — pre-existing, needs cross-component heading restructure.
- Dev-only: Supabase CLI types-regen drift pending CLI upgrade.

## Verdict

PASS — feature COMPLETE. 22/22 graph nodes DONE (N0–N21 + final proof); every accepted issue mapped, fixed or verified already-resolved, with fresh evidence.
