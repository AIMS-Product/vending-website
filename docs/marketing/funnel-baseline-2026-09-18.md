# Funnel conversion baseline — 2026-09-18

Frozen snapshot. The admin tab recomputes from live tables and will drift from this as Close reconciles later outcomes; this file is the record of where we started. Booking funnels were rebuilt on **2026-09-17**.

## How to read it

- A dash means not observed. It is never a zero.
- **Opt-in %** is measured only over days GA4 had finished counting (through 2026-09-17), on both sides of the division.
- **Qs** is the questions after the contact details. Somebody who typed into the form and left before the first submit writes no row anywhere, so they are not counted here or anywhere else.
- **Show %** covers 96.3% of booked calls (494 of 513 old enough to judge carry a yes/no in Close). The rest leave the denominator rather than counting as no-shows.
- **Win %** waits 30 days. The Won count does not — a sale is a fact the day it happens; the rate only opens once the calls behind it are old enough that a missing sale means something.
- Every row is a lead cohort: the month is the month the person arrived, and their later booking, call and sale count in that month whenever they happened.

## Either side of the rebuild (2026-09-17)

2 days since (Sep 17 – Sep 18) against 2 days before (Sep 10 – Sep 11) — same weekdays, a week apart.

> Visit counts in the later window stop at 2026-09-17, so it holds fewer days of traffic than the earlier one. The rates are unaffected — both sides of each division use the same days — but do not read the two visit totals against each other.

| Window                          | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| ------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| 2 days before (Sep 10 – Sep 11) | 920    | 32    | 3.5%     | 21         | 2       | 90.5%     | 20     | 62.5%  | 7    | 46.7%  | 1   | —     | $5,997  |
| 2 days since (Sep 17 – Sep 18)  | 416    | 27    | 3.4%     | 24         | 7       | 70.8%     | 12     | 44.4%  | 1    | 100.0% | 0   | 0.0%  | —       |

## September 2026

