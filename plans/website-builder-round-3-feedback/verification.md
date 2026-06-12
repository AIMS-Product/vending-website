# Verification: website-builder-round-3-feedback

## Final Status

PASS

## Requirement Audit

| Requirement (triage ID)                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                           | Result |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I1/R3-3: published lists render bulleted/numbered design     | Render tests (`RichTextBlock.test.tsx`); live published page shows 3× `ul.list-disc`; screenshot `evidence/I1-published-list-bullets.png`; checklist variant asserted unchanged                                                                                                                                                                                                    | PASS   |
| I2/R3-1: URL insert can target chosen text in the paragraph  | 13 span-split tests + 3 render tests; live editor: substring link applied, not-found error shown, blank = whole-paragraph fallback; `evidence/I2-*.png`                                                                                                                                                                                                                            | PASS   |
| I3/R3-4: 155-char meta description limit incl. spaces        | Shared constants in `copy-standards.ts` (155 target / 180 legacy server ceiling); editor maxLength + live counter (`evidence/I3-meta-counter-155.png`, 200-char fill capped at 155); readiness + pages-list flag >155; AI schemas capped 155; legacy 170-char save accepted (test)                                                                                                 | PASS   |
| I4/R3-5: shift sections up/down in the outline               | 4 interaction tests; live reorder desktop + mobile with boundary disabling (`evidence/I4-*.png`)                                                                                                                                                                                                                                                                                   | PASS   |
| I5/R3-6: proof points can carry imagery                      | Schema/service/render tests incl. legacy-markup string-identical; live picker in block settings + libraries form (`evidence/I5-*.png`); render certified by unit tests (live-page render skipped deliberately — see Skipped Checks)                                                                                                                                                | PASS   |
| I6/R3-2: custom subfolder paths at settings level            | Settings table + UI (S6a, migration applied, browser-proven incl. reserved rejection + cleanup); dynamic route + lookup validation (S6b); live end-to-end: prefix added → editor dropdown → publish → public render + canonical + sitemap; slug-rename 301 via proxy (S6b-2, `curl -I` proof); five legacy prefixes byte-identical (tests + live spot-checks); `evidence/I6-*.png` | PASS   |
| I7/R3-7: md formatting guidance + visible truncation warning | Guidance documented in review doc; parser tests (exact count, singular, no-warning-at-cap); live paste showed "3 sections dropped — only the first 8 were imported." (`evidence/I7-import-truncation-warning.png`)                                                                                                                                                                 | PASS   |

## Evidence Table

| Claim                                          | Fresh evidence                                                                                                                                                                                           | Result | Remaining risk                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| Full suite green after final wiring            | `npm run test` 2026-06-12: 122 files / 774 tests PASS (run after S6b-2, the last code change)                                                                                                            | PASS   | none                                                            |
| Types compile                                  | `npm run typecheck` clean (same run)                                                                                                                                                                     | PASS   | none                                                            |
| Production build with consolidated routes      | `npm run build` PASS, 56 static pages; route table shows catch-all + `[legacyLeadPath]` + `/resources/preview/[token]` coexisting                                                                        | PASS   | none                                                            |
| Custom-prefix redirect is a real HTTP redirect | `curl -I` → `HTTP/1.1 301` + `location:` header, followed to 200                                                                                                                                         | PASS   | none                                                            |
| Legacy routes unaffected                       | Live: `/resources/vending-in-colleges` 200, preview token 200, `/blog/{slug}`→`/news/{slug}` 308, `/news` `/authors/*` 200; proxy pin test asserts defaults never consult the prefix list                | PASS   | none                                                            |
| Migrations non-destructive                     | Both reviewed line-by-line pre-push (additive table+seed; strictly-weaker CHECK predicates); applied via `supabase db push`; existing rows verified satisfying new constraints                           | PASS   | none                                                            |
| Production data left clean                     | Test redirect row + `/services` prefix deleted; throwaway page archived via the app's atomic RPC; sitemap has zero `/services` entries; incident page draft repaired and verified against published HTML | PASS   | archived test page row retained (revisions immutable by design) |

## Commands

- `npm run test` → 122 files / 774 tests PASS (final run 2026-06-12)
- `npm run typecheck` → clean
- `npm run build` → PASS
- `supabase db push` → `20260611090000_page_builder_route_prefixes.sql`, `20260611100000_relax_route_prefix_checks.sql` applied
- Wave-level targeted runs recorded in `progress.md` (W1 406, W2 605, W3 169 tests)

## Runtime And Boundary Proof

- Browser gates run serially by the orchestrator on localhost dev (production
  Supabase data) — per-item screenshots in `evidence/`, indexed in
  `evidence/README.md`.
- DB boundary: migrations applied to the linked project per documented
  precedent (decisions.md); settings CRUD proven live with throwaway records
  and verified cleanup.
- HTTP boundary: curl proofs for status codes, canonical, sitemap, redirects.

## Skipped Checks

- Live published render of a proof block WITH imagery: covered by unit render
  tests (img + alt for all three variants, legacy markup string-identical)
  instead of a live page, to avoid mutating another production draft after the
  autosave incident. Manual QA step provided in
  `reports/qa-round-3-2026-06-12/index.html` (item I5).
- Mutation testing (`npm run mutate`): not run — not part of this repo's wave
  gates.

## Behavior Preservation

- Previous intended behaviors: checklist variant `list-none`; whole-paragraph
  link fallback; legacy 156-180 meta saves; outline select/edit/add-below;
  legacy proof block markup; five default prefixes' routing/metadata/redirects;
  `/blog`→`/news` legacy redirect; preview tokens; route_path uniqueness +
  archived-path retention; admin vs super_admin gating.
- Intentional behavior changes: bullets visible on published lists; substring
  links; 155 meta cap on new input; outline reorder buttons; proof imagery
  (optional, additive); curated custom prefixes; importer truncation warning.
- Evidence: regression tests per node (string-identical markup assertions,
  proxy pin test, legacy-save test); live legacy spot-checks; full suite.
- Confidence: 93/100. Deductions: editor canvas has no rendered proof-image
  preview (form-style canvas — image visible only in Live preview/published);
  unknown multi-segment URLs now stream a 200 soft-404 with noindex (matches
  the pre-existing site-wide single-segment pattern, but is a behavior change
  for those URLs); archived test page row retained.

## Residual Risk

- Prefix deletion while non-archived pages still use it leaves those pages
  publicly 404ing but sitemap-listed until archived (discovered during
  cleanup; recorded as product follow-up in progress.md).
- Missing pages under CUSTOM prefixes stream a 200 soft-404 (with noindex)
  rather than the proxy-level hard 404 the five defaults get — one-line parity
  follow-up noted in S6b-2 report.
- Importer hardening beyond the warning (bold/italic spans, nested lists)
  deliberately deferred; documented in the review doc.
