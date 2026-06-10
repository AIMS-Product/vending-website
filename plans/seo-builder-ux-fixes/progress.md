# Feature Progress: seo-builder-ux-fixes (round 2)

Status: READY
Current wave: W0
Last updated: 2026-06-10
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                 | Issues  | Tier   | Depends On   | Parallel Group | Owner        | Status  |
| ---- | ------------------------------------- | ------- | ------ | ------------ | -------------- | ------------ | ------- |
| N0   | Pre-flight: commit review artifacts   | —       | ops    | none         | W0 (single)    | orchestrator | PENDING |
| N1   | Canonical publish-blocker checklist   | I1, I19 | T1     | N0           | W1-A 1/4       | unassigned   | PENDING |
| N2   | Schedule status honesty               | I2      | T1     | N1           | W1-A 2/4       | unassigned   | PENDING |
| N3   | Publish success state                 | I3      | T2     | N2           | W1-A 3/4       | unassigned   | PENDING |
| N4   | Autosave failure surfacing + dedupe   | I6      | T2     | N3           | W1-A 4/4       | unassigned   | PENDING |
| N5   | Redirect CRUD (risky surface)         | I4      | T1     | N0           | W1-B           | unassigned   | PENDING |
| N6   | Unsaved-exit guard / orphan drafts    | I5      | T2     | N0           | W1-C           | unassigned   | PENDING |
| N7   | Pages-list status labels/legend       | I7      | T3     | W1 int.      | W2-A           | unassigned   | PENDING |
| N8   | aria-prohibited-attr fix              | I8      | T2     | W1 int.      | W2-B           | unassigned   | PENDING |
| N9   | Manual-save revisions + prune         | I9      | T2     | W1 int.      | W2-C 1/2       | unassigned   | PENDING |
| N10  | Duplicate slug -copy-n                | I13     | T3     | N9           | W2-C 2/2       | unassigned   | PENDING |
| N11  | Mobile sticky bar + collapsible panel | I10     | T3     | W1 int.      | W2-D           | unassigned   | PENDING |
| N12  | SEO panel verdict + tabs              | I14     | T3     | W2 int.      | W3-A           | unassigned   | PENDING |
| N13  | One-step create wizard                | I15     | T3     | W2 int.      | W3-B           | unassigned   | PENDING |
| N14  | Keyboard shortcuts                    | I16     | T3     | W2 int.      | W3-C           | unassigned   | PENDING |
| N15  | Quick Tour opt-in                     | I17     | T3     | W2 int.      | W3-D           | unassigned   | PENDING |
| N16  | Revision page labels/AM-PM/context    | I18     | T3     | N9 + W2 int. | W3-E           | unassigned   | PENDING |
| N17  | A11y batch                            | I12     | T2     | N11, N16     | W4 1/3         | unassigned   | PENDING |
| N18  | Jargon/copy sweep                     | I11     | T3     | N17          | W4 2/3         | unassigned   | PENDING |
| N19  | P3 batch                              | I20     | T3     | N18          | W4 3/3         | unassigned   | PENDING |
| N20  | Final proof + verification.md         | all     | verif. | all          | W5             | orchestrator | PENDING |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | -------- | ---------- |
| N0   | n/a  | n/a   | n/a      | TODO      | n/a          | n/a           | none     | TBD        |
| N1   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N2   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none     | TBD        |
| N3   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N4   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N5   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none     | TBD        |
| N6   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none     | TBD        |
| N7   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N8   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N9   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none     | TBD        |
| N10  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N11  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N12  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N13  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N14  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N15  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N16  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N17  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N18  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N19  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none     | TBD        |
| N20  | n/a  | n/a   | n/a      | TODO      | TODO         | TODO          | none     | TBD        |

## Blockers

| Node   | Blocker | Required Decision Or Evidence                                                                                                          |
| ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| (none) | —       | First wave W1 unblocks as soon as N0 (git hygiene) completes. All intake decisions resolved with accepted defaults (see decisions.md). |

## Completed Evidence

- None yet.
