# Feature Progress: ux-review-fixes

Status: IN_PROGRESS
Current wave: W2
Last updated: 2026-06-10
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                  | Tier | Depends On | Parallel Group | Owner        | Status      |
| ---- | -------------------------------------- | ---- | ---------- | -------------- | ------------ | ----------- |
| N1   | Admin sidebar Blog/News link           | T3   | none       | W1-A           | w-n1         | DONE        |
| N2   | Lead form success states               | T1   | none       | W1-B           | w-n2         | DONE        |
| N3   | Hero stats SSR real values             | T3   | none       | W1-C           | w-n3         | DONE        |
| N4   | Quick Tour reposition                  | T3   | none       | W1-D           | w-n4         | DONE        |
| N5   | Form validation + "Not sure yet"       | T2   | N2         | W2-A           | w-n2         | IN_PROGRESS |
| N6   | Redirects link + menu verify + archive | T3   | none       | W2-B           | TBD          | PENDING     |
| N7   | Public News naming                     | T3   | none       | W2-C           | TBD          | PENDING     |
| N8   | /blog 301 → /news                      | T2   | none       | W2-D           | TBD          | PENDING     |
| N9   | Mobile h-scroll + H1 break             | T3   | N7         | W3-A           | TBD          | PENDING     |
| N10  | News image fallback + CLS              | T3   | N7         | W3-B           | TBD          | PENDING     |
| N11  | Admin P2 sweep                         | T3   | N1,N4,N6   | W3-C           | TBD          | PENDING     |
| N12  | Public a11y sweep                      | T3   | N9         | W4-A           | TBD          | PENDING     |
| N13  | P2 remainder triage                    | T3   | N9,N10,N11 | W4-B           | TBD          | PENDING     |
| N14  | Final proof                            | —    | all        | W5             | orchestrator | PENDING     |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence           | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ------------------ | ---------- |
| N1   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n1-1.md | 95         |
| N2   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | agent-runs/n2-1.md | 92         |
| N3   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n3-1.md | 95         |
| N4   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n4-1.md | 90         |
| N5   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none               | TBD        |
| N6   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N7   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N8   | TODO | TODO  | TODO     | TODO      | n/a          | TODO          | none               | TBD        |
| N9   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N10  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N11  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N12  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N13  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| N14  | n/a  | n/a   | n/a      | TODO      | TODO         | TODO          | none               | TBD        |

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |
| —    | none    | —                             |

## Completed Evidence

- W1 (2026-06-10): N1-N4 integrated. Fresh orchestrator evidence: vitest 400/400, tsc clean, SSR homepage shows 500+/3,000+ with zero >0+< spans, /admin/pages HTML contains "Blog and news". 7 test+uxfix-\* lead rows deleted post-verification. Reports: agent-runs/n{1..4}-1.md; screenshots agent-runs/shots/.
