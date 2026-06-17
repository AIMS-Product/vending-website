# Verification: post-submit-qualification-builder

## Final Status

IN_PROGRESS

Implementation has started. S1 schema/type work, S2 qualification form service
work, S3 qualification intake service work, and S4 mocked Close sync work are
complete and recorded in `progress.md` plus the corresponding `agent-runs/`
evidence files. This file remains a final-proof scaffold for S12. Live Close CRM
proof is blocked until credentials and Close custom-field/status IDs exist.

## Requirement Audit

| Requirement                                                        | Evidence                            | Result  |
| ------------------------------------------------------------------ | ----------------------------------- | ------- |
| Short contact capture creates local lead before Close sync         | S3 service evidence; S9 UI pending  | PARTIAL |
| Mandatory qualification session appends to same lead/contact       | S3 service evidence; S5/S9 pending  | PARTIAL |
| Qualification answers persist step-by-step                         | Pending S5/S6 evidence              | TODO    |
| Admins can build immutable qualification form versions             | S2 service evidence; S7 UI pending  | PARTIAL |
| Page/block settings resolve form/default/override                  | Pending S8/S9 evidence              | TODO    |
| Close sync is optional, retryable, and non-blocking                | S3/S4 service evidence; S10 pending | PARTIAL |
| `/admin/leads` exposes status and retry controls                   | Pending S10 evidence                | TODO    |
| Existing `/apply`, `/contact`, and non-opt-in lead forms preserved | Pending S9/S12 evidence             | TODO    |

## Evidence Table

| Claim                                                  | Fresh evidence                                                                                                                                                                  | Result | Remaining risk                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| Plan is ready for implementation                       | `plan.md`, `progress.md`, `decisions.md` created 2026-06-17                                                                                                                     | PASS   | Plan still needs execution evidence                                                                          |
| S1 data model and generated type contract are in place | `agent-runs/S1-attempt-1.md`; `supabase/migrations/20260617090000_post_submit_qualification.sql`; `src/types/database.ts`; `src/types/post-submit-qualification-schema.test.ts` | PASS   | Full repo reset is blocked by an unrelated existing migration under Supabase CLI 2.75.0 before S1 is reached |
| S2 qualification form service contract is in place     | `agent-runs/S2-attempt-1.md`; `src/lib/qualification/forms.ts`; `src/lib/services/qualification-forms.ts`; `src/lib/services/qualification-forms.test.ts`                       | PASS   | Admin UI wiring and browser proof remain pending S7                                                          |
| S3 qualification intake service contract is in place   | `agent-runs/S3-attempt-1.md`; `src/lib/services/qualification-intake.ts`; `src/lib/services/qualification-intake.test.ts`                                                       | PASS   | Public route/action wiring and browser proof remain pending S9                                               |
| S4 mocked Close sync contract is in place              | `agent-runs/S4-attempt-1.md`; `src/lib/close/client.ts`; `src/lib/close/sync.ts`; `src/app/api/admin/close-sync/run/route.ts`; S4 tests                                         | PASS   | Live Close proof remains blocked until credentials and field IDs exist                                       |

## Commands

- S1 commands are recorded in `agent-runs/S1-attempt-1.md`.
- S2 commands are recorded in `agent-runs/S2-attempt-1.md`.
- S3 commands are recorded in `agent-runs/S3-attempt-1.md`.
- S4 commands are recorded in `agent-runs/S4-attempt-1.md`.

## Runtime And Boundary Proof

- Browser proof: not run for S1, S2, S3, or S4 because they are
  schema/service/adapter-only nodes.
- Local migration proof: focused S1 dependency stack reset passed; see
  `agent-runs/S1-attempt-1.md`.
- Mocked Close adapter proof: S4 mocked-fetch tests passed for Basic auth,
  lead/contact create/update, note/activity enrichment, stale follow-up tasks,
  retry, dead-letter, `needs_review`, and bounded sanitized errors.
- S2 boundary proof: service tests use an injected fake Supabase client and do
  not call live Close or a live database.
- S3 boundary proof: service tests use an injected fake Supabase client and
  assert a pending `close_sync_events` row without live Close credentials.
- S4 boundary proof: sync tests use mocked fetch and injected fake Supabase
  client; no live Close request is made.
- Live Close proof: blocked until credentials and mapping exist.

## Skipped Checks

- S1 browser proof skipped because S1 is schema/types only.
- S2 browser proof skipped because S2 is schema/service behavior only and has no
  browser-visible UI.
- S3 browser proof skipped because S3 is service behavior only; public route/UI
  proof is pending S9.
- S4 browser proof skipped because S4 is adapter/runner behavior only.
- S4 live Close proof skipped because credentials, custom-field IDs, status IDs,
  and an approved Close test record are unavailable.
- Full repo migration reset skipped because an unrelated existing migration fails
  under the installed Supabase CLI before S1 is reached; focused S1 reset proof
  was run instead.

## Behavior Preservation

- Previous intended behaviors: existing apply/contact/legacy public lead forms,
  existing SEO page-builder lead form rendering, current admin auth/RLS, and
  existing lead notification behavior.
- Intentional behavior changes: opt-in post-submit qualification flow, admin
  forms builder, admin leads backstop, Close sync queue.
- Evidence: S1 targeted tests and local migration proof are recorded in
  `agent-runs/S1-attempt-1.md`. S2 targeted service tests plus legacy lead and
  attribution regression tests are recorded in `agent-runs/S2-attempt-1.md`.
  S3 targeted intake tests plus S1/S2/legacy lead/attribution regression tests
  are recorded in `agent-runs/S3-attempt-1.md`. S4 targeted Close sync tests
  plus S1/S2/S3 and scheduled-route regression tests are recorded in
  `agent-runs/S4-attempt-1.md`. Broader flow proof remains pending.
- Confidence: 32%

## Residual Risk

- Close API field mapping is unknown until credentials/account configuration are
  available.
- The public Typeform-style runtime needs Image Gen concepting and real browser
  screenshots before UI signoff.
- Migrations are T1 and must be tested locally before any remote DB push.