| Funnel                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win %  | Revenue  |
| ----------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ------ | -------- |
| /contact *                                                        | 3298   | 78    | 2.3%     | 65         | 21      | 67.7%     | 32     | 41.0%  | 16   | 57.1%  | 2   | —      | $13,794  |
| /booking-youtube *                                                | 707    | 77    | 10.2%    | 73         | 12      | 83.6%     | 54     | 70.1%  | 20   | 66.7%  | 8   | —      | $84,276  |
| /                                                                 | 1901   | 64    | 3.1%     | 40         | 11      | 72.5%     | 38     | 59.4%  | 19   | 82.6%  | 1   | 33.3%  | $5,997   |
| /booking-t5-socials *                                             | 96     | 39    | 40.6%    | —          | —       | —         | 33     | 84.6%  | 14   | 56.0%  | 4   | 100.0% | $22,179  |
| /about                                                            | 110    | 14    | 12.7%    | 12         | 2       | 83.3%     | 11     | 78.6%  | 5    | 55.6%  | 1   | 100.0% | $5,997   |
| /resources/roadmap                                                | 31     | 10    | 29.0%    | 9          | 1       | 88.9%     | 4      | 40.0%  | 1    | 50.0%  | 0   | —      | —        |
| /news                                                             | 198    | 9     | 4.5%     | 8          | 2       | 75.0%     | 4      | 44.4%  | 4    | 100.0% | 0   | —      | —        |
| /pre-call-resources                                               | 282    | 7     | 2.5%     | 4          | 1       | 75.0%     | 7      | 100.0% | 1    | 20.0%  | 0   | —      | —        |
| /news/best-vending-locations                                      | 42     | 4     | 9.5%     | 2          | 1       | 50.0%     | 2      | 50.0%  | 1    | 100.0% | 0   | —      | —        |
| /book-now *                                                       | 3      | 3     | 100.0%   | 1          | 0       | 100.0%    | 2      | 66.7%  | —    | —      | 0   | —      | —        |
| /start                                                            | 252    | 2     | 0.8%     | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —      | —        |
| /case-studies/musa-sadi                                           | 26     | 2     | 7.7%     | 1          | 0       | 100.0%    | 1      | 50.0%  | —    | —      | 0   | —      | —        |
| /booking-ak-t5 *                                                  | 19     | 2     | 10.5%    | —          | —       | —         | 2      | 100.0% | 1    | 50.0%  | 0   | —      | —        |
| /thank-you-for-applying                                           | 17     | 2     | 11.8%    | —          | —       | —         | 2      | 100.0% | 0    | 0.0%   | 0   | —      | —        |
| /newsletter                                                       | 5      | 2     | 40.0%    | 2          | 0       | 100.0%    | 1      | 50.0%  | 1    | 100.0% | 0   | —      | —        |
| /case-studies                                                     | 324    | 1     | 0.3%     | 1          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —      | —        |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine | 54     | 1     | 1.9%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | —      | —        |
| /book-my-advisory-call-l1-topcl                                   | 29     | 1     | 3.4%     | —          | —       | —         | 1      | 100.0% | 1    | 100.0% | 0   | —      | —        |
| /privacy                                                          | 23     | 1     | 4.3%     | 1          | 1       | 0.0%      | 1      | 100.0% | —    | —      | 0   | —      | —        |
| /case-studies/dj-50k-per-month                                    | 17     | 1     | 5.9%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | —      | —        |
| /news/top-5-questions-vending-entrepreneurship-program            | 15     | 1     | 6.7%     | 1          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —      | —        |
| /vending-business-blueprint                                       | 5      | 1     | 20.0%    | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —      | —        |
| /case-studies/tim-barnes                                          | 5      | 1     | 20.0%    | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | —      | —        |
| /resources/roadmap-thank-you                                      | 3      | 1     | 33.3%    | 1          | 1       | 0.0%      | 0      | 0.0%   | —    | —      | 0   | —      | —        |
| /terms                                                            | 42     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/login                                                      | 31     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/analytics                                                  | 29     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /vending-route-blueprint                                          | 19     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/anthony-kolodziej                                   | 19     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/shan-25k-per-month                                  | 18     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/john-and-lauren-sanchez                             | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/tom-canarino                                        | 15     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/sandy-and-joe                                       | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/graham-and-katie-parker                             | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/tyrone-lewis                                        | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/andy-consulman                                      | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin                                                            | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/mallerie-rouch                                      | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/lane-200k-per-year                                  | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/michael-d-600k-per-year                             | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/jason-500-machines                                  | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/matt-dicks                                          | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/links                                                      | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/matt-morrison                                       | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/manuel-duval                                        | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/javier-zeder                                        | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot/conversations                                      | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/evan-tomahong                                       | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/kyle-40k-per-month                                  | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/jesse-lee                                           | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/forgot-password                                            | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /book-my-advisory-call-setter                                     | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /booking-internal-ltf *                                           | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /spam-policy                                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /resources/vending-in-colleges                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /booking-meta *                                                   | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot/conversations/1c8d87d2-56c8-4979-80a1-58a58e83194c | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/case-studies                                               | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/libraries                                                  | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/bookings                                                   | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/goals                                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /qualify/1drn-yb8qlrf4isyzozt5khd8ynahazaisu7-f5ueh8              | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/team                                                       | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /booking-reactivation-email *                                     | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/john-real-estate-agent                              | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/leads                                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /qualify/eckh00blloh11ako3wp7mchw-noriq7zksyxppzwi5c              | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/cac                                                        | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot/conversations/ec13d0c6-3b4d-44a5-9345-322b2f60efa1 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /account/profile                                                  | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot/conversations/f1950c67-8f54-4eed-b9eb-0b1e8c40bbbe | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/madison-6-locations                                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/chatbot/conversations/7947526c-433e-43ac-b69a-fa742ed71319 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/forms                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /api/admin/webinar-ingest                                         | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /resources/finance-templates                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/joe-retiree-route                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /case-studies/dj-fuchs                                            | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /booking-ig                                                       | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/settings/users                                             | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/attribution                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| /admin/pages                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —        |
| **All funnels**                                                   | 7840   | 324   | 4.0%     | 224        | 53      | 76.3%     | 198    | 61.1%  | 87   | 64.4%  | 16  | 60.0%  | $132,243 |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## August 2026

