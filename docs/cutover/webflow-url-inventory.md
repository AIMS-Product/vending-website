# Webflow URL Inventory

Snapshot date: 2026-05-04
Review update: 2026-05-08 page inventory screenshot
Source: `https://www.vendingpreneurs.com/sitemap.xml` plus page inventory review
Tracked URL rows: 73

This inventory is the cutover source of truth for old Webflow URLs. The safe
default after the May 8 page review is:

- Copy/keep only rows marked in use.
- Redirect rows marked not in use when they have likely inbound value.
- Remove test-only routes instead of preserving them.
- Keep uncertain rows out of the final decision list for Cody review.
- Publish only the news articles marked in use and archive the rest.

## Summary

| Category                         | Count | Treatment                                                              |
| -------------------------------- | ----: | ---------------------------------------------------------------------- |
| Core public pages                |     7 | Keep canonical pages, preserve required aliases, redirect `/business`. |
| Active booking/call funnels      |    17 | Render the apply flow on the old path with source attribution.         |
| Active VSL/lead landing funnels  |     3 | Render the apply flow on the old path with source attribution.         |
| Redirect/archive lead funnels    |    10 | Permanent redirect to the active apply/VSL route with attribution.     |
| Support/after-submit pages       |     2 | Preserve as noindex support pages pending workflow review.             |
| Test-only pages                  |     1 | Remove from active route handling.                                     |
| Cody review rows                 |     1 | Hold existing behavior until Cody confirms.                            |
| News articles to copy/publish    |     3 | Import/review as publish candidates in the News CMS.                   |
| News articles to archive/no-copy |    29 | Keep unpublished/archived; do not include in sitemap.                  |

## Core Public Pages

| Old path          | Live status | Live title                      | Intended destination | Decision             |
| ----------------- | ----------: | ------------------------------- | -------------------- | -------------------- |
| `/`               |         200 | Home \| Vendingprenuers         | `/`                  | keep                 |
| `/about-us`       |         200 | About Us \| Vendingprenuers     | `/about`             | preserve route alias |
| `/business`       |         200 | About Us \| Vendingprenuers     | `/about`             | permanent redirect   |
| `/case-studies`   |         200 | Case Studies \| Vendingprenuers | `/case-studies`      | keep                 |
| `/news`           |         200 | News \| Vendingprenuers         | `/news`              | keep                 |
| `/privacy-policy` |         200 | privacy policy                  | `/privacy`           | preserve route alias |
| `/terms`          |         200 | terms                           | `/terms`             | keep                 |

## Active Booking And Call Funnels

These are lead-intent URLs marked in use in the page inventory. They render the
new audited lead-capture flow on the original path while preserving that path in
`source_path` and `landing_path`.

| Old path                                  | Live status | Live title                      | Intended destination      | Decision            |
| ----------------------------------------- | ----------: | ------------------------------- | ------------------------- | ------------------- |
| `/booking-youtube`                        |         200 | booking/youtube                 | same path with apply flow | preserve apply page |
| `/booking-ig`                             |         200 | booking/ig                      | same path with apply flow | preserve apply page |
| `/booking-x`                              |         200 | booking/x                       | same path with apply flow | preserve apply page |
| `/booking-linkedin`                       |         200 | booking/linkedin                | same path with apply flow | preserve apply page |
| `/apply-vendingpreneurs`                  |         200 | Apply Vendingpreneurs           | same path with apply flow | preserve apply page |
| `/booking-reactivation-email`             |         200 | booking/reactivation-email      | same path with apply flow | preserve apply page |
| `/booking-meta`                           |         200 | book-meta                       | same path with apply flow | preserve apply page |
| `/booking-passivepreneurs`                |         200 | booking/passivepreneurs         | same path with apply flow | preserve apply page |
| `/booking-modern-entrepreneur-newsletter` |         200 | Modern Entrepreneur Newsletter  | same path with apply flow | preserve apply page |
| `/booking-internal-ltf`                   |         200 | booking/internal-ltf            | same path with apply flow | preserve apply page |
| `/booking-tiktok`                         |         200 | booking/tiktok                  | same path with apply flow | preserve apply page |
| `/booking-partner`                        |         200 | Partner                         | same path with apply flow | preserve apply page |
| `/start`                                  |         200 | booking/vendingpreneurs-webinar | same path with apply flow | preserve apply page |
| `/start-your-route-ak-ig`                 |         200 | Start Your Vending Route        | same path with apply flow | preserve apply page |
| `/start-your-route-ak-tt`                 |         200 | Start Your Vending Route        | same path with apply flow | preserve apply page |
| `/schedule-your-call-ig`                  |         200 | Schedule Your Call              | same path with apply flow | preserve apply page |
| `/book-your-call`                         |         200 | Book Your Call                  | same path with apply flow | preserve apply page |

