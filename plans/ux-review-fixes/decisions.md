# UX Review Fixes — Decisions

Source: reports/ux-persona-review/UX-REVIEW.md (2026-06-10; 143 verified findings: 3 P0, 7 P1, 40 P2, 93 P3)
Grilled: 2026-06-10 with James. Status: **complete — ready for implementation.**
Scope: **everything P0–P2** (50 issues). P3 (93 polish items) explicitly out of this round.
Brand/business decider: **Kody (marketing manager)** — deferred items listed below.

## Decided

| #   | Decision                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Scope = P0+P1+P2               | All 50 top-band issues this round; P3 later.                                                                                                                                                                                                                                                                                                                                                                                     |
| D2  | Apply success → redirect       | On successful apply submit, redirect to the existing `/thank-you-for-applying` page. Kills the silent-success P0 (13/15 personas), prevents double-submits, clean conversion URL.                                                                                                                                                                                                                                                |
| D3  | Contact success → inline panel | On successful contact submit, replace the form with a prominent "Message sent — we'll reply to {email}" panel. No new page.                                                                                                                                                                                                                                                                                                      |
| D4  | Apply qualification fields     | Add a "Not sure yet" option to Business stage, Available startup budget, Launch timeline. Fields STAY required (interim). Final required-vs-optional policy → Kody (K4).                                                                                                                                                                                                                                                         |
| D5  | Public naming = "News"         | Page heading "BLOG" → "NEWS"; article breadcrumb "Blog" → "News" (NewsHero.tsx, NewsArticle.tsx). Route, nav, sitemap already say News — smallest consistent fix, reversible. Final brand name → Kody (K5). Admin-internal label "Blog and news" unchanged.                                                                                                                                                                      |
| D6  | Hero stats SSR                 | Server-render real values (500+ / $3M+ / 3,000+); count-up animation becomes progressive enhancement. "0+" must never be the SSR/no-JS/crawler output. (AnimatedStatValue.tsx)                                                                                                                                                                                                                                                   |
| D7  | Form validation layer          | `noValidate` on apply/contact forms; wire the existing inline per-field error components (aria-invalid + aria-describedby + aria-live summary); preserve entered values on failed submit.                                                                                                                                                                                                                                        |
| D8  | Quick Tour reposition          | Walkthrough card must render beside — never over — the panel it highlights (BuilderEditorWalkthrough.tsx fallback positioning). Keep Skip tour.                                                                                                                                                                                                                                                                                  |
| D9  | Admin sidebar News link        | Add `blogSection` to `contentSections` in src/components/admin/AdminShell.tsx (defined but never included — root cause of P0-2).                                                                                                                                                                                                                                                                                                 |
| D10 | Redirects discoverability      | Add a visible "Redirects" link on the /admin/pages list header. (Libraries keeps its existing Media-page link.)                                                                                                                                                                                                                                                                                                                  |
| D11 | Legacy /blog/{slug}            | 301-redirect to matching /news/{slug} when the post exists; 404 otherwise.                                                                                                                                                                                                                                                                                                                                                       |
| D12 | P2 technical sweep             | Mobile horizontal-scroll fixes + article H1 word-break; news-card image onError fallback; CLS reduction via explicit image dimensions; visible focus indicators on video tiles; add skip-link; WCAG-AA contrast fixes (stat labels, error page, article meta, admin filter counts); admin aria-prohibited-attr fix; "Schedule failed" filter tooltip. Full checklist = P2 rows in reports/ux-persona-review/final-findings.json. |
| D13 | Workflow                       | Local branch `ux-review-fixes`; verify with cap local-only flow; **no push/PR/preview until James explicitly says**.                                                                                                                                                                                                                                                                                                             |

| D14 | Branch base = main | Release-train stack branches no longer exist locally; `ux-review-fixes` branches from current main. |
| D15 | Kody handoff | James communicates K1–K6 to Kody himself (no drafted message needed). All slices proceed without waiting; the only Kody-sensitive change shipped (News heading, D5) is minutes to reverse. |
| D16 | Test-record cleanup | DONE: test lead row deleted from lead_submissions with James's explicit permission (its status was `notification_failed` — check lead notification config in go-live). Test SEO page gets archived via the admin UI during S3 once the row menu is confirmed. |
| D17 | Real-user checkpoint | After S1 ships, one real person (not James) submits a test application on a phone and reports friction. Gate before calling the apply work done. |
| D18 | P3 disposition | plans/ux-review-fixes/P3-BACKLOG.md written (93 items, marked unverified — reproduce before fixing). Revisit post-launch. |
| D19 | Repo hygiene | Commit plans/ + reports markdown/JSON; .gitignore now excludes screenshots/, text/, and the 3MB HTML (52MB stays local). Keep playwright + @axe-core/playwright devDeps (e2e + future a11y checks). |