| Funnel                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue  |
| ----------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | -------- |
| /                                                                 | 5212   | 183   | 3.5%     | 164        | 31      | 81.1%     | 109    | 59.6%  | 53   | 58.9%  | 9   | 8.1%  | $114,832 |
| /booking-youtube *                                                | 1158   | 137   | 11.8%    | 132        | 19      | 85.6%     | 100    | 73.0%  | 63   | 79.7%  | 9   | 9.7%  | $69,573  |
| /contact *                                                        | 2484   | 59    | 2.4%     | 53         | 13      | 75.5%     | 39     | 66.1%  | 15   | 45.5%  | 3   | 20.0% | $20,691  |
| /booking-t5-socials *                                             | 142    | 55    | 38.7%    | —          | —       | —         | 46     | 83.6%  | 21   | 55.3%  | 3   | 18.2% | $20,991  |
| /booking-meta *                                                   | 1215   | 49    | 4.0%     | 49         | 14      | 71.4%     | 21     | 42.9%  | 8    | 57.1%  | 1   | 12.5% | $5,997   |
| /newsletter                                                       | 76     | 26    | 34.2%    | 26         | 6       | 76.9%     | 2      | 7.7%   | 2    | 100.0% | 1   | 50.0% | $1,188   |
| /about                                                            | 89     | 22    | 24.7%    | 22         | 3       | 86.4%     | 13     | 59.1%  | 7    | 77.8%  | 1   | 0.0%  | $6,897   |
| /news                                                             | 95     | 10    | 10.5%    | 10         | 1       | 90.0%     | 5      | 50.0%  | 0    | 0.0%   | 0   | —     | —        |
| /booking-ak-t5 *                                                  | 31     | 10    | 32.3%    | —          | —       | —         | 9      | 90.0%  | 5    | 83.3%  | 0   | 0.0%  | —        |
| /pre-call-resources                                               | 170    | 9     | 5.3%     | 8          | 1       | 87.5%     | 8      | 88.9%  | 6    | 100.0% | 3   | 0.0%  | $17,991  |
| /start                                                            | 233    | 6     | 2.6%     | 3          | 1       | 66.7%     | 4      | 66.7%  | 2    | 66.7%  | 1   | —     | $5,997   |
| /case-studies                                                     | 139    | 6     | 4.3%     | 6          | 0       | 100.0%    | 4      | 66.7%  | 3    | 100.0% | 1   | 0.0%  | $5,997   |
| /vending-route-blueprint                                          | 49     | 6     | 12.2%    | —          | —       | —         | 1      | 16.7%  | —    | —      | 1   | —     | $10,347  |
| /resources/roadmap                                                | 23     | 2     | 8.7%     | 2          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /vending-business-blueprint                                       | 7      | 2     | 28.6%    | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /booking-website                                                  | 0      | 2     | —        | 2          | 0       | 100.0%    | 1      | 50.0%  | 0    | 0.0%   | 0   | —     | —        |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine | 112    | 1     | 0.9%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | —     | —        |
| /terms                                                            | 79     | 1     | 1.3%     | 1          | 1       | 0.0%      | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /privacy                                                          | 69     | 1     | 1.4%     | 1          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /news/how-to-choose-the-perfect-location-for-vending-machine      | 40     | 1     | 2.5%     | 1          | 1       | 0.0%      | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /news/top-5-questions-vending-entrepreneurship-program            | 28     | 1     | 3.6%     | 1          | 0       | 100.0%    | 1      | 100.0% | 0    | 0.0%   | 0   | —     | —        |
| /booking-ig                                                       | 11     | 1     | 9.1%     | 1          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /thank-you-for-applying                                           | 10     | 1     | 10.0%    | 1          | 1       | 0.0%      | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /book-my-advisory-call-setter                                     | 5      | 1     | 20.0%    | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /booking-passivepreneurs *                                        | 3      | 1     | 33.3%    | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /case-studies/tyrone-lewis                                        | 2      | 1     | 50.0%    | 1          | 0       | 100.0%    | 1      | 100.0% | 0    | 0.0%   | 0   | —     | —        |
| /book-now *                                                       | 2      | 1     | 50.0%    | —          | —       | —         | 1      | 100.0% | 1    | 100.0% | 0   | —     | —        |
| /booking-x                                                        | 1      | 1     | 100.0%   | 1          | 1       | 0.0%      | 1      | 100.0% | —    | —      | 0   | —     | —        |
| /location-eligibility                                             | 0      | 1     | —        | 1          | 1       | 0.0%      | 0      | 0.0%   | —    | —      | 0   | —     | —        |
| /your-call-is-booked                                              | 39     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin                                                            | 20     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /vending-route-builder                                            | 14     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/tim-barnes                                          | 14     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /news/best-vending-locations                                      | 14     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/musa-sadi                                           | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /build-your-vending-business                                      | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /book-my-advisory-call-l1                                         | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /accelerator                                                      | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/shan-25k-per-month                                  | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /solutions/vendscout                                              | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/login                                                      | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/graham-and-katie-parker                             | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /book-my-advisory-call-l1-topcl                                   | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/analytics                                                  | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /booking-partner *                                                | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /booking-internal-ltf *                                           | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/leads                                                      | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/pages                                                      | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /resources/finance-templates                                      | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/chatbot                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /spam-policy                                                      | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /route-builder                                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /accelerator-2026                                                 | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/attribution                                                | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /vending-accelerator-program                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /booking-masterclass-replay                                       | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-study-preview                                               | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /str-x                                                            | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/tom-canarino                                        | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/anthony-kolodziej                                   | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /robotic-vending-mentorship                                       | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /apply-youtube                                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/pages/d45dbf87-e574-4aff-b6ac-9871fc976f9e                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /accelerator-program                                              | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /ai-accelerator                                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /book-your-call                                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /90-day-checklist                                                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /community                                                        | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /schedule-your-call-ig                                            | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /_                                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /booking-t5-soc…                                                  | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/john-and-lauren-sanchez                             | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /admin/case-studies                                               | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /webinar                                                          | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/evan-tomahong                                       | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /solutions                                                        | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/jason-500-machines                                  | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /process/find-locations                                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/madison-6-locations                                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/manuel-duval                                        | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /"                                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /*                                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/dj-50k-per-month                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| /case-studies/sandy-and-joe                                       | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —        |
| **All funnels**                                                   | 11731  | 597   | 5.1%     | 487        | 94      | 80.7%     | 367    | 61.5%  | 187  | 64.5%  | 33  | 10.6% | $280,501 |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## July 2026