## Active VSL And Lead Landing Funnels

These are marked in use or indexed in the page inventory. They stay available on
their old paths with the new lead form until the VSL/form owner confirms final
copy, form destination, and tracking.

| Old path                      | Live status | Live title                                                   | Intended destination      | Decision            |
| ----------------------------- | ----------: | ------------------------------------------------------------ | ------------------------- | ------------------- |
| `/vending-route-blueprint`    |         200 | Vending Route Blueprint \| Watch Now                         | same path with apply flow | preserve apply page |
| `/start-my-vending-business`  |         200 | Start My Vending Business                                    | same path with apply flow | preserve apply page |
| `/vending-business-blueprint` |         200 | 90-Day Vending Machine Business Blueprint \| VendingPreneurs | same path with apply flow | preserve apply page |

## Redirect Or Archive Lead Funnels

These rows were marked not in use in the page inventory. They are not copied as
standalone pages. They redirect into the active apply path, or into the active
VSL path for a direct duplicate.

| Old path                        | Live status | Live title                   | Intended destination                                      | Decision           |
| ------------------------------- | ----------: | ---------------------------- | --------------------------------------------------------- | ------------------ |
| `/booking-website`              |         200 | booking/website              | `/apply?source_path=/booking-website`                     | permanent redirect |
| `/booking-organicmisc`          |         200 | booking/organicmisc          | `/apply?source_path=/booking-organicmisc`                 | permanent redirect |
| `/booking-ltf`                  |         200 | booking/ltf                  | `/apply?source_path=/booking-ltf`                         | permanent redirect |
| `/booking-reactivation-scraper` |         200 | booking/reactivation-scraper | `/apply?source_path=/booking-reactivation-scraper`        | permanent redirect |
| `/booking-podcast`              |         200 | booking/podcast              | `/apply?source_path=/booking-podcast`                     | permanent redirect |
| `/location-eligibility`         |         200 | Location Eligibility         | `/apply?source_path=/location-eligibility`                | permanent redirect |
| `/build-income-with-vending`    |         200 | Build Income With Vending    | `/apply?source_path=/build-income-with-vending`           | permanent redirect |
| `/vending-blueprint`            |         200 | Vending Route Blueprint      | `/vending-route-blueprint?source_path=/vending-blueprint` | permanent redirect |
| `/join`                         |         200 | Join Vendingpreneurs         | `/apply?source_path=/join`                                | permanent redirect |
| `/vending-training`             |         200 | Vending Training             | `/apply?source_path=/vending-training`                    | permanent redirect |

## Support Pages

These are not normal public acquisition pages. They should not be indexed as
primary public routes. Preserve them only if the real post-submit/pre-call
workflow still sends people there.

| Old path                  | Live status | Live title             | Intended destination | Decision              |
| ------------------------- | ----------: | ---------------------- | -------------------- | --------------------- |
| `/thank-you-for-applying` |         200 | Thank You For Applying | noindex support page | preserve support page |
| `/pre-call-resources`     |         200 | Pre-Call Resources     | noindex support page | preserve support page |

## Test-Only Pages

