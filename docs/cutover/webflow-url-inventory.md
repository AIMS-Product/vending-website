# Webflow URL Inventory

Snapshot date: 2026-05-04
Source: `https://www.vendingpreneurs.com/sitemap.xml`
Total URLs: 72

This inventory is the cutover source of truth for old Webflow URLs. The safe
default is to preserve canonical public pages directly, preserve news slugs via
the CMS where possible, and route lead-intent campaign/booking URLs into the new
`/apply` flow with source attribution instead of recreating old embedded form
behavior.

## Summary

| Category                   | Count | Treatment                                                                  |
| -------------------------- | ----: | -------------------------------------------------------------------------- |
| Core public pages          |     6 | Keep canonical route or permanent redirect to the new canonical route.     |
| Booking/call funnels       |    18 | Redirect to `/apply` with `source_path` unless explicitly cloned later.    |
| Lead/landing funnels       |    14 | Redirect to `/apply` with `source_path` unless explicitly cloned later.    |
| Support/after-submit pages |     2 | Preserve as noindex static support pages or redirect after product review. |
| News articles              |    32 | Import as draft CMS posts, preserving slugs where possible.                |

## Core Public Pages

| Old path          | Live status | Live title                      | Intended destination | Decision           |
| ----------------- | ----------: | ------------------------------- | -------------------- | ------------------ |
| `/`               |         200 | Home \| Vendingprenuers         | `/`                  | keep               |
| `/about-us`       |         200 | About Us \| Vendingprenuers     | `/about`             | permanent redirect |
| `/case-studies`   |         200 | Case Studies \| Vendingprenuers | `/case-studies`      | keep               |
| `/news`           |         200 | News \| Vendingprenuers         | `/news`              | keep               |
| `/privacy-policy` |         200 | privacy policy                  | `/privacy`           | permanent redirect |
| `/terms`          |         200 | terms                           | `/terms`             | keep               |

## Booking And Call Funnels

These are lead-intent URLs. The safe launch treatment is redirecting them into
the new audited lead-capture flow while preserving the original path in
`source_path`.

| Old path                            | Live status | Live title                   | Intended destination                                   | Decision                  |
| ----------------------------------- | ----------: | ---------------------------- | ------------------------------------------------------ | ------------------------- |
| `/booking-meta`                     |         200 | book-meta                    | `/apply?source_path=/booking-meta`                     | redirect with attribution |
| `/booking-ltf`                      |         200 | booking/ltf                  | `/apply?source_path=/booking-ltf`                      | redirect with attribution |
| `/booking-youtube`                  |         200 | booking/youtube              | `/apply?source_path=/booking-youtube`                  | redirect with attribution |
| `/booking-website`                  |         200 | booking/website              | `/apply?source_path=/booking-website`                  | redirect with attribution |
| `/booking-organicmisc`              |         200 | booking/organicmisc          | `/apply?source_path=/booking-organicmisc`              | redirect with attribution |
| `/booking-podcast`                  |         200 | booking/podcast              | `/apply?source_path=/booking-podcast`                  | redirect with attribution |
| `/booking-reactivation-email`       |         200 | booking/reactivation-email   | `/apply?source_path=/booking-reactivation-email`       | redirect with attribution |
| `/booking-reactivation-scraper`     |         200 | booking/reactivation-scraper | `/apply?source_path=/booking-reactivation-scraper`     | redirect with attribution |
| `/booking-ig`                       |         200 | booking/ig                   | `/apply?source_path=/booking-ig`                       | redirect with attribution |
| `/booking-linkedin`                 |         200 | booking/linkedin             | `/apply?source_path=/booking-linkedin`                 | redirect with attribution |
| `/booking-x`                        |         200 | booking/x                    | `/apply?source_path=/booking-x`                        | redirect with attribution |
| `/booking-internal-ltf`             |         200 | booking/internal-ltf         | `/apply?source_path=/booking-internal-ltf`             | redirect with attribution |
| `/booking-passivepreneurs`          |         200 | booking/passivepreneurs      | `/apply?source_path=/booking-passivepreneurs`          | redirect with attribution |
| `/booking-partner`                  |         200 | Partner                      | `/apply?source_path=/booking-partner`                  | redirect with attribution |
| `/booking-tiktok`                   |         200 | booking/tiktok               | `/apply?source_path=/booking-tiktok`                   | redirect with attribution |
| `/booking-vendingpreneurs-training` |         200 | Vendingpreneurs Training     | `/apply?source_path=/booking-vendingpreneurs-training` | redirect with attribution |
| `/schedule-your-call-ig`            |         200 | Schedule Your Call           | `/apply?source_path=/schedule-your-call-ig`            | redirect with attribution |
| `/book-your-call`                   |         200 | Book Your Call               | `/apply?source_path=/book-your-call`                   | redirect with attribution |

