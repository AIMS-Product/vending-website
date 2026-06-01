# Feature Progress: website-builder-feedback-v2

Status: READY
Current wave: W0
Last updated: 2026-06-02
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                                      | Tier | Depends On | Parallel Group | Owner      | Status  |
| ---- | ---------------------------------------------------------- | ---- | ---------- | -------------- | ---------- | ------- |
| S0   | Verify existing review-marked builder behavior             | T0   | none       | W0-A           | unassigned | PENDING |
| S1   | Add persistent editor navigation and copy links            | T1   | S0         | W1-A           | unassigned | PENDING |
| S2   | Define page type and template creation foundation          | T2   | S0         | W1-B           | unassigned | PENDING |
| S3   | Add route-prefix slugs and duplicate-page flow             | T2   | S2         | W2-A           | unassigned | PENDING |
| S4   | Capture published blocks into content library              | T2   | S2         | W2-B           | unassigned | PENDING |
| S5   | Add SEO drawer governance fields                           | T2   | S2         | W2-C           | unassigned | PENDING |
| S6   | Add dashboard metadata, lifecycle, and bulk operations     | T2   | S5         | W3-A           | unassigned | PENDING |
| S7   | Add admin redirect manager                                 | T2   | S3         | W3-B           | unassigned | PENDING |
| S8   | Add scheduled publishing and review automation             | T2   | S5         | W3-C           | unassigned | PENDING |
| S9   | Add media defaults, proof images, and alt-text audit       | T1   | S2         | W3-D           | unassigned | PENDING |
| S10  | Fold blog authoring into builder with author profiles      | T2   | S2, S3     | W4-A           | unassigned | PENDING |
| S11  | Add controlled custom footer and form/embed blocks         | T2   | S2, S5     | W4-B           | unassigned | PENDING |
| S12  | Add governance history, comments, and collision protection | T2   | S6         | W5-A           | unassigned | PENDING |
| S13  | Plan later analytics, webhooks, CSV import, and API access | T2   | S6, S7, S8 | W5-B           | unassigned | BLOCKED |

## Gate Progress

| Node | RED     | GREEN   | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                                 | Confidence |
| ---- | ------- | ------- | -------- | --------- | ------------ | ------------- | ---------------------------------------- | ---------- |
| S0   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S1   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S2   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S3   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S4   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S5   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S6   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S7   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S8   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S9   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S10  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S11  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S12  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                     | TBD        |
| S13  | BLOCKED | BLOCKED | BLOCKED  | BLOCKED   | BLOCKED      | BLOCKED       | blocked on product/integration decisions | TBD        |

## Blockers

| Node | Blocker                                                        | Required Decision Or Evidence                                                                                                                                         |
| ---- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3   | Final route prefix taxonomy may affect implementation details. | Confirm safe defaults for Blog, SEO/resource, landing, video, and solutions route groups before implementation if the node cannot proceed with configurable defaults. |
| S8   | Scheduler mechanism may affect architecture.                   | Confirm whether to use existing hosted cron/job pattern or introduce one if no repo pattern exists.                                                                   |
| S10  | Existing blog/news migration scope is intentionally undecided. | Decide whether legacy `/admin/news` remains parallel, is gradually migrated, or is replaced after compatibility evidence.                                             |
| S11  | Third-party embed allowlist is not defined.                    | Decide which providers are allowed if the node includes external form embeds.                                                                                         |
| S13  | External contracts are not concrete enough for implementation. | Define analytics events, webhook consumers, CSV import scope, API consumers/auth model, and A/B testing priority.                                                     |

## Completed Evidence

- None yet.

## Notes

- This graph was created from `docs/seo-page-builder/website-builder-feedback-review.md` after the user triaged all feedback items.
- The first execution step should be S0 verification, not implementation, because several items were marked as review-needed from repo inspection only.
