# Cutover Redirect Matrix

Generated: 2026-05-04T05:07:45.041Z
Base URL: http://localhost:3010
Checked URLs: 72
Failures: 0

| Old path                                                                            | Expected             | Actual status | Signal                                                                 | Result |
| ----------------------------------------------------------------------------------- | -------------------- | ------------: | ---------------------------------------------------------------------- | ------ |
| `/`                                                                                 | canonical 200        |           200 | http://localhost:3010/                                                 | pass   |
| `/about-us`                                                                         | 308 /about           |           308 | /about?utm_source=matrix                                               | pass   |
| `/case-studies`                                                                     | canonical 200        |           200 | http://localhost:3010/case-studies                                     | pass   |
| `/news`                                                                             | canonical 200        |           200 | http://localhost:3010/news                                             | pass   |
| `/privacy-policy`                                                                   | 308 /privacy         |           308 | /privacy?utm_source=matrix                                             | pass   |
| `/terms`                                                                            | canonical 200        |           200 | http://localhost:3010/terms                                            | pass   |
| `/booking-meta`                                                                     | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-meta                     | pass   |
| `/booking-ltf`                                                                      | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-ltf                      | pass   |
| `/booking-youtube`                                                                  | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-youtube                  | pass   |
| `/booking-website`                                                                  | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-website                  | pass   |
| `/booking-organicmisc`                                                              | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-organicmisc              | pass   |
| `/booking-podcast`                                                                  | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-podcast                  | pass   |
| `/booking-reactivation-email`                                                       | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-reactivation-email       | pass   |
| `/booking-reactivation-scraper`                                                     | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-reactivation-scraper     | pass   |
| `/booking-ig`                                                                       | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-ig                       | pass   |
| `/booking-linkedin`                                                                 | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-linkedin                 | pass   |
| `/booking-x`                                                                        | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-x                        | pass   |
| `/booking-internal-ltf`                                                             | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-internal-ltf             | pass   |
| `/booking-passivepreneurs`                                                          | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-passivepreneurs          | pass   |
| `/booking-partner`                                                                  | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-partner                  | pass   |
| `/booking-tiktok`                                                                   | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-tiktok                   | pass   |
| `/booking-vendingpreneurs-training`                                                 | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/booking-vendingpreneurs-training | pass   |
| `/schedule-your-call-ig`                                                            | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/schedule-your-call-ig            | pass   |
| `/book-your-call`                                                                   | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/book-your-call                   | pass   |
| `/start`                                                                            | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/start                            | pass   |
| `/location-eligibility`                                                             | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/location-eligibility             | pass   |
| `/business`                                                                         | 308 /about           |           308 | /about?utm_source=matrix                                               | pass   |
| `/vending-blueprint`                                                                | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/vending-blueprint                | pass   |
| `/start-your-route-ak-ig`                                                           | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/start-your-route-ak-ig           | pass   |
| `/start-your-route-ak-tt`                                                           | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/start-your-route-ak-tt           | pass   |
| `/start-my-vending-business`                                                        | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/start-my-vending-business        | pass   |
| `/build-income-with-vending`                                                        | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/build-income-with-vending        | pass   |
| `/vending-route-blueprint`                                                          | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/vending-route-blueprint          | pass   |
| `/test-leadscore-a`                                                                 | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/test-leadscore-a                 | pass   |
| `/vending-business-blueprint`                                                       | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/vending-business-blueprint       | pass   |
| `/join`                                                                             | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/join                             | pass   |
| `/apply-vendingpreneurs`                                                            | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/apply-vendingpreneurs            | pass   |
| `/vending-training`                                                                 | 307 /apply           |           307 | /apply?utm_source=matrix&source_path=/vending-training                 | pass   |
| `/thank-you-for-applying`                                                           | support 200 noindex  |           200 | noindex                                                                | pass   |
| `/pre-call-resources`                                                               | support 200 noindex  |           200 | noindex                                                                | pass   |
| `/news/7-myths-about-vending-machine-business`                                      | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/best-vending-locations-1`                                                    | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/best-vending-locations-1-f15cf`                                              | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/eco-friendly-zero-waste-vending-machines`                                    | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/expected-costs-earnings-roi-vending-machines-2025`                           | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/from-zero-to-first-vending-machine-guide`                                    | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/how-much-money-do-vending-machines-make-2026`                                | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/how-to-build-a-self-managed-route-so-you-can-work-less`                      | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/how-to-choose-the-perfect-location-for-vending-machine`                      | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own` | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/seasonal-vending-machine-ideas`                                              | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/smart-vending-cashless-payments-iot`                                         | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/top-10-profitable-products-to-stock-in-your-vending-machine`                 | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program`    | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/top-5-questions-vending-entrepreneurship-program`                            | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/top-8-vendpreneur-mistakes-how-to-fix-them`                                  | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-business-for-complete-beginners`                                     | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-business-taxes-us-beginners-guide`                                   | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-business-course-mentorship-guide`                            | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-business-legal-tax-licensing-2025`                           | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-business-passive-income`                                     | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-innovation-5`                                                | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-insights-5`                                                  | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-installation-checklist`                                      | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-locator-high-earning-spots`                                  | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-locator-services-faqs`                                       | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-placement-2`                                                 | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-success-3`                                                   | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-success-3-8b515`                                             | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-tips-4`                                                      | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/vending-machine-trends-4`                                                    | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
| `/news/what-to-check-before-installing-a-vending-machine`                           | news article not 5xx |           200 | draft/not-found noindex                                                | pass   |