## Lead And Landing Funnels

These are campaign, webinar, and application entry points. The safe launch
treatment is the same audited `/apply` flow with source attribution.

| Old path                      | Live status | Live title                                                          | Intended destination                             | Decision                  |
| ----------------------------- | ----------: | ------------------------------------------------------------------- | ------------------------------------------------ | ------------------------- |
| `/start`                      |         200 | booking/vendingpreneurs-webinar                                     | `/apply?source_path=/start`                      | redirect with attribution |
| `/location-eligibility`       |         200 | Location Eligibility                                                | `/apply?source_path=/location-eligibility`       | redirect with attribution |
| `/business`                   |         200 | About Us \| Vendingprenuers                                         | `/about`                                         | permanent redirect        |
| `/vending-blueprint`          |         200 | Vending Route Blueprint \| Watch Now                                | `/apply?source_path=/vending-blueprint`          | redirect with attribution |
| `/start-your-route-ak-ig`     |         200 | Start Your Vending Route \| Vendingpreneurs                         | `/apply?source_path=/start-your-route-ak-ig`     | redirect with attribution |
| `/start-your-route-ak-tt`     |         200 | Start Your Vending Route \| Vendingpreneurs                         | `/apply?source_path=/start-your-route-ak-tt`     | redirect with attribution |
| `/start-my-vending-business`  |         200 | Start My Vending Business                                           | `/apply?source_path=/start-my-vending-business`  | redirect with attribution |
| `/build-income-with-vending`  |         200 | Build Income With Vending \| Watch Now                              | `/apply?source_path=/build-income-with-vending`  | redirect with attribution |
| `/vending-route-blueprint`    |         200 | Vending Route Blueprint \| Watch Now                                | `/apply?source_path=/vending-route-blueprint`    | redirect with attribution |
| `/test-leadscore-a`           |         200 | TEST                                                                | `/apply?source_path=/test-leadscore-a`           | redirect with attribution |
| `/vending-business-blueprint` |         200 | 90-Day Vending Machine Business Blueprint \| VendingPreneurs        | `/apply?source_path=/vending-business-blueprint` | redirect with attribution |
| `/join`                       |         200 | Title tag: Join Vendingpreneurs — Apply to Build Your Vending Route | `/apply?source_path=/join`                       | redirect with attribution |
| `/apply-vendingpreneurs`      |         200 | Apply Vendingpreneurs                                               | `/apply?source_path=/apply-vendingpreneurs`      | redirect with attribution |
| `/vending-training`           |         200 | Vending Training                                                    | `/apply?source_path=/vending-training`           | redirect with attribution |

## Support Pages

These are not normal public acquisition pages. They should not be indexed as
primary public routes. Preserve them only if the real post-submit/pre-call
workflow still sends people there.

| Old path                  | Live status | Live title             | Intended destination | Decision              |
| ------------------------- | ----------: | ---------------------- | -------------------- | --------------------- |
| `/thank-you-for-applying` |         200 | Thank You For Applying | noindex support page | preserve support page |
| `/pre-call-resources`     |         200 | Pre-Call Resources     | noindex support page | preserve support page |

