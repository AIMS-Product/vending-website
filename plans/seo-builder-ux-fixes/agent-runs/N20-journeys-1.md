# Agent Run: N20 — Journey + Axe Evidence (proof half)

Status: DONE (evidence only — no source edits)

Environment: dev server `next dev -p 3001`, `ADMIN_DEV_AUTH_BYPASS` active. HEAD 39b5301.
Artifacts: `plans/seo-builder-ux-fixes/agent-runs/n20-results.json` (create/schedule/axe/cleanup + upfront publish observation), `n20-publish-results.json` (full publish completion), `n20-screens/` (43 screenshots), runner scripts `n20-proof.mjs` + `n20-publish.mjs`.

Note on harness: the SEO panel was reorganized by N12 into **Readiness/Settings tabs**, and the N13 one-step create gate mounts the editor in place at `/admin/pages/new` (URL is `replaceState`'d to the real id only after the first auto-create). My first runner passes mis-scored because the harness was on the wrong tab/mount — those were harness gaps, corrected; none were app failures. All scores below are from the corrected runs.

---

## JOURNEY 1 — PUBLISH (benchmark original: 1.2/5)

Original failure points (from journey-results.json / journeys2.mjs): blockers surfaced one-at-a-time; hover-only tooltips; no success feedback; no "Open live page" link (dead-link window); publish stayed disabled / 404 live route.

| #   | Step                                | Evidence (screenshot)                     | Result vs original                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Observe publish panel BEFORE acting | `publish-01-observe-blockers-upfront.png` | **ALL blockers visible at once**: panel shows "Before you can publish — 3 to fix" listing _Add an SEO title [Go to field]_, _Add a meta description [Go to field]_, _Add a call-to-action/hero button/lead form [Show in page]_, PLUS a verdict "Not ready — 3 things to fix · Fix next: Add an SEO title [Take me there]". Counted **3 blockers + 8 deep-link/fix affordances** simultaneously. FIXES the one-at-a-time + hover-only failure. |
| 2   | Resolve via fields/blocks           | `publishB-03/04/05`                       | Added hero (satisfies CTA/hero/lead-form), filled hero heading + CTA label + CTA destination, SEO title, meta. Publish became enabled.                                                                                                                                                                                                                                                                                                         |
| 3   | Click Publish                       | `publishB-06`                             | Publish was enabled (not disabled).                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | Confirm step                        | `publishB-07`                             | **Confirm step shown** — publish is gated, not instant.                                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | Success block                       | `publishB-08-confirm-publish.png`         | **"Changes published." toast + green "Published — This page is now the live public version." block with "Open live page" button.** FIXES "no success feedback".                                                                                                                                                                                                                                                                                |
| 6   | Open live page                      | `publishB-09 / publishB-live-tab`         | **"Open live page" link present**, opened a live tab. FIXES the missing-link friction.                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Live route 200                      | `publishB-10`                             | **Live route returned HTTP 200.** FIXES the 404 dead-link window.                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Re-publish requires fresh confirm   | `publishB-11`                             | **Re-publish re-opens a fresh confirm step** (confirm state lives in the controller; publish dismisses it).                                                                                                                                                                                                                                                                                                                                    |

Per-failure-point scorecard (original → now):

- Blockers one-at-a-time → **FIXED** (all 3 shown upfront with deep links + verdict).
- Hover-only tooltip → **FIXED** (blockers are persistent list items with visible "Go to field"/"Show in page" actions, not hover tooltips).
- No success feedback → **FIXED** (toast + green Published block).
- Dead-link window (no link / 404) → **FIXED** ("Open live page" + live 200; re-publish re-confirms).

**PUBLISH SCORE: 4.5 / 5** (original 1.2). One residual: a hero with an empty body publishes as thin content (panel warns "very little content … about 0 words"), so a clean live render still requires the author to add body copy — minor, and the app explicitly warns. **Benchmark ≥3.5-equivalent: PASS** — all blockers visible upfront.

---

## JOURNEY 2 — SCHEDULE (benchmark original: 1.3/5)

Original failure points: schedule field buried in "SEO panel → Advanced SEO governance"; no "Scheduled for …" indicator after saving.

| #   | Step                                           | Evidence                                     | Result vs original                                                                                                                                                                                        |
| --- | ---------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open editor                                    | `schedule-01-open-editor.png`                | ok                                                                                                                                                                                                        |
| 2   | Schedule control reachable WITHOUT Advanced    | `schedule-02-…png`                           | **Schedule field is on the Settings tab and NOT inside the Advanced `<details>`** (`visibleOnSettingsTab: true; insideAdvancedDetails: false`). FIXES the buried-field failure.                           |
| 3   | Set schedule                                   | `schedule-03-…png`                           | filled `2026-06-11T12:00`.                                                                                                                                                                                |
| 4   | Save                                           | `schedule-04-…png`                           | saved.                                                                                                                                                                                                    |
| 5   | Scheduled indicator visible + Pacific-labelled | `schedule-05-verify-scheduled-indicator.png` | **"Scheduled to publish — Jun 11, 2026, 12:00 PM PDT (Pacific Time)"** with explanatory copy + "Cancel scheduled publish" button; status chip "Scheduled". `Pacific-labelled=true`. FIXES "no indicator". |
| 6   | Reload persists                                | `schedule-06-…png`                           | after reload: field=`2026-06-11T12:00`, indicator still present.                                                                                                                                          |
| 7   | Cancel inline                                  | `schedule-07-…png`                           | "Cancel scheduled publish" clicked.                                                                                                                                                                       |
| 8   | Visibly cleared                                | `schedule-08-verify-cleared.png`             | field empty + scheduled indicator gone after reload.                                                                                                                                                      |

Per-failure-point scorecard:

- Field buried in Advanced → **FIXED** (top-level on Settings tab, not in Advanced).
- No scheduled indicator → **FIXED** (explicit Pacific-Time confirmation card).
- (New goals) reload-persist + inline cancel + visible clear → all PASS.

**SCHEDULE SCORE: 5 / 5** (original 1.3). **Benchmark "schedule visibly confirmed": PASS.**

---

## AXE SWEEP (target: 0 serious/critical)

| Page                                           | critical | serious | moderate | minor | Notes                                                                            |
| ---------------------------------------------- | -------: | ------: | -------: | ----: | -------------------------------------------------------------------------------- |
| Editor (`/admin/pages/{id}`)                   |        0 |   **1** |        1 |     0 | serious=`color-contrast`; moderate=`heading-order`                               |
| Pages list (`/admin/pages`)                    |        0 |       0 |        0 |     0 | clean                                                                            |
| Redirects (`/admin/pages/redirects`)           |        0 |       0 |        0 |     0 | clean                                                                            |
| Revisions list (`/admin/pages/{id}/revisions`) |        0 |       0 |        0 |     0 | clean                                                                            |
| Revision detail                                |        — |       — |        — |     — | no revision row existed on the throwaway page to open; not scanned (see anomaly) |

**One serious axe finding on the editor — does NOT meet the "0 serious" target.** Details (report-only):

- `color-contrast` (serious, 1 node): the editor caption "Preview of the public page — edit the content blocks below" — `text-slate-500` (#62748e) on `bg-slate-100` (#f1f5f9) at 11px renders **4.34:1**, just under the 4.5:1 AA threshold. Decorative caption, not interactive.
- `heading-order` (moderate, 1 node): a heading level is skipped in the editor chrome.

---

## CLEANUP PROOF

Throwaway rows created during proof: `2618c2f4` (N20 Proof Page, draft), `55b0ca77` + `…785679` (N20 Publish, published then archived), `…probe9` (create-flow validation). All archived.

Final state query across every non-archived filter:

- `status=active&q=N20` → `[]`
- `status=draft&q=N20` → `[]`
- `status=published&q=N20` → `[]`
- `status=archived&q=N20` → 4 rows (terminal cleaned state)
- Published throwaway's public route `/resources/n20-publish-…` → **HTTP 404** after cleanup (no longer served publicly).

**Zero active throwaway rows remain.**

---

## ANOMALIES (report-only — no fixes applied)

1. **Editor color-contrast (serious axe).** The "Preview of the public page…" caption is 4.34:1 vs the 4.5:1 AA minimum. Borderline; on a decorative label. Recommend darkening to `text-slate-600`. (N17 a11y batch territory — surfaced here because the editor was scanned with content.)
2. **Editor heading-order (moderate axe).** A skipped heading level in editor chrome.
3. **Revision detail not axe-scanned.** A freshly created+published throwaway page had no revision row exposing a `/revisions/{id}` link in the list at scan time, so the detail page couldn't be opened for axe. The revisions _list_ scanned clean (0/0/0/0). Recommend a follow-up scan of a revision detail page on a page with manual-save revisions if the proof requires that specific surface.
4. **Thin-content publish.** A hero with empty body publishes (with the app's explicit "very little content" warning); live route is 200 but renders ~150 chars. Expected behavior, noted for completeness.

---

## VERDICTS (be adversarial)

- **Publish journey: PASS vs benchmark** (1.2 → ~4.5). All blockers visible upfront with deep links + verdict; gated confirm; success feedback; Open-live-page link; live 200; re-confirm on re-publish.
- **Schedule journey: PASS vs benchmark** (1.3 → 5). Reachable without Advanced; Pacific-Time confirmation; persists; inline cancel clears.
- **Axe: NOT fully clean** — 1 serious (color-contrast) + 1 moderate (heading-order) on the editor; the other three scanned surfaces are 0/0/0/0. This is the one item that does not meet the stated "0 serious" target and should be weighed before declaring COMPLETE.
- **Cleanup: PASS** — zero active throwaway rows; published throwaway is archived and its public route 404s.