| Old path            | Live status | Live title | Intended destination | Decision          |
| ------------------- | ----------: | ---------- | -------------------- | ----------------- |
| `/test-leadscore-a` |         200 | TEST       | removed              | remove test route |

## Cody Review Rows

These rows did not have enough decision detail in the screenshot to safely copy
or delete outright. Keep this section synced with `docs/cutover/cody-review-list.md`.

| Old path                            | Live status | Live title               | Intended destination | Decision    |
| ----------------------------------- | ----------: | ------------------------ | -------------------- | ----------- |
| `/booking-vendingpreneurs-training` |         200 | Vendingpreneurs Training | Cody to confirm      | cody review |

## News Articles To Copy Or Publish

These are the news/article rows marked in use and organic/indexed in the page
inventory. They should be the first publish candidates in the News CMS after
content review.

| Old path                                                            | Live status | Live title | Intended destination       | Decision               |
| ------------------------------------------------------------------- | ----------: | ---------- | -------------------------- | ---------------------- |
| `/news/how-to-choose-the-perfect-location-for-vending-machine`      |         200 | article    | same path after CMS import | copy/publish candidate |
| `/news/top-10-profitable-products-to-stock-in-your-vending-machine` |         200 | article    | same path after CMS import | copy/publish candidate |
| `/news/top-5-questions-vending-entrepreneurship-program`            |         200 | article    | same path after CMS import | copy/publish candidate |

## News Articles To Archive Or Leave Unpublished

These article rows were marked not in use in the page inventory. Keep them out
of the public sitemap and leave them unpublished/archived unless Cody reverses a
specific row.

| Old path                                                                            | Live status | Live title | Intended destination | Decision               |
| ----------------------------------------------------------------------------------- | ----------: | ---------- | -------------------- | ---------------------- |
| `/news/7-myths-about-vending-machine-business`                                      |         200 | article    | not published        | archive/no public copy |
| `/news/best-vending-locations-1`                                                    |         200 | article    | not published        | archive/no public copy |
| `/news/best-vending-locations-1-f15cf`                                              |         200 | article    | not published        | archive/no public copy |
| `/news/eco-friendly-zero-waste-vending-machines`                                    |         200 | article    | not published        | archive/no public copy |
| `/news/expected-costs-earnings-roi-vending-machines-2025`                           |         200 | article    | not published        | archive/no public copy |
| `/news/from-zero-to-first-vending-machine-guide`                                    |         200 | article    | not published        | archive/no public copy |
| `/news/how-much-money-do-vending-machines-make-2026`                                |         200 | article    | not published        | archive/no public copy |
| `/news/how-to-build-a-self-managed-route-so-you-can-work-less`                      |         200 | article    | not published        | archive/no public copy |
| `/news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own` |         200 | article    | not published        | archive/no public copy |
| `/news/seasonal-vending-machine-ideas`                                              |         200 | article    | not published        | archive/no public copy |
| `/news/smart-vending-cashless-payments-iot`                                         |         200 | article    | not published        | archive/no public copy |
| `/news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program`    |         200 | article    | not published        | archive/no public copy |
| `/news/top-8-vendpreneur-mistakes-how-to-fix-them`                                  |         200 | article    | not published        | archive/no public copy |
| `/news/vending-business-for-complete-beginners`                                     |         200 | article    | not published        | archive/no public copy |
| `/news/vending-business-taxes-us-beginners-guide`                                   |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-business-course-mentorship-guide`                            |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-business-legal-tax-licensing-2025`                           |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-business-passive-income`                                     |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-innovation-5`                                                |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-insights-5`                                                  |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-installation-checklist`                                      |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-locator-high-earning-spots`                                  |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-locator-services-faqs`                                       |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-placement-2`                                                 |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-success-3`                                                   |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-success-3-8b515`                                             |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-tips-4`                                                      |         200 | article    | not published        | archive/no public copy |
| `/news/vending-machine-trends-4`                                                    |         200 | article    | not published        | archive/no public copy |
| `/news/what-to-check-before-installing-a-vending-machine`                           |         200 | article    | not published        | archive/no public copy |
