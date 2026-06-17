# Feature Progress: post-submit-qualification-builder

Status: IN_PROGRESS
Current wave: W5
Last updated: 2026-06-17
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                         | Tier | Depends On       | Parallel Group | Owner        | Status  |
| ---- | --------------------------------------------- | ---- | ---------------- | -------------- | ------------ | ------- |
| S1   | Data model, RLS, generated types              | T1   | none             | W1-A           | orchestrator | DONE    |
| S2   | Qualification form schema and services        | T1   | S1               | W2-A           | orchestrator | DONE    |
| S3   | Lead capture to qualification session service | T1   | S1,S2            | W3-A           | orchestrator | DONE    |
| S4   | Close adapter, sync events, retry runner      | T1   | S1,S3            | W4-A           | orchestrator | DONE    |
| S5   | Public qualification backend route/actions    | T1   | S2,S3            | W4-B           | orchestrator | DONE    |
| S6   | Public Typeform-style runtime design and UI   | T2   | S5               | W5-A           | unassigned   | PENDING |
| S7   | Admin qualification forms builder             | T2   | S2               | W5-B           | unassigned   | PENDING |
| S8   | Page/block attachment settings                | T2   | S2               | W5-C           | unassigned   | PENDING |
| S9   | Opt-in lead-form public integration           | T1   | S3,S5,S8         | W6-A           | unassigned   | PENDING |
| S10  | Admin leads backstop and retry controls       | T2   | S4,S5            | W6-B           | unassigned   | PENDING |
| S11  | Stale/expired lifecycle jobs and Close tasks  | T2   | S4,S10           | W7-A           | unassigned   | PENDING |
| S12  | End-to-end proof and cleanup                  | T1   | S6,S7,S9,S10,S11 | W8-A           | unassigned   | PENDING |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                     | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ---------------------------- | ---------- |
| S1   | DONE | DONE  | DONE     | DONE      | SKIPPED      | DONE          | `agent-runs/S1-attempt-1.md` | High       |
| S2   | DONE | DONE  | DONE     | DONE      | SKIPPED      | DONE          | `agent-runs/S2-attempt-1.md` | High       |
| S3   | DONE | DONE  | DONE     | DONE      | SKIPPED      | DONE          | `agent-runs/S3-attempt-1.md` | High       |
| S4   | DONE | DONE  | DONE     | DONE      | SKIPPED      | SKIPPED       | `agent-runs/S4-attempt-1.md` | High       |
| S5   | DONE | DONE  | DONE     | DONE      | SKIPPED      | DONE          | `agent-runs/S5-attempt-1.md` | High       |
| S6   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                         | TBD        |
| S7   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                         | TBD        |
| S8   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                         | TBD        |
| S9   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                         | TBD        |
| S10  | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                         | TBD        |
| S11  | TODO | TODO  | TODO     | TODO      | SKIPPED      | TODO          | none                         | TBD        |
| S12  | TODO | TODO  | TODO     | TODO      | TODO         | BLOCKED       | none                         | TBD        |

`S4` live Close boundary proof was skipped with accepted reason because
credentials and field IDs are unavailable. `S5` browser proof was skipped because
runtime UI/browser behavior is owned by S6/S9. `S12` final live Close proof
remains blocked on the same external credentials/mapping.

## Blockers

| Node | Blocker                                                        | Required Decision Or Evidence                                             |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| S12  | Final live Close proof cannot run without credentials/mapping. | Same as S4; otherwise mark live Close proof skipped with accepted reason. |

## Completed Evidence

- 2026-06-17: New worktree created at `/Users/jamesaims/Desktop/Development/vending-website-post-submit-qualification` on branch `codex/post-submit-qualification-builder`.
- 2026-06-17: Intake decisions captured in `plans/post-submit-qualification-builder/decisions.md`.
- 2026-06-17: Feature graph planned in `plan.md`; no implementation nodes started.
- 2026-06-17: S1 completed. Added additive post-submit qualification migration, generated type contract updates, and schema/type regression test. RED evidence, targeted tests, typecheck, focused local Supabase reset proof, RLS/token inspection, and full-reset caveat are recorded in `plans/post-submit-qualification-builder/agent-runs/S1-attempt-1.md`.
- 2026-06-17: S2 completed. Added qualification form schemas, normalized role support, question/option snapshots, draft update, publish-to-immutable-version, default version resolution, and version-by-id services. RED/GREEN/REFACTOR evidence and targeted tests are recorded in `plans/post-submit-qualification-builder/agent-runs/S2-attempt-1.md`.
- 2026-06-17: S3 completed. Added short-contact qualification intake service, default/explicit form-version resolution, local lead/session persistence, hashed session-token storage, email-based Close ID reuse, and pending Close sync event enqueueing. RED/GREEN/REFACTOR evidence and targeted tests are recorded in `plans/post-submit-qualification-builder/agent-runs/S3-attempt-1.md`.
- 2026-06-17: S4 completed. Added optional Close env config, mocked-fetch Close client, retryable sync event processor, duplicate handling, enrichment notes/custom fields, stale follow-up tasks, bounded sanitized errors, and protected Close sync runner route. RED/GREEN/REFACTOR evidence and targeted tests are recorded in `plans/post-submit-qualification-builder/agent-runs/S4-attempt-1.md`.
- 2026-06-17: S5 completed. Added public qualification token lookup, immutable form loading, answer autosave/update, resume state, required/consent completion validation, safe redirect handling, Close enrichment event enqueueing, server actions, and a minimal noindex route shell. RED/GREEN/REFACTOR evidence and targeted tests are recorded in `plans/post-submit-qualification-builder/agent-runs/S5-attempt-1.md`.
