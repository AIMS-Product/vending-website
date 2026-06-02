# Feature Progress: website-builder-feedback-v2

Status: IN_PROGRESS
Current wave: W2
Last updated: 2026-06-02
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                                      | Tier | Depends On | Parallel Group | Owner      | Status  |
| ---- | ---------------------------------------------------------- | ---- | ---------- | -------------- | ---------- | ------- |
| S0   | Verify existing review-marked builder behavior             | T0   | none       | W0-A           | Codex      | DONE    |
| S1   | Add persistent editor navigation and copy links            | T1   | S0         | W1-A           | Codex      | DONE    |
| S2   | Define page type and template creation foundation          | T2   | S0         | W1-B           | Codex      | DONE    |
| S3   | Add route-prefix slugs and duplicate-page flow             | T2   | S2         | W2-A           | Codex      | DONE    |
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

| Node | RED     | GREEN   | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                                                          | Confidence |
| ---- | ------- | ------- | -------- | --------- | ------------ | ------------- | ----------------------------------------------------------------- | ---------- |
| S0   | DONE    | DONE    | DONE     | DONE      | DONE         | DONE          | Existing builder behavior verified; public route/RLS drift found. | Medium     |
| S1   | DONE    | DONE    | DONE     | DONE      | DONE         | DONE          | Top-rail controls implemented and browser-verified.               | High       |
| S2   | DONE    | DONE    | DONE     | DONE      | DONE         | DONE          | Page type/template foundation implemented and browser-verified.   | High       |
| S3   | DONE    | DONE    | DONE     | DONE      | DONE         | DONE          | Route-prefix paths and duplicate flow implemented and verified.   | High       |
| S4   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S5   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S6   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S7   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S8   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S9   | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S10  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S11  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S12  | TODO    | TODO    | TODO     | TODO      | TODO         | TODO          | none                                                              | TBD        |
| S13  | BLOCKED | BLOCKED | BLOCKED  | BLOCKED   | BLOCKED      | BLOCKED       | blocked on product/integration decisions                          | TBD        |

## Blockers

| Node | Blocker                                                        | Required Decision Or Evidence                                                                                             |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| S8   | Scheduler mechanism may affect architecture.                   | Confirm whether to use existing hosted cron/job pattern or introduce one if no repo pattern exists.                       |
| S10  | Existing blog/news migration scope is intentionally undecided. | Decide whether legacy `/admin/news` remains parallel, is gradually migrated, or is replaced after compatibility evidence. |
| S11  | Third-party embed allowlist is not defined.                    | Decide which providers are allowed if the node includes external form embeds.                                             |
| S13  | External contracts are not concrete enough for implementation. | Define analytics events, webhook consumers, CSV import scope, API consumers/auth model, and A/B testing priority.         |

## Completed Evidence

- S1: Top-rail controls implemented and verified across desktop/mobile editor states.
- S0: Existing builder behavior verification completed with automated and browser evidence; public resource/sitemap RLS drift recorded as a blocker for route work.
- S2: Page type/template foundation implemented with approved templates, create-flow persistence, AI context metadata, and browser proof.
- S3 unblock: Applied `20260602095000_grant_public_published_revision_id.sql` to the connected Supabase project; `/sitemap.xml` now returns 200 and `/resources/vending-in-college` no longer fails with `permission denied for table seo_pages`.
- S3: Route-prefix/full-path model, public prefix routes, sitemap/proxy full-path lookup, SEO drawer prefix dropdown, and duplicate-page draft action implemented and verified. Worker report: `agent-runs/S3-attempt-1.md`.

## Notes

- This graph was created from `docs/seo-page-builder/website-builder-feedback-review.md` after the user triaged all feedback items.
- The first execution step should be S0 verification, not implementation, because several items were marked as review-needed from repo inspection only.
- 2026-06-02: S1 selected as the first workflow-test feature because it is visible, low-risk, and isolated to editor chrome.
- 2026-06-02: S1 completed. Evidence: `npx eslint src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx`, `npm run typecheck -- --pretty false`, Prettier, and Playwright screenshots for new-page mobile, existing-page mobile, and existing-page desktop. Clipboard copied the expected editor URL and `/resources/vending-in-college` public URL.
- 2026-06-02: S0 completed. Evidence: `npm run test -- src/app/admin/pages/actions.test.ts src/lib/services/seo-pages-previews.test.ts src/lib/services/seo-pages.test.ts` passed 42 tests; `npm run test -- src/lib/page-builder/seo-readiness.test.ts src/lib/services/seo-page-public.test.ts src/lib/media/editor-upload.test.ts src/lib/media/editor-asset.test.ts` passed 24 tests; `npm run typecheck -- --pretty false` passed. Browser verification confirmed autosave persisted and restored a temporary title edit, preview link renders without admin controls and includes `noindex`, editor desktop/mobile have no horizontal overflow, media filters render, media upload exposes Alt text/Rights notes, and Settings > Users shows super-admin role management. Follow-up: local `/sitemap.xml` and `/resources/vending-in-college` return 500 because the public SEO page query receives `permission denied for table seo_pages`.
- 2026-06-02: Public SEO page blocker triaged. Root cause appears to be `published_seo_pages` using `security_invoker = true` and joining through `seo_pages.published_revision_id`, while anon column grants did not include that join key. Added grant-only migration `20260602095000_grant_public_published_revision_id.sql`; pre-apply route checks still return 500 for `/sitemap.xml` and `/resources/vending-in-college`, so the blocker remains until the migration is applied to the connected Supabase project and public routes are rechecked.
- 2026-06-02: S2 completed. Evidence: worker report `agent-runs/S2-attempt-1.md`; `npm run test -- src/lib/page-builder/page-templates.test.ts src/components/admin/seo-page-editor/editor-form-data.test.ts src/app/admin/pages/actions.test.ts src/lib/services/seo-pages.test.ts src/lib/services/openai-page-builder-chat.test.ts src/lib/page-builder/ai-chat.test.ts src/app/api/page-builder/ai/chat/route.test.ts` passed 58 tests; `npm run typecheck -- --pretty false` passed; targeted `npx eslint` passed. Browser proof confirmed `/admin/pages/new` page type/template chooser on desktop/mobile, Blog default hidden metadata and seeded blocks, Landing default mobile metadata, no horizontal overflow, and no console/runtime errors.
- 2026-06-02: S3 started with safe prefix defaults from `decisions.md`; final route taxonomy and public RLS blockers are cleared for implementation.
- 2026-06-02: S3 completed. Evidence: focused tests passed 70 tests; `npm run typecheck -- --pretty false` passed; targeted `npx eslint` passed; `supabase db push` applied route-path migrations; browser proof confirmed Blog defaults to `/blog`, search preview uses `/blog/your-slug`, page list shows full route paths, and row action menu includes Duplicate page.
