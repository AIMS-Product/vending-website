# UX Persona Review — SEO Page Builder (scoped)

App: Vendingpreneurs website — SEO Page Builder (`/admin/pages` + published output)
URL: http://localhost:3000 (branch `ux-review-fixes`, dev auth bypass)
Date: 2026-06-10
Pages tested: 8 | Journeys executed: 7 | Interactions: ~80 (22 inventoried + journey clicks)
Screenshots captured: 126 | Raw persona findings: 213 → 43 unique issues
Personas: 15 (parallel, independent) + 2 evidence verifiers

Note: this run is scoped to the SEO page builder only (user instruction). The June 10 full-app
review remains at `reports/ux-persona-review/UX-REVIEW.md`; this report intentionally lives in
its own directory.

---

## Executive Summary

- Total unique issues: **43**
- P0 Critical: **6** | P1 High: **6** | P2 Medium: **15** | P3 Low: **16**
- Blockers (capability gaps): **3**
- Discarded in verification: **0** (5 demoted in severity, 1 mechanism corrected)
- Average overall gut feel: **≈2.2 / 5** (range 1.5–3)

The builder's bones are good — the create-page wizard, block picker, token-based draft preview,
and the published output all score well, and several personas rated the preview flow the best
moment in the product (avg 4.0/5). But the two highest-stakes flows are the two worst: **publishing**
(avg 1.2/5 — a whack-a-mole chain of one-at-a-time blockers in internal naming, one of them pointing
at a field that isn't on the screen, ending in a confirm card that never dismisses) and **scheduling**
(avg 1.3/5 — saves with zero confirmation). Add undeletable redirects and an
unsaved-exit path that silently manufactures orphan drafts, and the pattern is consistent: the tool
does the work but doesn't tell the truth about state, exactly where trust matters most.

---

## Journey Results

| Journey                | Avg Score | Completion                      | Clicks | Biggest Friction Point                                                                |
| ---------------------- | --------- | ------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| create-first-page      | 2.7       | completed-with-friction         | 13     | 3-step gate + tour overlay + all-placeholder canvas before any typing                 |
| publish-and-view-live  | **1.2**   | completed-with-friction (heavy) | ~12    | Blockers drip-fed one at a time; required field hidden in a modal; stale confirm card |
| preview-draft          | **4.0**   | completed                       | 1      | None — the model flow                                                                 |
| revision-restore       | 2.2       | completed-with-friction         | 4      | No revisions exist until first publish — no drafting undo                             |
| schedule-publish       | 1.3       | completed-with-friction         | 5      | Saves silently; field re-renders empty; no status anywhere                            |
| create-redirect        | 2.8       | completed                       | 2      | Created redirects can never be edited or deleted                                      |
| find-duplicate-archive | 2.9       | completed-with-friction         | 8      | Junk duplicate slug; per-row-only archive; colour-dot statuses                        |

**Verdicts.** A user can create, preview, and (eventually) publish a page — but publishing requires
solving a serial riddle that 14/15 personas flagged and several said they would abandon ("This is
where I'd literally throw my phone" — Zoe; "the one that would make me phone someone" — Tom).
Scheduling cannot be trusted because the UI never confirms it took effect — Karen's persona premise
("my scheduled page never went live and I don't know why") turned out to be exactly reproducible.
Preview is excellent. Redirects work but are permanent. Revision restore works only after first publish.

---

## Blockers (capability gaps that prevented testing)

| #   | Page/Feature           | What's Missing                                                                            | Personas Affected |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| 1   | /admin/pages/redirects | No edit/delete for redirects — removal untestable; test redirects could not be cleaned up | 11                |
| 2   | Editor — revisions     | No revisions while drafting — pre-publish undo untestable because it doesn't exist        | 9                 |
| 3   | Editor — schedule      | No schedule status indicator — whether a schedule persisted is unverifiable from the UI   | 15                |

---

## P0 — Critical Issues

| #   | Page       | Category         | Issue                                                                                                                                                            | Personas | Suggested Fix (current → proposed)                                                                          |
| --- | ---------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | editor     | Feedback & State | **Publish blockers revealed one at a time** in internal naming ('Fix content 1 · Cta Label'); total work never visible                                           | 14/15    | Rotating chip → persistent plain-language checklist of ALL blockers, each deep-linking to its field         |
| 2   | editor     | Feedback & State | **Scheduling saves silently** — field re-renders empty, no 'Scheduled for…' status anywhere                                                                      | 15/15    | Cleared field → keep value + persistent "Scheduled to publish {date} ({tz})" status with cancel             |
| 3   | editor     | Forms & Input    | **Publish-required CTA destination URL exists only in the Block-settings modal**; blocker gives no location                                                      | 12/15    | Unlocatable field → blocker deep-links/opens the modal; surface destination inline on the block             |
| 4   | editor     | Feedback & State | **'Confirm publish' card stays open after success**, re-asking to publish ("This will replace the current live version…")                                        | 12/15    | Persistent confirm card → dismiss on success, replace with success state + "Open live page" link            |
| 5   | redirects  | Trust & Safety   | **Redirects can't be edited or deleted** — a typo'd 301 is permanent (and 301s get cached by browsers/search)                                                    | 11/15    | No row actions → Edit + Delete (confirmed) per row                                                          |
| 6   | new/editor | Trust & Safety   | **Leaving an unsaved editor gives no warning — and silently creates an orphan draft** (verified: typed probe content persisted as a draft page nobody asked for) | 10/15    | Silent nav + ghost drafts → unsaved-changes prompt (Save/Discard/Stay); never persist without explicit save |

## P1 — High Priority

| #   | Page       | Category         | Issue                                                                                                                                                                 | Personas             | Suggested Fix                                                |
| --- | ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| 7   | editor     | Copy & Labels    | Publish-gate messaging contradicts itself — chip 'Fix SEO title', panel 'Add a hero headline', field placeholder 'Leave blank to use page headline', all in one frame | 8/15                 | One source of truth naming the actual missing field          |
| 8   | editor     | Feedback & State | Autosave fails silently — 'seo page autosave failed TypeError: Failed to fetch' console-only                                                                          | 1/15 (verified real) | Visible "Autosave failed" banner + retry                     |
| 9   | editor     | Accessibility    | Disabled Publish exposes no programmatic reason (blocker text not associated)                                                                                         | 2/15                 | aria-describedby to blocker list + live-region announcements |
| 10  | pages list | Visual & Layout  | Readiness/Status are colour-only dots, no visible labels or legend (visual issue; dots do have accessible names)                                                      | 11/15                | Dot + visible text label                                     |
| 11  | editor     | Accessibility    | aria-prohibited-attr (serious axe): aria-label on Hero/FAQ block spans is dropped by assistive tech                                                                   | 5/15                 | Move accessible name to a proper role/control                |
| 12  | editor     | Trust & Safety   | No revisions until first publish — no page-level undo while drafting                                                                                                  | 9/15                 | Snapshot revision on each manual save                        |

## P2 — Medium Priority

| #   | Page          | Category      | Issue                                                                                                    | Personas | Suggested Fix                                       |
| --- | ------------- | ------------- | -------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| 14  | editor        | Navigation    | No 'Open live page' link after publish (Share→Copy URL hidden in dropdown); URL 404'd on immediate polls | 6/15     | Live link in success state; debounce until live     |
| 15  | editor        | Visual        | Mobile (375px): one marathon scroll, Save/Publish detached from content, no mobile layout                | 2/15     | Sticky mobile action bar + collapsible panel        |
| 16  | redirects     | Forms         | Error 'Path must be root-relative.' is jargon, top-banner placement, clears entered values               | 6/15     | Plain-language inline error, preserve values        |
| 17  | editor        | Forms         | All-placeholder canvas with no required-to-publish cues                                                  | 6/15     | Mark publish-required fields; empty-state checklist |
| 18  | editor        | Visual        | SEO panel information dump (7 stacked sections, 8 score rows, 7 action items)                            | 5/15     | Verdict + next-fix summary; tabs for governance     |
| 19  | new           | Navigation    | 3-step wizard (step 3 is review-only) before any content entry                                           | 3/15     | Collapse to one step                                |
| 20  | editor        | Navigation    | No keyboard shortcuts (save/publish/insert)                                                              | 1/15     | Cmd+S / Cmd+Enter / '/' picker                      |
| 21  | editor        | Navigation    | Forced 'Quick Tour' overlay covers canvas on first open                                                  | 1/15     | Opt-in tour                                         |
| 22  | builder-wide  | Copy          | Unexplained jargon: 'Eyebrow', 'Slug', 'CTA', 'Governance comments'                                      | 6/15     | Plain-language labels/expansions                    |
| 23  | editor        | Accessibility | SEO form fields are tab stops 28–33, behind the whole rendered preview                                   | 1/15     | Skip-links; non-tabbable preview chrome             |
| 24  | multiple      | Accessibility | Landmark violations (nested complementary; duplicate main on revision page; duplicate wizard regions)    | 2/15     | Normalise landmarks                                 |
| 25  | all pages     | Accessibility | Focusable nextjs-portal with no visible focus indicator                                                  | 1/15     | Remove from tab order                               |
| 26  | shell         | Visual        | 'N' avatar FAB overlaps Sign out button on every page                                                    | 2/15     | Reposition FAB                                      |
| 27  | pages list    | Forms         | Duplicate generates junk slug 'draft-4020bd0f'                                                           | 5/15     | Derive '{source}-copy'                              |
| 28  | revision page | Copy          | Sparse revision preview: lone lowercase 'publish' label; AM/PM time mismatch vs editor                   | 3/15     | Labelled versions, consistent timezone              |

## P3 — Low Priority

| #   | Issue                                                                             | Persona(s)        |
| --- | --------------------------------------------------------------------------------- | ----------------- |
| 29  | No bulk select on pages list                                                      | Marcus, Mike, Tom |
| 30  | No help/support/docs link anywhere in the builder                                 | Karen             |
| 31  | 'Schedule failed' filter label truncates ('Schedule faile…')                      | Karen             |
| 32  | Destructive 'Archive page' menu item distinguished by red text alone              | David             |
| 33  | Icon-only eye/move controls below comfortable target size                         | David, Betty      |
| 34  | Workflow filter jargon ('Needs links', 'Updating', 'Metadata issues')             | Yuki, Priya       |
| 35  | Dev QA route /admin/pages/block-preview-audit exposed unexplained (dev-env only)  | 4 personas        |
| 36  | Editor canvas renders full public nav/footer as editable-looking content          | Jake              |
| 37  | Three inconsistent toast/save-confirmation treatments incl. doubled 'Draft saved' | Claire, Alex      |
| 38  | Share dropdown doesn't close during unrelated interactions                        | Claire            |
| 39  | Redirect status copy leads with codes ('301', '307')                              | Betty, Zoe        |
| 40  | Preview token URL reads as a suspicious scramble to non-technical users           | Betty             |
| 41  | Row URLs in tiny grey monospace read as 'computer errors'                         | Betty             |
| 42  | No-results state: huge 'Create page' vs tiny 'Clear search'                       | Claire            |
| 43  | Create-gate click target flaky (30s automation timeout — possible hydration race) | Alex              |
| 44  | Thin published page ships with no 'looks empty' warning                           | Betty             |

---

## Page-by-Page Gut Feel

| Page                       | Avg  | Range | Notes                                                             |
| -------------------------- | ---- | ----- | ----------------------------------------------------------------- |
| /admin/pages (list)        | ~3.2 | 2–4   | Best-understood surface; dots and jargon filters drag it down     |
| /admin/pages/new (wizard)  | ~3.8 | 3–5   | Sam: 5/5 "friendly"; Claire: best-designed surface in the product |
| /admin/pages/[id] (editor) | ~2.1 | 1–3   | Where every serious issue lives                                   |
| Revision preview           | ~2.8 | 2–3   | Works; sparse and disorienting                                    |
| /admin/pages/redirects     | ~2.3 | 1–4   | Great mobile form; undeletable rows poison trust                  |
| block-preview-audit        | ~2.5 | 2–3   | Dev tool; fine that it exists, unexplained that it's visible      |
| Published page (public)    | ~3.9 | 3–5   | Renders correctly at all viewports, clean                         |
| Token draft preview        | ~4.1 | 3–5   | Beats competitors' logged-in-only previews (Mike)                 |

## Category Breakdown

- **Feedback & State** — the dominant failure category: drip-fed blockers (#1), silent schedule (#2),
  stale confirm card (#4), silent autosave failure (#8), no live-link after publish (#14), toast chaos (#37).
- **Trust & Safety** — undeletable redirects (#5), orphan drafts on exit (#6), no drafting undo (#12).
- **Copy & Labels** — contradictory gate messaging (#7), internal naming and jargon (#22, #34, #39).
- **Forms & Input** — hidden required field (#3), value-clearing error states (#16), unmarked required fields (#17), junk duplicate slug (#27).
- **Visual & Layout** — colour-only dots (#10), mobile editor (#15), SEO panel overload (#18), avatar overlap (#26).
- **Accessibility** — aria-prohibited-attr (#11), unexplained disabled Publish (#9), tab-order burial (#23), landmarks (#24), portal focus (#25), red-text-only destructive cue (#32).
- **Navigation & Flow** — wizard ceremony (#19), no shortcuts (#20), forced tour (#21).

## Persona Highlights

| Persona                  | Findings | Most Concerned About                                                              |
| ------------------------ | -------- | --------------------------------------------------------------------------------- |
| Betty (Grandparent)      | 26       | "Hidden riddles" gating publish; ghost text she's afraid to touch; work vanishing |
| Marcus (Power User)      | 14       | Zero keyboard shortcuts; 13 clicks of ceremony before typing                      |
| Sam (First-Timer)        | 14       | Great wizard (5/5) betrayed by a 1/5 publish gate                                 |
| David (Accessibility)    | 12       | aria-prohibited-attr; unexplained disabled Publish; tab stops 28–33               |
| Yuki (Non-Native)        | 15       | 'Eyebrow'/'Cta' jargon; contradictory gate sentences                              |
| Rachel (Skeptic)         | 11       | Dishonest confirmations on the two highest-stakes actions; permanent 301s         |
| Jake (Mobile)            | 6        | Editor unusable at 375px; redirects form is the best mobile surface               |
| Claire (Perfectionist)   | 21       | Three contradictory readiness representations at once; no toast system            |
| Tom (Pragmatist)         | 16       | ~12 clicks + 4 dead ends to put one page live                                     |
| Zoe (Teenager)           | 16       | Whack-a-mole publishing; "Archive" sounds permanent with no un-archive            |
| Priya (Business Owner)   | 13       | One 10-minute window can't get a page published                                   |
| Alex (Developer)         | 17       | Dishonest save/publish/schedule state machine; silent autosave failure            |
| Victoria (Executive)     | ~10      | Cannot glance-verify that a scheduled page is scheduled                           |
| Mike (Competitor's User) | 13       | Token preview beats Webflow; redirects/scheduling below table stakes              |
| Karen (Angry User)       | 12       | Reproduced her own premise: schedules fail silently; no help link anywhere        |

## Screenshots Index (key references)

All in `screenshots/`. Highlights:

- `journey-publish-and-view-live-02-read-publish-blocker.png` — chip/panel/placeholder contradiction in one frame
- `journey-publish-and-view-live-09-after-publish.png` — "Changes published." + still-open confirm card
- `journey-publish-and-view-live-11-block-settings-modal.png` — the hidden required CTA destination field
- `journey-schedule-publish-05-verify-scheduled.png` — empty schedule field after save (open Share menu in this shot is a test artifact)
- `admin-pages-new-014-leave-unsaved.png` — orphan draft created by unsaved exit
- `admin-pages-redirects-002-full.png` — redirects table with no row actions
- `admin-pages-e44f0fc3-…-mobile.png` — editor at 375px
- `journey-publish-and-view-live-10-live-page.png` — published output rendering correctly

## Skipped Destructive Actions (safety policy)

| Page         | Action                                          | Reason                                                                        |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| /admin/pages | Duplicate/Publish/Archive on pre-existing pages | destructive/creation on pre-existing data — menu screenshotted only           |
| editor       | Remove content (block delete)                   | kept for exploration; flow screenshotted via menu                             |
| editor       | Revoke preview token                            | session-created but kept active for preview-page exploration (expires Jun 13) |
| redirects    | (deletion)                                      | impossible — no control exists (finding P0-5)                                 |

All destructive actions actually performed (archive ×3, duplicate, restore) targeted only
records created by this session.

## Discarded in Verification / Withdrawn

Verification adjustments: redirects blocker→critical; unsaved-exit blocker→critical with corrected
mechanism (content silently _persisted as orphan draft_, not lost); mobile-editor, colour-dots,
aria-prohibited demoted critical→high; colour-dots screen-reader claim corrected (dots have accessible
names — visual-only issue).

**Withdrawn after owner correction:** the "scheduling uses Pacific Time for an Australian business"
finding (11 personas) is withdrawn — Vendingpreneurs is a **US West Coast business**, so Pacific Time is
the correct timezone and the field's explicit timezone label is good practice. The silent-save scheduling
problem (P0-2) is unaffected and stands.

## Leftover Test Records (manual cleanup)

- 3 test redirects — **cannot be deleted via UI** (P0-5): `/resources/ux-old-test-1781071681847`,
  `/resources/ux-old-test-1781071765035`, `/resources/ux-explore-old-1781071765035` → remove via DB
  (`supabase` `seo_page_redirects`-equivalent table) when convenient.
- Archived pages (harmless, in Archived tab): "UX SEO Review Test 1781071765035 v2", its "Copy of…"
  duplicate, and "Unsaved data-loss probe (do not save)".
- One governance comment ("Test input for Comment…") on the archived test page.
- Active preview token on the archived page (auto-expires 2026-06-13).

## Next Steps

1. The P0 list is effectively one theme — make the publish/schedule state machine honest — plus
   redirects CRUD and the unsaved-exit guard.
2. Recommended flow: run `/issue-fix-strategy` on this report first — plain-English triage of each issue
   (what it is, why it matters, how to fix, proof needed, which workflow) — then let broad multi-slice
   work flow into `/feature-orchestrator` for tracked, dependency-ordered implementation.
3. Re-run this scoped review after fixes; journeys 2 and 5 are the regression benchmarks
   (current averages 1.2 and 1.3 — anything below 3.5 after a fix round means the gate logic
   still isn't communicating).
