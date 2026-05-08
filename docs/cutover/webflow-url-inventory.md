# Webflow URL Inventory

Snapshot date: 2026-05-04
Source: `https://www.vendingpreneurs.com/sitemap.xml`
Total URLs: 72

This inventory is the cutover source of truth for old Webflow URLs. The safe
default is to preserve canonical public pages directly, preserve news slugs via
the CMS where possible, and render lead-intent campaign/booking URLs with the
new `/apply` flow in place so source attribution is preserved without a
client-visible redirect.

## Summary

| Category                   | Count | Treatment                                                                  |
| -------------------------- | ----: | -------------------------------------------------------------------------- |
| Core public pages          |     7 | Keep canonical route or preserve legacy alias with canonical metadata.     |
| Booking/call funnels       |    18 | Render the apply flow on the old path with source attribution.             |
| Lead/landing funnels       |    13 | Render the apply flow on the old path with source attribution.             |
| Support/after-submit pages |     2 | Preserve as noindex static support pages or redirect after product review. |
| News articles              |    32 | Import as draft CMS posts, preserving slugs where possible.                |

## Core Public Pages

| Old path          | Live status | Live title                      | Intended destination | Decision             |
| ----------------- | ----------: | ------------------------------- | -------------------- | -------------------- |
| `/`               |         200 | Home \| Vendingprenuers         | `/`                  | keep                 |
| `/about-us`       |         200 | About Us \| Vendingprenuers     | `/about`             | preserve route alias |
| `/business`       |         200 | About Us \| Vendingprenuers     | `/about`             | preserve route alias |
| `/case-studies`   |         200 | Case Studies \| Vendingprenuers | `/case-studies`      | keep                 |
| `/news`           |         200 | News \| Vendingprenuers         | `/news`              | keep                 |
| `/privacy-policy` |         200 | privacy policy                  | `/privacy`           | preserve route alias |
| `/terms`          |         200 | terms                           | `/terms`             | keep                 |

## Booking And Call Funnels

These are lead-intent URLs. The safe launch treatment is rendering the new
audited lead-capture flow on the original path while preserving that path in
`source_path` and `landing_path`.

| Old path                            | Live status | Live title                   | Intended destination      | Decision            |
| ----------------------------------- | ----------: | ---------------------------- | ------------------------- | ------------------- |
| `/booking-meta`                     |         200 | book-meta                    | same path with apply flow | preserve apply page |
| `/booking-ltf`                      |         200 | booking/ltf                  | same path with apply flow | preserve apply page |
| `/booking-youtube`                  |         200 | booking/youtube              | same path with apply flow | preserve apply page |
| `/booking-website`                  |         200 | booking/website              | same path with apply flow | preserve apply page |
| `/booking-organicmisc`              |         200 | booking/organicmisc          | same path with apply flow | preserve apply page |
| `/booking-podcast`                  |         200 | booking/podcast              | same path with apply flow | preserve apply page |
| `/booking-reactivation-email`       |         200 | booking/reactivation-email   | same path with apply flow | preserve apply page |
| `/booking-reactivation-scraper`     |         200 | booking/reactivation-scraper | same path with apply flow | preserve apply page |
| `/booking-ig`                       |         200 | booking/ig                   | same path with apply flow | preserve apply page |
| `/booking-linkedin`                 |         200 | booking/linkedin             | same path with apply flow | preserve apply page |
| `/booking-x`                        |         200 | booking/x                    | same path with apply flow | preserve apply page |
| `/booking-internal-ltf`             |         200 | booking/internal-ltf         | same path with apply flow | preserve apply page |
| `/booking-passivepreneurs`          |         200 | booking/passivepreneurs      | same path with apply flow | preserve apply page |
| `/booking-partner`                  |         200 | Partner                      | same path with apply flow | preserve apply page |
| `/booking-tiktok`                   |         200 | booking/tiktok               | same path with apply flow | preserve apply page |
| `/booking-vendingpreneurs-training` |         200 | Vendingpreneurs Training     | same path with apply flow | preserve apply page |
| `/schedule-your-call-ig`            |         200 | Schedule Your Call           | same path with apply flow | preserve apply page |
| `/book-your-call`                   |         200 | Book Your Call               | same path with apply flow | preserve apply page |

## Lead And Landing Funnels

These are campaign, webinar, and application entry points. The safe launch
treatment is the same audited apply flow rendered on the old path with source
attribution.

| Old path                      | Live status | Live title                                                          | Intended destination      | Decision            |
| ----------------------------- | ----------: | ------------------------------------------------------------------- | ------------------------- | ------------------- |
| `/start`                      |         200 | booking/vendingpreneurs-webinar                                     | same path with apply flow | preserve apply page |
| `/location-eligibility`       |         200 | Location Eligibility                                                | same path with apply flow | preserve apply page |
| `/vending-blueprint`          |         200 | Vending Route Blueprint \| Watch Now                                | same path with apply flow | preserve apply page |
| `/start-your-route-ak-ig`     |         200 | Start Your Vending Route \| Vendingpreneurs                         | same path with apply flow | preserve apply page |
| `/start-your-route-ak-tt`     |         200 | Start Your Vending Route \| Vendingpreneurs                         | same path with apply flow | preserve apply page |
| `/start-my-vending-business`  |         200 | Start My Vending Business                                           | same path with apply flow | preserve apply page |
| `/build-income-with-vending`  |         200 | Build Income With Vending \| Watch Now                              | same path with apply flow | preserve apply page |
| `/vending-route-blueprint`    |         200 | Vending Route Blueprint \| Watch Now                                | same path with apply flow | preserve apply page |
| `/test-leadscore-a`           |         200 | TEST                                                                | same path with apply flow | preserve apply page |
| `/vending-business-blueprint` |         200 | 90-Day Vending Machine Business Blueprint \| VendingPreneurs        | same path with apply flow | preserve apply page |
| `/join`                       |         200 | Title tag: Join Vendingpreneurs — Apply to Build Your Vending Route | same path with apply flow | preserve apply page |
| `/apply-vendingpreneurs`      |         200 | Apply Vendingpreneurs                                               | same path with apply flow | preserve apply page |
| `/vending-training`           |         200 | Vending Training                                                    | same path with apply flow | preserve apply page |

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
