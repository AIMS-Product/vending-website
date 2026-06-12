# Feature Progress: website-builder-round-3-feedback

Status: COMPLETE
Current wave: FINAL
Last updated: 2026-06-12
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                         | Tier | Depends On | Parallel Group | Owner      | Status |
| ---- | --------------------------------------------- | ---- | ---------- | -------------- | ---------- | ------ |
| S1   | Published list bullet/number styling (I1)     | T3   | none       | W1-A           | worker-s1  | DONE   |
| S2   | Substring link selection (I2)                 | T3   | none       | W1-B           | worker-s2  | DONE   |
| S3   | Meta description 155 alignment + counter (I3) | T2   | none       | W1-C           | worker-s3  | DONE   |
| S4   | Outline up/down reorder (I4)                  | T3   | none       | W1-D           | worker-s4  | DONE   |
| S5   | Proof point imagery end-to-end (I5)           | T2   | none       | W2-A           | worker-s5  | DONE   |
| S7   | Importer truncation warning (I7)              | T3   | none       | W2-B           | worker-s7  | DONE   |
| S6a  | Route prefix settings table + admin UI (I6)   | T2   | none       | W3-A           | worker-s6a | DONE   |
| S6b  | Dynamic prefix route + lookup validation (I6) | T2   | S6a        | W4-A           | worker-s6b | DONE   |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence            | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ------------------- | ---------- |
| S1   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S1-1.md  | High       |
| S2   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S2-1.md  | High       |
| S3   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S3-1.md  | High       |
| S4   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S4-1.md  | High       |
| S5   | DONE | DONE  | DONE     | DONE      | DONE\*       | DONE          | agent-runs/S5-1.md  | High       |
| S7   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S7-1.md  | High       |
| S6a  | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | agent-runs/S6a-1.md | High       |
| S6b  | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none                | TBD        |

Browser gates run serially by the orchestrator at wave integration (shared dev
server; workers do code + repo gates only).

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |

## Completed Evidence

- W1 integration (2026-06-11, orchestrator): fresh repo gate over all four areas —
  `npm run test -- src/components/admin/seo-page-editor src/components/sections/resource-blocks src/lib/page-builder src/lib/admin src/app/admin/pages`
  62 files / 406 tests PASS; `npm run typecheck` clean; targeted eslint clean.
  Write-boundary audit clean (no forbidden files touched; home-v2 and
  Benefits/Testimonials diffs are pre-existing and excluded).
- S1: published page `/resources/vending-in-colleges` renders 3 `ul.list-disc`
  lists (was bare `list-outside`); screenshot `/tmp/r3-s1-public-bullets.png`.
  Render test red->green in `RichTextBlock.test.tsx`; checklist variant asserted
  unchanged.
- S2: editor browser proof on `/admin/pages/f7cf0260...`: "Link text" input with
  "Leave blank to link the whole paragraph" hint; non-matching text shows
  role=alert ("That text isn't in this paragraph...") with no data change; valid
  substring accepted silently. Screenshots `/tmp/r3-s2-error.png`,
  `/tmp/r3-s2-valid.png`. 13 helper tests + 3 render tests.
- S3: counter "116/155" visible in publish Settings tab; 200-char fill capped at
  155 (`/tmp/r3-s3-counter-visible.png`). Two-tier constants in
  `copy-standards.ts` (155 target / 180 legacy server ceiling); legacy 170-char
  save accepted, 181 rejected (test-certified). AI generation schemas capped 155;
  ai-chat request-context schema deliberately kept at legacy 180 (documented in
  S3-1.md).
- S4: outline up/down buttons with per-column boundary disabling verified desktop
  (`/tmp/r3-s4-outline-before/after.png` — order visibly changed, unsaved draft
  only) and mobile 390px via Blocks pill (`/tmp/r3-s4-mobile-open.png`); no
  horizontal overflow. 4 interaction tests.

- W2 integration (2026-06-11, orchestrator): fresh repo gate
  `npm run test -- src/lib/page-builder src/components/admin/seo-page-editor src/components/sections src/lib/services src/app/admin`
  91 files / 605 tests PASS; typecheck clean; eslint clean on all W2 files.
  Boundary audit clean (S5 added two justified files beyond brief: one-field
  `admin/libraries/actions.ts` pass-through + `ProofItemMediaField.tsx` client
  component — accepted, documented in S5-1.md).
- S7: browser proof — pasted an 11-section doc into the editor's Import document
  tool; role=status warning rendered: "3 sections dropped — only the first 8 were
  imported." (`/tmp/r3-s7-import-warning.png`). Exact-count + singular forms
  test-certified; at/under cap shows no warning.
