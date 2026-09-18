# Numbers you can trust — /admin/analytics

For: CEO · Prepared 2026-09-18 · Checked against each source system, read-only.

## Two questions, two views

- **Site funnel** (Overview, Funnels, Executive, Channels, KPI, Journeys):
  people who filled a form on vendingpreneurs.com, and what became of them.
- **Close view** (new tab): every first call on the closers' calendar,
  including reactivation and webinar people who never touched the site. This
  is the same count as the SteelTrap weekly report. It uses the same weeks
  (Friday to Thursday) and the same rules.

## What each number means and where it comes from

| Number                   | Meaning                                                                                                                                   | Source                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Visits                   | Sessions on the site                                                                                                                      | Google Analytics             |
| Leads                    | One person who gave name + email on a site form or the chatbot, counted once per 30 days; no newsletter, no test/internal                 | Our database                 |
| Registrations & contacts | Webinar sign-ups, off-site forms, Instagram DM contacts. Not leads                                                                        | GoHighLevel, ManyChat        |
| First calls (Close view) | Leads whose First Sales Call is scheduled in the week. Leads now "Canceled (by Lead)" or "Outside the US" are left out, as SteelTrap does | Close                        |
| Showed                   | A rep logged "First Call Show Up = Yes". An unlogged call is not counted as shown                                                         | Close                        |
| Qualified (rep)          | A rep logged "Qualified = Yes" after the call. Different from "Qs done" (finished the online questions)                                   | Close                        |
| Won / Revenue            | Deals won in the period, by the day won, credited to the lead's Close funnel                                                              | Close                        |
| Ad spend                 | Google Ads and Meta spend; webinar spend from the webinar sheet                                                                           | Metricool, vp-webinars sheet |

## SteelTrap tie-out, week Sep 11–17

| Funnel                               | First calls | Showed | Qualified | Won    | Revenue     |
| ------------------------------------ | ----------- | ------ | --------- | ------ | ----------- |
| Reactivation Scrapers                | 77          | 41     | 24        | 8      | $62,079     |
| Internal Webinar                     | 37          | 24     | 14        | 0      | $0          |
| Instagram                            | 13          | 7      | 4         | 2      | $7,185      |
| Website                              | 11          | 6      | 6         | 0      | $0          |
| Google Ads                           | 10          | 7      | 3         | 0      | $0          |
| YouTube                              | 9           | 8      | 8         | 3      | $16,682     |
| LTF - In-House                       | 1           | 1      | 1         | 1      | $1,188      |
| LinkedIn, Mike Newsletter, VSL, WWWS | 1 each      | 3      | 2         | 0      | $0          |
| **Total**                            | **162**     | **97** | **62**    | **14** | **$87,134** |

Matches SteelTrap exactly (checked against live Close). 9 more first calls
were booked that week but the lead has since canceled; the tab shows that
count under the table.

## What is not tracked (shown as a dash, never as 0)

- Ad spend has not been cross-checked against the Google Ads or Meta
  accounts. We have no API access to either; a screenshot of August from each
  would close this.
- 43 of 106 first-call Calendly bookings in Sep 11–17 came through untagged
  links (Vending Route Advisory Call 14, Consultation Call 8, New Vendingpreneur
  Strategy Call 6, others 15). Their channel comes from Close instead.
- Webinar wins by webinar date (the vp-webinars sheet) miss deals where the
  webinar tag was lost: 14 / $116,276 there vs 18 / $155,720 in Close for the
  Internal Webinar funnel since June 16. The Close figure is the one to use.
