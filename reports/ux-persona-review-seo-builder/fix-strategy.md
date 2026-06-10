# Fix Strategy — SEO Page Builder UX Review (issue-fix-strategy output, 2026-06-10)

Source: persona review at `reports/ux-persona-review-seo-builder/` (UX-REVIEW.md / .html, final-findings.json).
Status: triage COMPLETE, accepted by James. Next step: `/feature-graph-plan` for slug `seo-builder-ux-fixes`
(execution continues under `/feature-orchestrator`). Issue IDs below must map to graph nodes.

Context facts: business is US WEST COAST — Pacific Time is CORRECT (a timezone finding was withdrawn;
see final-findings.json WITHDRAWN-1). Branch at review time: ux-review-fixes. Dev auth bypass active.

## Executive call

43 findings collapse into 12 work items. Five of six P0s are one disease — the publish/schedule machinery
does the work but lies about its state — clustered in `SeoPublishPanel.tsx` / `SeoReadinessPanel.tsx` /
`useSeoPageEditorController.ts`. Sixth P0 (redirects) is missing server actions, not polish.
`scheduled_publish_at/status/error` columns already exist → I2 is a display/state-round-trip fix, not a data fix.

## Issues

### Wave 1 — "Tell the truth" (publish path) + redirects

- **I1 (P0)** Publish blocker communication overhaul: one canonical blocker list → persistent plain-language
  checklist in SeoPublishPanel; every blocker visible at once; human names ("Add a headline to the Hero
  section"); each item deep-links/opens its field incl. the block-settings modal (CTA destination URL);
  chip/panel/disabled-button all read from the one list; aria-describedby + live region on Publish.
  Covers report P0-1, P0-3, P1-1, P1-3 (+ largely P2 placeholder-cues I19). Must not regress: readiness
  rules themselves. Proof: Vitest on blocker derivation; Playwright blank-page→publish journey; axe pass.
- **I2 (P0)** Schedule status honesty: (a) bug — saved scheduledPublishAt not round-tripped into form state
  (useSeoPageEditorController/SeoPublishPanel), field re-renders empty; (b) render "Scheduled to publish
  {dt} (Pacific Time)" + inline Cancel + failed-state from scheduled_publish_status/error in Publish Status
  card; surface control out of Advanced burial. DO NOT change timezone. Must not regress:
  seo-page-scheduler.ts runner (reworked June), cancel semantics. Proof: round-trip Vitest; Playwright
  set→see→cancel→cleared; failed-schedule visible.
- **I3 (P0)** Publish success state: dismiss confirm card on success; render success block with "Open live
  page" (route_path), shown once route responds (handles ~seconds of 404 after publish). Must not regress:
  confirm step before every publish. Proof: Playwright publish → card gone → live link works; re-publish
  requires fresh confirm.
- **I4 (P0, RISKY SURFACE — customer-visible routing, destructive)** Redirect CRUD: deleteRedirect (+ edit
  or enable/disable) server actions w/ Zod + confirm dialogs in `src/app/admin/pages/redirects/actions.ts`
  - row UI; inline plain-language validation errors ("Start the path with /, e.g. /resources/old-page"),
    preserve values on error. Acceptance-by-cleanup: delete the 3 stuck test redirects
    (/resources/ux-old-test-1781071681847, /resources/ux-old-test-1781071765035,
    /resources/ux-explore-old-1781071765035) via the new UI. Must not regress: live redirect resolution,
    301/302/307/308 semantics, proxy/middleware behaviour (proxy intercepts builder routes — known learning).
- **I5 (P0)** Unsaved-exit / orphan drafts: "Start building" creates row immediately + autosave persists
  typing → ghost drafts; no unsaved-changes warning. RECOMMENDED DEFAULT (confirm at intake): keep
  create-on-start; add navigation/beforeunload guard (Save draft / Discard draft / Keep editing) where
  Discard deletes the never-explicitly-saved auto-row; visible "Draft created" notice at editor open.
  Alternative (defer creation to first save) breaks autosave/preview-token assumptions — not recommended.
- **I6 (P1)** Autosave failure surfacing: failed autosave (real console error "seo page autosave failed
  TypeError: Failed to fetch") must flip indicator to visible "Couldn't save — retrying / Save manually"
  - retry w/ backoff (useSeoPageEditorController, editor-autosave-payload has tests — extend). Bundle:
    dedupe doubled "Draft saved" toasts.

### Wave 2 — visibility & safety nets

- **I7 (P1)** Pages-list Readiness/Status dots get visible text labels or legend (accessible names already exist — markup/layout only).
- **I8 (P1)** Fix aria-prohibited-attr (serious axe): span[aria-label="Hero block"/"FAQ block"] — move name to focusable wrapper or permitted role. Proof: axe clean.
- **I9 (P1)** Draft revisions before first publish: snapshot on every manual Save draft reusing page_revisions
  (+revision_type), prune keep-last-20 (confirm retention at intake). Must not regress: publish revisions, restore flow.
- **I10 (P2)** Mobile editor: sticky action bar (Save/Publish/status) + collapsible SEO panel at small widths.
- **I11 (P2)** Jargon sweep: Eyebrow→"Overline (eyebrow)", Slug→"URL ending (slug)", expand CTA, Governance,
  workflow filter labels, redirect status copy words-first. One copy pass across editor+list+redirects.
- **I12 (P2)** A11y batch: tab order (SEO fields are stops 28–33 behind page preview → skip-links,
  de-tabbed preview chrome), landmark fixes (dup main on revision page, nested complementary, dup wizard
  regions), focusable nextjs-portal w/o outline, red-only Archive cue, tiny eye/move targets.
- **I13 (P2)** Duplicate-page slug: derive {source-slug}-copy-n instead of draft-{hash}.

### Wave 3 — structure & polish

- **I14 (P2)** SEO panel info-dump → verdict + "fix next" summary, tabs for governance/comments. AFTER I1 (I1 reshapes panel).
- **I15 (P2)** Collapse 3-step create wizard to one step.
- **I16 (P2)** Keyboard shortcuts: Cmd+S save, Cmd+Enter publish, "/" block picker.
- **I17 (P2)** Quick Tour → opt-in (check against prior tour-positioning fix).
- **I18 (P2)** Revision page: proper version labels, fix AM/PM display mismatch vs editor, richer context.
- **I20 (P3 batch)** bulk select; Help/support link; truncated "Schedule faile…" label; no-results CTA
  balance; avatar FAB overlaps Sign out; share-menu stays open; preview-URL trust copy; thin-page publish
  warning; canvas renders public chrome confusion; create-gate hydration flakiness; dev-page (block-preview-audit) note.

(I19 folded into I1 acceptance.)

## Wave-1 write-boundary warning

I1, I2, I3, I6 all touch SeoPublishPanel.tsx + useSeoPageEditorController.ts — NOT parallel-safe;
chain or merge these nodes. I4 (redirects) and I5 (new-page flow) are disjoint and can run parallel.

## Open intake decisions (defaults labelled, neither blocks planning)

1. I5: keep create-on-start + guard + discard-deletes-auto-row (DEFAULT) vs defer creation to first save.
2. I9: revision per manual save, keep-last-20 prune (DEFAULT) — confirm retention.

## Proof benchmark

After fixes, re-run publish + schedule journeys (currently 1.2 and 1.3 /5); target ≥3.5 behaviour:
all blockers visible upfront, schedule visibly confirmed.