- S5: browser proof — `/admin/libraries` proof form shows "Proof image (optional)"
  with Choose-from-library picker (`/tmp/r3-s5-libraries-form.png`); proof block
  settings show Choose from library / Clear media / Media alt text, staged asset
  label, and Apply (`/tmp/r3-s5-after-pick.png`). \*Final rendered-image proof is
  certified by unit render tests (ResourcePageContent.proof-media.test.tsx — img
  with alt for quote/stat/logo; legacy markup string-identical), NOT by a live
  page render: the editor canvas is form-style (no media preview), and rendering
  on a real page would mutate a production draft (see incident below).
- INCIDENT (resolved): W1/W2 browser gates ran against live page f7cf0260
  (/resources/vending-in-colleges) assuming unsaved editor state; the editor
  autosaves to the production Supabase draft. Test edits persisted (meta
  description overwritten, blocks 2/3 swapped, test proof block added). Published
  output never changed. Fully repaired and verified via draft preview:
  h2 order matches published, test proof/Casey/disclaimer image absent, no inline
  /apply paragraph link, meta restored to original 116-char text
  (`/tmp/r3-final-draft-preview.png`). Lesson recorded in ~/.claude/lessons.md and
  project memory; remaining gates use throwaway pages only.

- W3 / S6a (2026-06-11, orchestrator integration): fresh repo gate 169 tests PASS
  (route-prefixes service, settings actions, AdminShell), typecheck clean.
  Migration `20260611090000_page_builder_route_prefixes.sql` reviewed line-by-line
  (additive + idempotent only: create table if not exists, RLS via existing
  `is_app_admin()`, on-conflict-do-nothing seed) and applied to the linked
  Supabase project via `supabase db push` per the decisions.md precedent.
  Browser proof on `/admin/settings/routes` as super-admin: five defaults listed
  Built-in/non-deletable; throwaway `/r3-test-prefix` added then deleted (cleanup
  verified — no longer present); reserved `/admin` rejected with inline error
  "That route prefix is reserved and cannot be used."
  (`/tmp/r3-s6a-settings-page.png`, `/tmp/r3-s6a-added.png`,
  `/tmp/r3-s6a-reserved-error.png`, `/tmp/r3-s6a-cleaned.png`).

- W4 / S6b interim (2026-06-12, orchestrator): migration
  `20260611100000_relax_route_prefix_checks.sql` reviewed (strictly-weaker CHECK
  predicates only) and applied via `supabase db push`. Fresh gates: full suite
  769 tests PASS, typecheck clean, `npm run build` PASS (route table:
  catch-all + [legacyLeadPath] + /resources/preview/[token] + static all
  coexist). Live proofs PASSED: legacy /resources page 200; /resources/preview
  token 200; /blog/{slug} -> /news/{slug} 308; unknown prefixes 404-equivalent
  (streamed soft-404 with noindex — same pre-existing pattern as single-segment
  paths); /services added in settings; editor dropdown listed /services from the
  service; draft + publish under /services succeeded (relaxed CHECK accepted
  route_path); public /services page rendered with correct canonical + h1;
  sitemap included the /services URL.
  BUG FOUND in live verification: slug-rename redirect row for the custom prefix
  (301, anon-readable, exists in DB) is NOT served as an HTTP redirect — old URL
  returns streamed 200 soft-404 (suspected shell-flush-before-redirect). Sent
  back to worker-s6b as S6b-2 for root-cause + fix (real 301/308 required).
  Throwaway records still live for re-verification: page
  1698384a-c273-441c-9bb1-e35c8b6f4d5b (/services/r3-services-proof-renamed),
  one redirect row, /services prefix. Cleanup happens after S6b-2 passes.

- W4 / S6b-2 fix (2026-06-12): root cause CONFIRMED with doc citations — this
  Next version's permanentRedirect() in a streaming context (root loading.tsx)
  emits a client-side meta-refresh, never an HTTP 3xx (the streamed body
  contained `__next-page-redirect`). Fix: custom-prefix redirect rows are now
  served in src/proxy.ts via a shape-scoped matcher + configured-list check,
  exactly like the five defaults; defaults pinned byte-identical by test.
  Orchestrator re-verified live: `curl -I` shows HTTP/1.1 301 + Location ->
  /services/r3-services-proof-renamed, follows to 200; news/authors/legacy
  routes unchanged. Fresh final gates: full suite 122 files / 774 tests PASS,
  typecheck clean, `npm run build` PASS (56 static pages).
- Cleanup (2026-06-12): redirect row deleted; /services prefix deleted;
  throwaway page 1698384a archived via the app's own
  `archive_seo_page_atomically` RPC (page_revisions are immutable append-only,
  so hard delete is impossible by design — archived record retained, matching
  product convention). Sitemap contains zero /services entries.
- Product follow-up discovered (not a Round 3 regression): a page published
  under a prefix that is later deleted from settings keeps its sitemap entry
  while publicly 404ing until the page itself is archived. Recommend: block
  prefix deletion while non-archived pages use it, or auto-archive prompt.
- Evidence pack: `evidence/README.md` maps every item to screenshots, tests,
  and curl proofs. Manual QA checklist: `reports/qa-round-3-2026-06-12/index.html`.