| Funnel                                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win %  | Revenue |
| --------------------------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ------ | ------- |
| /booking-t5-socials *                                                             | 135    | 33    | 24.4%    | —          | —       | —         | 31     | 93.9%  | 18   | 69.2%  | 3   | 16.7%  | $21,991 |
| /                                                                                 | 6254   | 29    | 0.5%     | 29         | 3       | 89.7%     | 16     | 55.2%  | 13   | 100.0% | 1   | 7.7%   | $6,897  |
| /booking-youtube *                                                                | 1499   | 29    | 1.9%     | 29         | 2       | 93.1%     | 16     | 55.2%  | 11   | 84.6%  | 2   | 18.2%  | $17,994 |
| /booking-meta *                                                                   | 2320   | 21    | 0.9%     | 21         | 3       | 85.7%     | 7      | 33.3%  | 2    | 28.6%  | 0   | 0.0%   | —       |
| /about                                                                            | 20     | 5     | 25.0%    | 5          | 2       | 60.0%     | 4      | 80.0%  | 2    | 66.7%  | 1   | 50.0%  | $1,188  |
| /case-studies                                                                     | 133    | 4     | 3.0%     | 4          | 0       | 100.0%    | 2      | 50.0%  | 2    | 100.0% | 0   | 0.0%   | —       |
| /start                                                                            | 173    | 3     | 1.7%     | 3          | 0       | 100.0%    | 2      | 66.7%  | 1    | 50.0%  | 0   | 0.0%   | —       |
| /booking-ig                                                                       | 146    | 3     | 2.1%     | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —      | —       |
| /booking-ak-t5 *                                                                  | 18     | 2     | 11.1%    | —          | —       | —         | 0      | 0.0%   | —    | —      | 0   | —      | —       |
| /contact *                                                                        | 1222   | 1     | 0.1%     | 1          | 0       | 100.0%    | 0      | 0.0%   | —    | —      | 0   | —      | —       |
| /news                                                                             | 265    | 1     | 0.4%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 1   | 100.0% | $5,997  |
| /pre-call-resources                                                               | 64     | 1     | 1.6%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | 0.0%   | —       |
| /news/top-5-questions-vending-entrepreneurship-program                            | 18     | 1     | 5.6%     | 1          | 0       | 100.0%    | 1      | 100.0% | 1    | 100.0% | 0   | 0.0%   | —       |
| /your-call-is-booked                                                              | 261    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /privacy-policy                                                                   | 229    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /about-us                                                                         | 172    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /vending-route-blueprint                                                          | 133    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/how-much-money-do-vending-machines-make-2026                                | 75     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /book-my-advisory-call-l1                                                         | 68     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-business-taxes-us-beginners-guide                                   | 66     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine                 | 56     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-locator-high-earning-spots                                  | 50     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /terms                                                                            | 37     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-business-for-complete-beginners                                     | 36     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                      | 34     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-business-passive-income                                     | 31     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program    | 25     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /vending-route-builder                                                            | 21     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /thank-you-for-applying                                                           | 20     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-masterclass-replay                                                       | 19     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /admin/login                                                                      | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-passivepreneurs *                                                        | 15     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/finance-first-vending-machines-without-loans                                | 15     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/how-to-build-a-self-managed-route-so-you-can-work-less                      | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/seasonal-vending-machine-ideas                                              | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/best-vending-machines-schools-offices-gyms                                  | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                           | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-reactivation-email *                                                     | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-locator-services-faqs                                       | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/what-to-check-before-installing-a-vending-machine                           | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/top-8-vendpreneur-mistakes-how-to-fix-them                                  | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/eco-friendly-zero-waste-vending-machines                                    | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-installation-checklist                                      | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-x                                                                        | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/7-myths-about-vending-machine-business                                      | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /vending-business-blueprint                                                       | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-business-course-mentorship-guide                            | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-business-legal-tax-licensing-2025                           | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /admin/pages                                                                      | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/smart-vending-cashless-payments-iot                                         | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/best-vending-locations-1-f15cf                                              | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /join                                                                             | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-internal-ltf *                                                           | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /vending-training                                                                 | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /location-eligibility                                                             | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/best-vending-locations-1                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /admin/analytics                                                                  | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /privacy                                                                          | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-placement-2                                                 | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-partner *                                                                | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /schedule-your-call-ig                                                            | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /book-my-advisory-call-setter                                                     | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/from-zero-to-first-vending-machine-guide                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /admin                                                                            | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /resources/roadmap                                                                | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-placement-2-c6bb6                                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-trends-4                                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /vending-blueprint                                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /booking-insta-01                                                                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-innovation-5                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-success-3                                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /news/vending-machine-tips-4                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /careers                                                                          | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| /admin/forms                                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —      | —       |
| **All funnels**                                                                   | 13820  | 133   | 1.0%     | 95         | 10      | 89.5%     | 81     | 60.9%  | 52   | 75.4%  | 8   | 15.4%  | $54,067 |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## June 2026

