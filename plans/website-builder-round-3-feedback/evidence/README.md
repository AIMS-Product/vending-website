# Round 3 Evidence Pack

Proof per feedback item. Every item has three layers: (1) failing-then-passing
tests committed with the fix, (2) fresh repo gates run by the orchestrator at
integration (test/typecheck/lint/build outputs recorded in `../progress.md`),
and (3) live browser/HTTP proof below for anything user-visible. Screenshots
were captured on localhost dev (production Supabase data) on 2026-06-11/12.

| Item                                  | Fix proven by                                                                                                                                                                                                  | Visual evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I1 published list bullets (R3-3)      | `RichTextBlock.test.tsx` (bullet → `list-disc`, numbered → `list-decimal`, checklist unchanged); live `curl` of `/resources/vending-in-colleges` shows 3× `<ul class="ml-5 list-disc list-outside space-y-2">` | `I1-published-list-bullets.png` (published page, bullets visible)                                                                                                                                                                                                                                                                                                                                            |
| I2 substring link (R3-1)              | 13 span-split unit tests + 3 render tests (`rich-text-link-spans.test.ts`, `RichTextBodyEditor.test.tsx`); live editor interaction                                                                             | `I2-linktext-notfound-error.png` (inline role=alert error for non-matching text), `I2-linktext-valid-match.png` (clean accept)                                                                                                                                                                                                                                                                               |
| I3 meta description 155 (R3-4)        | Validation/readiness tests (155 warning at 156, legacy 170 accepted, 181 rejected); live fill of 200 chars capped at exactly 155                                                                               | `I3-meta-counter-155.png` (red `155/155` counter on the editor field)                                                                                                                                                                                                                                                                                                                                        |
| I4 outline reorder (R3-5)             | 4 interaction tests (`BuilderBlockSidebar.move.test.tsx`: render, boundary disabling, exact callback args); live click moved a block                                                                           | `I4-outline-before-move.png` / `I4-outline-after-move.png` (order change), `I4-outline-mobile.png` (390px via Blocks pill, boundary states correct)                                                                                                                                                                                                                                                          |
| I5 proof imagery (R3-6)               | Schema/service/render tests incl. legacy markup string-identical assertion (`ResourcePageContent.proof-media.test.tsx`); live picker flow                                                                      | `I5-libraries-proof-image-field.png` ("Proof image (optional)" + Choose from library on the library form), `I5-block-settings-media-staged.png` (block settings with staged asset, Clear media, alt text field)                                                                                                                                                                                              |
| I6 custom route prefixes (R3-2)       | S6a: 23 service/action tests; S6b: 86 targeted route tests + full suite + production build; two applied additive migrations; live end-to-end publish                                                           | `I6-routes-settings-defaults.png` (5 Built-in defaults, non-deletable), `I6-custom-prefix-added.png` (custom row with delete), `I6-reserved-prefix-rejected.png` ("That route prefix is reserved…" inline error), `I6-throwaway-prefix-cleaned.png` (cleanup proof), `I6-custom-prefix-public-page.png` (published page rendering at `/services/...` with correct canonical; sitemap entry verified by curl) |
| I7 importer truncation warning (R3-7) | 3 parser tests (count-2, singular, no-warning-at-cap) + static panel render test; live paste of an 11-section doc                                                                                              | `I7-import-truncation-warning.png` (role=status: "3 sections dropped — only the first 8 were imported.")                                                                                                                                                                                                                                                                                                     |

## S6b-2 redirect fix (closed 2026-06-12)

Custom-prefix slug-rename redirects are now served at the proxy layer as real
HTTP redirects. Orchestrator-captured proof:

```
$ curl -s -I http://localhost:3000/services/r3-services-routing-proof
HTTP/1.1 301 Moved Permanently
location: /services/r3-services-proof-renamed
```

Followed to 200 at the renamed URL; default-prefix redirect behavior pinned
byte-identical by test (`src/proxy.test.ts`).

## Incident record

`incident-draft-repaired-preview.png` — draft preview of
`/resources/vending-in-colleges` after repairing the autosave incident
(see `../progress.md` W2 section): section order, content, links, and meta all
match the published version.

## Non-visual proof locations

- Wave-by-wave repo-gate outputs and write-boundary audits: `../progress.md`.
- Per-node RED/GREEN/REFACTOR evidence: `../agent-runs/S*-1.md`.
- Migration review notes (additive-only proofs): `../progress.md` W3/W4 entries.
