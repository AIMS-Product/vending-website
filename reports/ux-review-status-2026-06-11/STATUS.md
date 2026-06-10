# UX Review Status — Code Verification (2026-06-11)

Both June 10 UX persona reviews verified against the current code on `ux-review-fixes`
(working tree, uncommitted changes included). 97 agents — one per P0/P1/P2 issue, P3s in
batches — each gave a verdict from source code, with fix-round docs used only to locate
fixes or classify documented deferrals. 195 verdicts, 0 lost.

Source reviews:

- Full-app: `reports/ux-persona-review/UX-REVIEW.md` (151 issues)
- SEO builder (scoped): `reports/ux-persona-review-seo-builder/UX-REVIEW.md` (28 issues + 16 P3 notes)

Verdict data: `verdicts.json` / `merged.json` in this folder. Interactive scorecard: `index.html`.
Plain-English what/why/how for every unfixed issue: `FIX-GUIDE.md` / `fix-guide.html`.
Swept for other June 10 reviews: none exist beyond the two persona reviews (the only other June 10
HTML artifact is the round-2 code review; June 9's is an AI SEO confidence report, not a UX review).

---

## Scoreboard

| Review               | Scope   | FIXED  | PARTIAL | NOT_FIXED | DEFERRED | Other        |
| -------------------- | ------- | ------ | ------- | --------- | -------- | ------------ |
| Full-app P0–P2       | 58      | 36     | 6       | 4         | 12       | —            |
| Full-app P3          | 93      | 22     | 10      | 42        | 17       | 2 NCV        |
| SEO builder P0–P2    | 27      | 24     | 1       | 1         | 1        | +1 withdrawn |
| SEO builder P3 notes | 16      | 12     | 1       | 2         | —        | 1 NCV        |
| **Total**            | **194** | **94** | **18**  | **49**    | **30**   | 3 NCV        |

NCV = not code-verifiable (runtime/visual only).

**Bottom line:** the SEO builder round genuinely landed — 24/27 active issues confirmed fixed
in code, including all 6 P0s. The full-app round landed its P0/P1 work (both fixable P0s fixed;
the third, no-human-contact-channel, is a deliberate Kody/business decision), but the P2/P3 tail
is where you are NOT done: 4 P2s claimed-or-assumed handled are not actually fixed, 6 are partial,
and 42 of 93 P3s have no fix and no documented deferral.

---

## SEO builder — what's left (2 items)

| ID   | Status    | Issue                                                             | What remains                                                                                                                                                                                                      |
| ---- | --------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-3 | PARTIAL   | Redirect form jargon error                                        | Inline errors + value preservation done, but non-empty invalid paths (e.g. `foo`) still pass the Zod schema and hit the backend jargon message `Path must be root-relative.` Needs a `.refine()` for leading `/`. |
| P2-4 | NOT_FIXED | New-page canvas gives no cue which fields are required to publish | Never mapped to any fix-round issue (I1–I20); fell through scoping. Blocker checklist exists once you hit Publish, but the canvas itself has no "required to publish" markers.                                    |

P2-13 (avatar FAB overlapping Sign out) verified as a dev-only external overlay, not app code — closed as non-issue.
SEO P3 notes: 12/16 fixed; remaining: tiny grey monospace row URLs, no-results state button hierarchy, toast double-"Draft saved" (partial).

## Full-app — genuinely not fixed (P2, claimed handled or missed)

| ID   | Status    | Issue                                            | What the code shows                                                                                                                                                           |
| ---- | --------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C005 | NOT_FIXED | News cards blank on first paint                  | Only change was ImageWithFallback (handles _failure_, not slow first paint / first-row visibility).                                                                           |
| C096 | NOT_FIXED | CLS 0.263 across pages                           | Dispositioned "handled-this-round" but N10 made zero CLS changes; footer-shift root cause explicitly out of scope. verification.md itself records 0.263 still occurring cold. |
| C100 | NOT_FIXED | 404 page off-brand (heading + button)            | Still `font-semibold` heading and white pill button; N12 fixed contrast only, brand styling fell through the gap.                                                             |
| C141 | NOT_FIXED | News list rows have no archive/delete affordance | PostRow still Edit-link only; no PageActionsMenu equivalent. (Duplicates P3s C033/C019.)                                                                                      |

## Full-app — partial (P2)

| ID        | Issue                        | Gap                                                                                                                              |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| C014      | Apply-form validation a11y   | Per-field aria-invalid/describedby + live region done; the requested top-of-form error summary with anchor links does not exist. |
| C050      | News article link contrast   | Byline fixed (5.70:1), underlines added — but body link colour `#2d9fd6` ≈ 2.40:1, fails AA.                                     |
| C099/C020 | Hero/stat CLS                | aspect-ratio + real SSR stat values done; `font-display` not done; cold-start CLS still 0.263 (footer streaming artifact).       |
| C153/C154 | 404 usefulness               | News/Apply/About links added; no Contact link, no search, "moved" copy still points nowhere.                                     |
| C117      | Required dropdowns on /apply | "Not sure yet" options added; fields still `required` — final policy is Kody decision K4.                                        |

## Deferred (documented, awaiting Kody / business decisions) — 12 P2 + 17 P3

Contact channels (C148, C003, C114, C092), pricing transparency (C077, C115), income-claim
substantiation (C078, C080, C084), founder identity (C082), nav CTA labelling (C011, C113),
design-system unification (C098 → flagged as future node), apply-form draft persistence (C124 →
future node). These are recorded in `plans/ux-review-fixes/decisions.md` (K1–K10) and P3-BACKLOG.md.

## Full-app P3 tail — 42 NOT_FIXED (no fix, no documented deferral)

Largest clusters:

- **Touch targets / nav ergonomics:** C093, C110, C094, C129, C047, C012, C059
- **Admin discoverability & affordances:** C033, C019, C102, C104, C108, C137, C139, C142, C145, C140
- **Copy & plain language:** C063, C072, C073, C075, C118, C043, C126, C152
- **A11y landmarks/headings:** C052, C053, C057, C086
- **Apply-flow ergonomics:** C025, C028, C029, C088 (privacy statement), C125, C149
- **Page structure:** C120, C121, C143, C040, C013

Full list with evidence in `merged.json` / `index.html`.