## News Articles

All article paths should be imported into the News CMS as drafts first. Preserve
the old slug as the new slug unless review finds duplicate or obsolete content.
The live Webflow metadata title currently repeats across these article URLs, so
article import must parse the body heading rather than trusting only `<title>`.

| Old path                                                                            | Live status | Intended destination       | Decision     |
| ----------------------------------------------------------------------------------- | ----------: | -------------------------- | ------------ |
| `/news/7-myths-about-vending-machine-business`                                      |         200 | same path after CMS import | draft import |
| `/news/best-vending-locations-1`                                                    |         200 | same path after CMS import | draft import |
| `/news/best-vending-locations-1-f15cf`                                              |         200 | same path after CMS import | draft import |
| `/news/eco-friendly-zero-waste-vending-machines`                                    |         200 | same path after CMS import | draft import |
| `/news/expected-costs-earnings-roi-vending-machines-2025`                           |         200 | same path after CMS import | draft import |
| `/news/from-zero-to-first-vending-machine-guide`                                    |         200 | same path after CMS import | draft import |
| `/news/how-much-money-do-vending-machines-make-2026`                                |         200 | same path after CMS import | draft import |
| `/news/how-to-build-a-self-managed-route-so-you-can-work-less`                      |         200 | same path after CMS import | draft import |
| `/news/how-to-choose-the-perfect-location-for-vending-machine`                      |         200 | same path after CMS import | draft import |
| `/news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own` |         200 | same path after CMS import | draft import |
| `/news/seasonal-vending-machine-ideas`                                              |         200 | same path after CMS import | draft import |
| `/news/smart-vending-cashless-payments-iot`                                         |         200 | same path after CMS import | draft import |
| `/news/top-10-profitable-products-to-stock-in-your-vending-machine`                 |         200 | same path after CMS import | draft import |
| `/news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program`    |         200 | same path after CMS import | draft import |
| `/news/top-5-questions-vending-entrepreneurship-program`                            |         200 | same path after CMS import | draft import |
| `/news/top-8-vendpreneur-mistakes-how-to-fix-them`                                  |         200 | same path after CMS import | draft import |
| `/news/vending-business-for-complete-beginners`                                     |         200 | same path after CMS import | draft import |
| `/news/vending-business-taxes-us-beginners-guide`                                   |         200 | same path after CMS import | draft import |
| `/news/vending-machine-business-course-mentorship-guide`                            |         200 | same path after CMS import | draft import |
| `/news/vending-machine-business-legal-tax-licensing-2025`                           |         200 | same path after CMS import | draft import |
| `/news/vending-machine-business-passive-income`                                     |         200 | same path after CMS import | draft import |
| `/news/vending-machine-innovation-5`                                                |         200 | same path after CMS import | draft import |
| `/news/vending-machine-insights-5`                                                  |         200 | same path after CMS import | draft import |
| `/news/vending-machine-installation-checklist`                                      |         200 | same path after CMS import | draft import |
| `/news/vending-machine-locator-high-earning-spots`                                  |         200 | same path after CMS import | draft import |
| `/news/vending-machine-locator-services-faqs`                                       |         200 | same path after CMS import | draft import |
| `/news/vending-machine-placement-2`                                                 |         200 | same path after CMS import | draft import |
| `/news/vending-machine-success-3`                                                   |         200 | same path after CMS import | draft import |
| `/news/vending-machine-success-3-8b515`                                             |         200 | same path after CMS import | draft import |
| `/news/vending-machine-tips-4`                                                      |         200 | same path after CMS import | draft import |
| `/news/vending-machine-trends-4`                                                    |         200 | same path after CMS import | draft import |
| `/news/what-to-check-before-installing-a-vending-machine`                           |         200 | same path after CMS import | draft import |
