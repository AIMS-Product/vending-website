# One definition of a lead, on every surface

**Date:** 2026-09-18 · approved by Adam ("Yes") · branch `main`

## The definition (canonical: `src/lib/analytics/lead-definition.ts`)

A **lead** is one person who gave us their name and email on vendingpreneurs.com
(any site form, at the contact step — finishing the questions is not required)
or gave an email to the site chatbot.

- **One person, not one submit.** Rows sharing an email within 30 days of the
  previous row collapse into the first row. Outcomes (booked, showed, won,
  revenue, questions finished) from any row in the group count on the lead.
  Rolling 30 days, not calendar month, so the count is additive by day and
  the spine, the month tables and a 30-day range all agree.
- **Newsletter signups are Subscribers, not leads** (`lifecycle_status =
newsletter_subscribed`).
- **Test/internal** excluded by `isInternalLead` unless the toggle is on.
- **Not leads — "Registrations & contacts":** webinar registrations, GHL
  off-site forms (IG lead magnets, VSL, waitlist), ManyChat contacts.

## Measured before (August 2026, production)

597 lead rows, 539 people; 26 newsletter; Channels tab summed 4,246 "leads"
(2,736 webinar registrations, most of Instagram's 663 = GHL lead magnets).

## Changes

1. `lead-definition.ts`: `collapseToLeads`, `isNewsletterSignup`, copy strings.
2. Row readers use it: Overview/Acquisition/Pages/Quality, YouTube, Funnels by
   month + Exec, Journeys, link coverage, spine `syncLeads`, confidence counts.
3. `fetchFacts` (Channels, KPI, Map, team report, reporting API, admin home):
   `leads` recomputed from `lead_submissions` through the same function and
   keyed by `channelDailyKey`; the stored spine `leads` on keys with no site
   lead become `contacts`. No migration.
4. Won/Revenue in Funnels no longer require a booking.
5. Internal toggle honoured on Channels/KPI/Map.
6. Opt-in % shows a dash on rows where leads are not stamped with a landing
   page (newsletter, chatbot) and on channels GA4 cannot see (Meta Ads).
7. Definition strip under the Analytics tabs.
8. Test: every surface's lead count for the same window is equal.

## Out of scope (noted, not done)

- Unifying "Showed" (spine derives it as booked minus no-show; Funnels needs
  Close `yes`). Needs Adam's call on the upper-bound vs strict rule.
- Chatbot/newsletter forms carrying the visitor's session UTMs (capture-side).