| Funnel                                                                         | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| ------------------------------------------------------------------------------ | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| /                                                                              | 5855   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-youtube *                                                             | 1448   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-meta *                                                                | 1415   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /contact *                                                                     | 1056   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-route-blueprint                                                       | 327    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news                                                                          | 315    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start                                                                         | 308    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /your-call-is-booked                                                           | 207    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-route-builder                                                         | 194    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /privacy-policy                                                                | 186    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ig                                                                    | 149    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /case-studies                                                                  | 136    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /about-us                                                                      | 131    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /terms                                                                         | 76     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-for-complete-beginners                                  | 72     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine              | 54     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /pre-call-resources                                                            | 51     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-much-money-do-vending-machines-make-2026                             | 47     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-high-earning-spots                               | 47     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-passivepreneurs *                                                     | 40     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-t5-socials *                                                          | 31     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-x                                                                     | 25     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-vending-entrepreneurship-program                         | 23     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-taxes-us-beginners-guide                                | 23     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-my-advisory-call-l1-topcl                                                | 21     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /thank-you-for-applying                                                        | 18     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-my-advisory-call-setter                                                  | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/what-to-check-before-installing-a-vending-machine                        | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ak-t5 *                                                               | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                        | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-machines-schools-offices-gyms                               | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-build-a-self-managed-route-so-you-can-work-less                   | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                   | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/seasonal-vending-machine-ideas                                           | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /join                                                                          | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/finance-first-vending-machines-without-loans                             | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-course-mentorship-guide                         | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-my-advisory-call-l1                                                      | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/eco-friendly-zero-waste-vending-machines                                 | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/from-zero-to-first-vending-machine-guide                                 | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-8-vendpreneur-mistakes-how-to-fix-them                               | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-legal-tax-licensing-2025                        | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /location-eligibility                                                          | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-services-faqs                                    | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-my-advisory-call                                                         | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /build-your-vending-business                                                   | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-installation-checklist                                   | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-your-call                                                                | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-passive-income                                  | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2-c6bb6                                        | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-innovation-5                                             | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-insights-5                                               | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/7-myths-about-vending-machine-business                                   | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1                                                 | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start-your-route-ak-tt                                                        | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-blueprint                                                             | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-partner *                                                             | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/smart-vending-cashless-payments-iot                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /schedule-your-call-ig                                                         | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-masterclass-replay                                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-trends-4                                                 | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-website                                                               | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-training                                                              | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2                                              | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-business-blueprint                                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1-f15cf                                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| **All funnels**                                                                | 12468  | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## May 2026

