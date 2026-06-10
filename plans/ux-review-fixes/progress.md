# Feature Progress: ux-review-fixes

Status: IN_PROGRESS
Current wave: W3
Last updated: 2026-06-10
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                  | Tier | Depends On | Parallel Group | Owner        | Status  |
| ---- | -------------------------------------- | ---- | ---------- | -------------- | ------------ | ------- |
| N1   | Admin sidebar Blog/News link           | T3   | none       | W1-A           | w-n1         | DONE    |
| N2   | Lead form success states               | T1   | none       | W1-B           | w-n2         | DONE    |
| N3   | Hero stats SSR real values             | T3   | none       | W1-C           | w-n3         | DONE    |
| N4   | Quick Tour reposition                  | T3   | none       | W1-D           | w-n4         | DONE    |
| N5   | Form validation + "Not sure yet"       | T2   | N2         | W2-A           | w-n5         | DONE    |
| N6   | Redirects link + menu verify + archive | T3   | none       | W2-B           | w-n6         | DONE    |
| N7   | Public News naming                     | T3   | none       | W2-C           | w-n7         | DONE    |
| N8   | /blog 301 → /news                      | T2   | none       | W2-D           | w-n8         | DONE    |
| N9   | Mobile h-scroll + H1 break             | T3   | N7         | W3-A           | TBD          | PENDING |
| N10  | News image fallback + CLS              | T3   | N7         | W3-B           | TBD          | PENDING |
| N11  | Admin P2 sweep                         | T3   | N1,N4,N6   | W3-C           | TBD          | PENDING |
| N12  | Public a11y sweep                      | T3   | N9         | W4-A           | TBD          | PENDING |
| N13  | P2 remainder triage                    | T3   | N9,N10,N11 | W4-B           | TBD          | PENDING |
| N14  | Final proof                            | —    | all        | W5             | orchestrator | PENDING |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                     | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ---------------------------- | ---------- |
| N1   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n1-1.md           | 95         |
| N2   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | agent-runs/n2-1.md           | 92         |
| N3   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n3-1.md           | 95         |
| N4   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n4-1.md           | 90         |
| N5   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | agent-runs/n5-1.md           | 92         |
| N6   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n6-1.md           | 95         |
| N7   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/n7-1.md           | 95         |
| N8   | DONE | DONE  | DONE     | DONE      | n/a          | DONE          | agent-runs/n8-1.md + n8-2.md | 93         |
| N9   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none                         | TBD        |
| N10  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none                         | TBD        |
| N11  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none                         | TBD        |
| N12  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none                         | TBD        |
| N13  | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none                         | TBD        |
| N14  | n/a  | n/a   | n/a      | TODO      | TODO         | TODO          | none                         | TBD        |

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |
| —    | none    | —                             |

## Completed Evidence

- W2 (2026-06-10): N5-N8 integrated. N8 needed an orchestrator attempt-2: proxy.ts intercepted /blog/\* before the page-level redirect could run (see agent-runs/n8-2.md). Fresh evidence: vitest 416/416, tsc clean, live curls (308 chain, junk 404), /news shows zero "Blog" copy, row-menu verification CLOSED (works on normal click), test SEO page ARCHIVED via UI, 5 more test+uxfix lead rows deleted.

- W1 (2026-06-10): N1-N4 integrated. Fresh orchestrator evidence: vitest 400/400, tsc clean, SSR homepage shows 500+/3,000+ with zero >0+< spans, /admin/pages HTML contains "Blog and news". 7 test+uxfix-\* lead rows deleted post-verification. Reports: agent-runs/n{1..4}-1.md; screenshots agent-runs/shots/.