## Deferred — needs Kody (marketing manager)

> Context for K1/K2: James confirmed the absence of human contact details is **deliberate funnel design**, not an oversight. These are review requests, not bug reports.

| #   | Question for Kody                                                                                                                                                                                                    | Options laid out                                                                                  | Interim state                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| K1  | Should a human contact channel exist on the site? The UX review's angriest finding (3 personas called it a trust-killer for a multi-thousand-dollar program); support@vendingpreneurs.com already appears in /terms. | (a) add support email to footer + contact page; (b) email + phone; (c) keep form-only as designed | Form-only (unchanged)          |
| K2  | Should "Contact" appear in the header nav? 11/15 personas looked for it there.                                                                                                                                       | (a) add to header; (b) footer-only as designed                                                    | Footer-only (unchanged)        |
| K3  | Primary CTA label "STEP INSIDE" — 4 personas couldn't tell it's the apply button.                                                                                                                                    | (a) keep STEP INSIDE; (b) "APPLY NOW"; (c) "START YOUR APPLICATION"                               | STEP INSIDE (unchanged)        |
| K4  | Apply qualification: keep Business stage / budget / timeline required, or make optional?                                                                                                                             | (a) required with "Not sure yet" (interim default); (b) fully optional                            | Required + "Not sure yet" (D4) |
| K5  | Final name for the articles section: News or Blog?                                                                                                                                                                   | (a) News (matches URL/nav — interim); (b) Blog (requires nav + sitemap + breadcrumb changes)      | News (D5)                      |
| K6  | Pricing transparency: the site never states any price; skeptical-buyer persona ranked it a top trust blocker.                                                                                                        | (a) publish price/range; (b) "from $X"; (c) keep price gated to the call as designed              | No price shown (unchanged)     |

## Rejected options

- Inline success banner on /apply (redirect chosen — thank-you page already exists and is better).
- New thank-you page for the contact form (inline panel is enough for a lower-stakes form).
- Standardising public naming on "Blog" (route/nav/sitemap already say News; URL churn not worth it).
- Adding contact details/header-Contact now (deliberate funnel design — Kody's call, K1/K2).
- Making apply qualification fields optional immediately (changes what sales receives — Kody's call, K4).

## Open blockers

- None technical. K1–K6 gate only their own items; everything in "Decided" can ship without Kody.

## Fix plan (dependency-ordered slices)

1. **S1 — P0 quick wins** (small, independent): D9 sidebar one-liner; D2 apply redirect; D3 contact success panel.
2. **S2 — Conversion form quality**: D6 stats SSR; D7 validation layer; D4 "Not sure yet" options.
3. **S3 — Admin editor/nav**: D8 tour reposition; D10 redirects link.
4. **S4 — Naming consistency**: D5 News heading/breadcrumb.
5. **S5 — Public P2 sweep**: D11 blog redirects; mobile scroll/H1; image fallback; CLS; focus indicators + skip link; contrast.
6. **S6 — Admin P2 sweep**: aria-prohibited-attr; Schedule-failed tooltip; remaining admin P2 rows from final-findings.json.

Each slice independently verifiable (tsc, lint, tests, browser check vs the review's screenshots). Tests required for: lead-action redirect behaviour, blog→news redirect, validation states.

## Verification rules for workers

- **P2 findings are unverified by design** (the review only fact-checked P0/P1, and that pass killed/demoted several). Before fixing any P2 row from final-findings.json: reproduce it against the live app first. If it doesn't reproduce, record it as `not-reproduced` in progress notes — do NOT fix blind.
- **Performance/console findings were measured on `next dev`.** Re-measure CLS and re-check console errors against a production build (`next build && next start`) before treating them as real.
- Verified-to-source facts that need no re-checking: AdminShell blogSection omission; lead idempotency_key dedupe (leads.ts ~L235); SSR DOM contains literal `<span>0+</span>` with real stat values only in serialized client props; /thank-you-for-applying exists and is orphaned; zero published seo_pages rows; Redirects route has no inbound links.