| Funnel                                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| --------------------------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| /vending-route-blueprint                                                          | 5439   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /                                                                                 | 3996   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-meta *                                                                   | 1675   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-youtube *                                                                | 1394   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /contact *                                                                        | 712    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /your-call-is-booked                                                              | 341    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /terms                                                                            | 334    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /privacy-policy                                                                   | 313    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ig                                                                       | 304    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-website                                                                  | 242    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news                                                                             | 167    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start                                                                            | 162    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /pre-call-resources                                                               | 137    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /case-studies                                                                     | 132    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /about-us                                                                         | 119    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /book-your-call                                                                   | 111    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine                 | 53     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-much-money-do-vending-machines-make-2026                                | 46     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-route-builder                                                            | 44     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-x                                                                        | 36     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-for-complete-beginners                                     | 35     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-vending-entrepreneurship-program                            | 31     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /join                                                                             | 29     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                      | 28     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-taxes-us-beginners-guide                                   | 19     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-high-earning-spots                                  | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ak-t5 *                                                                  | 15     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /location-eligibility                                                             | 14     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/seasonal-vending-machine-ideas                                              | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-t5-socials *                                                             | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /thank-you-for-applying                                                           | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /schedule-your-call-ig                                                            | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/from-zero-to-first-vending-machine-guide                                    | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                           | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-legal-tax-licensing-2025                           | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-business-blueprint                                                       | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-machines-schools-offices-gyms                                  | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-blueprint                                                                | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-services-faqs                                       | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-8-vendpreneur-mistakes-how-to-fix-them                                  | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-course-mentorship-guide                            | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-build-a-self-managed-route-so-you-can-work-less                      | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/finance-first-vending-machines-without-loans                                | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/what-to-check-before-installing-a-vending-machine                           | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/eco-friendly-zero-waste-vending-machines                                    | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-internal-ltf *                                                           | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-installation-checklist                                      | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-passive-income                                     | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/smart-vending-cashless-payments-iot                                         | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-training                                                                 | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start-your-route-ak-tt                                                           | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1                                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-passivepreneurs *                                                        | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ltf                                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-trends-4                                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/7-myths-about-vending-machine-business                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2-c6bb6                                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-partner *                                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /build-income-with-vending                                                        | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1-f15cf                                              | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-reactivation-scraper                                                     | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| **All funnels**                                                                   | 16108  | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## April 2026

