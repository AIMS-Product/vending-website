# Feature Progress: website-builder-round-2-feedback

Status: COMPLETE
Current wave: FINAL
Last updated: 2026-06-05
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                                       | Tier | Depends On | Parallel Group | Owner | Status |
| ---- | ----------------------------------------------------------- | ---- | ---------- | -------------- | ----- | ------ |
| S0   | Verify Round 2 runtime reports                              | T1   | none       | W0-A           | Codex | DONE   |
| S1   | Expand rich-text model for heading hierarchy and structures | T2   | S0         | W1-A           | Codex | DONE   |
| S2   | Add rich-text authoring controls and auto-sizing fields     | T2   | S1         | W2-A           | Codex | DONE   |
| S3   | Add outline-based block insertion                           | T2   | S0         | W1-B           | Codex | DONE   |
| S4   | Verify and fix browser image upload flow                    | T2   | S0         | W1-C           | Codex | DONE   |
| S5   | Add video thumbnail override                                | T2   | S0         | W1-D           | Codex | DONE   |
| S6   | Decide and implement public author path                     | T2   | S0         | W1-E           | Codex | DONE   |
| S7   | Plan document copy/upload to block mapping                  | T2   | S1         | W3-A           | Codex | DONE   |
| S8   | Define attribution and review-reporting contracts           | T2   | S0         | W1-F           | Codex | DONE   |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                                                           | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ------------------------------------------------------------------ | ---------- |
| S0   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S0-runtime-verification.md`; upload proof moved to S4  | High       |
| S1   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S1-heading-hierarchy.md`; h2/h3/h4 browser audit proof | High       |
| S2   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S2-rich-text-authoring-controls.md`; unsaved editor UI | High       |
| S3   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S3-outline-insertion.md`; picker portal fix            | High       |
| S4   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S4-browser-upload-verification.md`; asset cleaned up   | High       |
| S5   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S5-video-thumbnail-override.md`; additive JSON fields  | High       |
| S6   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S6-public-author-path.md`; `/authors/{slug}` live      | High       |
| S7   | DONE | DONE  | DONE     | DONE      | DONE         | DONE          | `agent-runs/S7-document-import-mapping.md`; proposal-only import   | High       |
| S8   | DONE | DONE  | DONE     | DONE      | SKIPPED      | DONE          | `agent-runs/S8-attribution-review-contract.md`; v1 contract set    | High       |

## Blockers

None.

## Completed Evidence

- S0: Browser verified the editor/public spacing split on existing page `bf8fdae4-1fd7-4469-9926-67c7d92f266a`: public render has paragraph/list spacing, while editor body textareas overflow internally. Screenshots saved to `/tmp/round2-editor-existing-page.jpg` and `/tmp/round2-public-existing-page.jpg`.
- S0: Focused media upload helper test passed: `npm run test -- src/lib/media/editor-upload.test.ts` (7/7 tests).
- S1: Rich-text schema now accepts `h2/h3/h4`, public rendering preserves those heading tags, and the block-preview audit route rendered the hierarchy without visible clipping. Evidence: `agent-runs/S1-heading-hierarchy.md`, `/tmp/round2-rich-text-heading-audit-crop.jpg`.
- S2: Structured rich-text body controls now support paragraph, heading, list, and safe manual-link editing in canvas/settings with auto-sizing fields. Evidence: `agent-runs/S2-rich-text-authoring-controls.md`, `/tmp/round2-s2-rich-text-desktop.png`, `/tmp/round2-s2-rich-text-mobile.png`.
- S3: Outline add-below controls insert at deterministic positions; browser proof caught and fixed a clipped picker by portaling the dialog. Evidence: `agent-runs/S3-outline-insertion.md`, `/tmp/round2-s3-outline-insert-desktop.png`, `/tmp/round2-s3-outline-mobile.png`.
- S4: Browser upload verified on `http://localhost:3000/admin/media` with generated PNG `/tmp/codex-s4-media-upload-proof.png`; asset `e42b0f45-56fc-42aa-ac8f-5a6167803c08` and storage object were cleaned up. Evidence: `agent-runs/S4-browser-upload-verification.md`, `/tmp/round2-s4-media-upload-created.jpg`, `/tmp/round2-s4-media-upload-cleaned.jpg`.
- S5: Video blocks now support optional thumbnail overrides in schema, editor settings, canvas preview, public render, and block-preview fixtures. Evidence: `agent-runs/S5-video-thumbnail-override.md`, `/tmp/round2-s5-video-thumbnail-preview-screen.png`.
- S6: Canonical public author path `/authors/{slug}` implemented with `/blog/author/{slug}` 308 redirect, admin display update, public route metadata, sitemap inclusion, tests, and browser proof. Evidence: `agent-runs/S6-public-author-path.md`, `/tmp/round2-s6-public-author-page.jpg`, `/tmp/round2-s6-admin-authors-page.jpg`, `/tmp/round2-s6-admin-authors-mobile.jpg`, `/tmp/round2-s6-public-author-mobile.jpg`.
- S7: Pasted document import now creates validated, proposal-only rich-text block plans with source excerpts/line ranges and admin-selected insertion. Evidence: `agent-runs/S7-document-import-mapping.md`, `/tmp/round2-s7-document-import-plan.png`, `/tmp/round2-s7-document-import-inserted.png`.
- S8: Attribution/review-reporting v1 contract is recorded: `page_published`, `page_updated`, `lead_submitted`, and `content_review_due`; backend remains source of truth; browser-side GTM/dataLayer is optional. Evidence: `agent-runs/S8-attribution-review-contract.md`.

## Notes

- All S0-S8 graph nodes are complete with repo and browser evidence.
- This graph remains local-only until the user explicitly asks for branch push, PR creation, preview, or release.
