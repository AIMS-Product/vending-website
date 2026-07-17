# Conversion pages — form / Calendly / UTM mapping

Source of truth: **Vendingpreneurs Migration Sheet**
(`docs/migration/vendingpreneurs-migration-sheet.csv`, pulled live from
`https://docs.google.com/spreadsheets/d/1_-Ep7vma5UmMdvKkPrHzeCCPdU-13hzd6t2e1p4XwNw`).

Kody edits the sheet continuously. To re-sync the local snapshot, re-pull the
authenticated CSV through the logged-in browser (see
`scripts/pull-conversion-sheet.md`) and re-run the diff:

```
node scripts/diff-conversion-sheet.mjs docs/migration/vendingpreneurs-migration-sheet.csv
```

The diff reports any sheet slugs that are missing an `embed` in
`src/lib/content/legacy-routes.ts` so new rows never ship without wiring.

## Model

Every conversion page renders the branded Vendingpreneurs shell
(`LegacyLeadPageContent`) with the correct **native embed** in the CTA column
instead of redirecting off-site:

- **Typeform** rows → inline `<TypeformEmbed>` (Typeform form embedded in-page).
- **Calendly** rows → inline `<CalendlyEmbed>` (Calendly scheduler embedded in-page).
- Rows with both a Typeform **and** a Calendly whose Action is
  "Redirects to Calendly only" (`booking-ig`, `booking-insta-b5`) embed the
  **Calendly** as the primary CTA.

UTM + source attribution present on the landing URL (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`, `source_path`, `vp_session_id`) is
passed through into the embed URL so tracking stays cohesive.

## Current mapping (live sheet, 2026-07-17)

| Slug                                | Embed    | Reference                                           |
| ----------------------------------- | -------- | --------------------------------------------------- |
| `apply-vendingpreneurs`             | Typeform | `NsaOR2VZ`                                          |
| `booking-youtube`                   | Typeform | `NsaOR2VZ`                                          |
| `booking-tiktok`                    | Typeform | `JPM7QOcG`                                          |
| `booking-linkedin`                  | Typeform | `JPM7QOcG`                                          |
| `booking-meta`                      | Typeform | `JPM7QOcG`                                          |
| `booking-internal-ltf`              | Typeform | `JPM7QOcG`                                          |
| `booking-passivepreneurs`           | Typeform | `JPM7QOcG`                                          |
| `start-your-route-ak-ig`            | Typeform | `JPM7QOcG`                                          |
| `booking-ak-x`                      | Typeform | `JPM7QOcG`                                          |
| `booking-ak-linkedin`               | Typeform | `JPM7QOcG`                                          |
| `booking-partner`                   | Typeform | `JPM7QOcG`                                          |
| `start-my-vending-business`         | Typeform | `JPM7QOcG`                                          |
| `booking-reactivation-email`        | Typeform | `JPM7QOcG`                                          |
| `booking-ig`                        | Calendly | `dv5d-5zj-g8b/vendingpreneurs-consultation-session` |
| `booking-insta-b5`                  | Calendly | `dz4t-wrw-3nk/vendingpreneurs-strategy-session`     |
| `start`                             | Calendly | `cxwj-zxk-2z4/vending-route-advisory-call`          |
| `book-my-advisory-call-setter`      | Calendly | `cvsd-wxt-cvb/vendingpreneurs-quick-discovery`      |
| `book-my-advisory-call-accelerator` | Calendly | `cxv9-jg6-m53/vending-accelerator-call`             |
| `book-my-advisory-call-l1-topcl`    | Calendly | `cvr6-cfd-zgd/vendingpreneurs-consultation-call`    |
| `book-my-advisory-call-l1`          | Calendly | `cxfn-hh2-h8g/vendingpreneurs-consultation`         |

## Out of sheet (kept as native lead form, flagged)

`booking-x` predates the sheet's `booking-ak-x`. It still renders the native
lead form. Confirm whether it should mirror `booking-ak-x` (`JPM7QOcG`) or be
retired/redirected.