| Funnel                                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| --------------------------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| /vending-route-blueprint                                                          | 6999   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /                                                                                 | 2934   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-meta *                                                                   | 2211   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-youtube *                                                                | 1232   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ig                                                                       | 539    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-website                                                                  | 360    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start                                                                            | 323    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-t5-socials *                                                             | 178    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-blueprint                                                                | 178    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-passivepreneurs *                                                        | 160    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /contact *                                                                        | 136    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /case-studies                                                                     | 112    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /about-us                                                                         | 92     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-partner *                                                                | 75     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ak-t5 *                                                                  | 57     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine                 | 50     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /location-eligibility                                                             | 45     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /terms                                                                            | 42     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-much-money-do-vending-machines-make-2026                                | 40     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news                                                                             | 32     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-x                                                                        | 27     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-vending-entrepreneurship-program                            | 21     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                      | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                           | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /privacy-policy                                                                   | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/7-myths-about-vending-machine-business                                      | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/from-zero-to-first-vending-machine-guide                                    | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-for-complete-beginners                                     | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/finance-first-vending-machines-without-loans                                | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-machines-schools-offices-gyms                                  | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-legal-tax-licensing-2025                           | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-high-earning-spots                                  | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-success-3-8b515                                             | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/what-to-check-before-installing-a-vending-machine                           | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-business-blueprint                                                       | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2                                                 | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-course-mentorship-guide                            | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /build-income-with-vending                                                        | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /test-leadscore-a                                                                 | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/seasonal-vending-machine-ideas                                              | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-passive-income                                     | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-build-a-self-managed-route-so-you-can-work-less                      | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/eco-friendly-zero-waste-vending-machines                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1-f15cf                                              | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/smart-vending-cashless-payments-iot                                         | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-insights-5                                                  | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-installation-checklist                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-8-vendpreneur-mistakes-how-to-fix-them                                  | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2-c6bb6                                           | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start-your-route-ak-tt                                                           | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-services-faqs                                       | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-tips-4                                                      | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-innovation-5                                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-trends-4                                                    | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-internal-ltf *                                                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-taxes-us-beginners-guide                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /schedule-your-call-ig                                                            | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| **All funnels**                                                                   | 16013  | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## March 2026

| Funnel                                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| --------------------------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| /vending-blueprint                                                                | 12168  | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /                                                                                 | 4216   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-passivepreneurs *                                                        | 2274   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /build-income-with-vending                                                        | 1230   | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-youtube *                                                                | 921    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ig                                                                       | 886    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start                                                                            | 700    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /case-studies                                                                     | 203    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-website                                                                  | 194    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-route-blueprint                                                          | 164    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /about-us                                                                         | 142    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine                 | 127    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-vendingpreneurs-training                                                 | 94     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ak-t5 *                                                                  | 76     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-t5-socials *                                                             | 74     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /location-eligibility                                                             | 69     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-much-money-do-vending-machines-make-2026                                | 68     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /terms                                                                            | 61     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news                                                                             | 58     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-x                                                                        | 53     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /contact *                                                                        | 36     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /privacy-policy                                                                   | 24     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                           | 23     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-high-earning-spots                                  | 21     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-machines-schools-offices-gyms                                  | 19     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-meta *                                                                   | 18     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                      | 17     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/from-zero-to-first-vending-machine-guide                                    | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-internal-ltf *                                                           | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-reactivation-email *                                                     | 16     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-services-faqs                                       | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/finance-first-vending-machines-without-loans                                | 12     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-installation-checklist                                      | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/smart-vending-cashless-payments-iot                                         | 10     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-vending-entrepreneurship-program                            | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-legal-tax-licensing-2025                           | 9      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start-your-route-ak-tt                                                           | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-passive-income                                     | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/7-myths-about-vending-machine-business                                      | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program    | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-partner *                                                                | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-route-blueprint-watch-now-instagram                                      | 6      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-business-course-mentorship-guide                            | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1-f15cf                                              | 5      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-for-complete-beginners                                     | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-success-3                                                   | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/what-to-check-before-installing-a-vending-machine                           | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-innovation-5                                                | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-build-a-self-managed-route-so-you-can-work-less                      | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-insights-5                                                  | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-locations-1                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-trends-4                                                    | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-8-vendpreneur-mistakes-how-to-fix-them                                  | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/seasonal-vending-machine-ideas                                              | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/eco-friendly-zero-waste-vending-machines                                    | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-success-3-8b515                                             | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2-c6bb6                                           | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-business-taxes-us-beginners-guide                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-placement-2                                                 | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| **All funnels**                                                                   | 24147  | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

## February 2026

| Funnel                                                                            | Visits | Leads | Opt-in % | Qs offered | Qs left | Qs done % | Booked | Book % | Held | Show % | Won | Win % | Revenue |
| --------------------------------------------------------------------------------- | ------ | ----- | -------- | ---------- | ------- | --------- | ------ | ------ | ---- | ------ | --- | ----- | ------- |
| /                                                                                 | 292    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-ig                                                                       | 54     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /start                                                                            | 18     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /case-studies                                                                     | 13     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-website                                                                  | 11     | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /vending-blueprint                                                                | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news                                                                             | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /location-eligibility                                                             | 8      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /about-us                                                                         | 7      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /terms                                                                            | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /privacy-policy                                                                   | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/vending-machine-locator-high-earning-spots                                  | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/expected-costs-earnings-roi-vending-machines-2025                           | 4      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-passivepreneurs *                                                        | 3      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/best-vending-machines-schools-offices-gyms                                  | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-5-questions-vending-entrepreneurship-program                            | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-to-choose-the-perfect-location-for-vending-machine                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/finance-first-vending-machines-without-loans                                | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /business                                                                         | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-t5-socials *                                                             | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/top-10-profitable-products-to-stock-in-your-vending-machine                 | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/7-myths-about-vending-machine-business                                      | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-x                                                                        | 2      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/how-much-money-do-vending-machines-make-2026                                | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/what-to-check-before-installing-a-vending-machine                           | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| /booking-meta *                                                                   | 1      | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |
| **All funnels**                                                                   | 460    | 0     | 0.0%     | —          | —       | —         | 0      | —      | —    | —      | 0   | —     | —       |

`*` = a registered booking funnel. Everything else is a page that happens to carry a form.

Generated 2026-09-18T17:43:20.607Z by `scripts/funnel-baseline-snapshot.mjs`.
