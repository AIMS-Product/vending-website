# Webinar funnel check, 2026-10-21 (why registrations fell, and is tracking right)

Sources, all read-only: vp-webinars snapshots (`app/src/data/*.json`, pulled 10-21 17:00Z); GA4 Data API (prod hosts); Meta Graph API GET (ad sets and today's insights).
No writes anywhere. Aggregates only, no PII.

## 1. The drop is at registration, and the cause is ad spend going to an Advantage+ Purchase campaign

| Webinar | Spend  | GHL registrants | $/registrant | Attended (Zoom) | Show rate | Night-of bookings |
| ------- | ------ | --------------- | ------------ | --------------- | --------- | ----------------- |
| Sep 8   | $10.7k | 1,040           | $10.27       | 170             | 16%       | -                 |
| Sep 15  | $10.0k | 1,078           | $9.31        | 221             | 20%       | 30                |
| Sep 22  | $10.6k | 818             | $12.97       | 156             | 19%       | 19                |
| Sep 29  | $10.4k | 494             | $20.95       | 115             | 22%       | 16                |
| Oct 6   | $9.9k  | 476             | $20.90       | 143             | 28%       | 24                |
| Oct 13  | $10.7k | 584             | $18.25       | 124             | 21%       | 11                |
| Oct 20  | $9.7k  | 443             | $21.95       | 72              | 16%       | 12                |

Spend stayed flat while registrations halved. The new campaign **"LL - VP Masterclass Webinar | Purchase | CBO | Adv+"**
(optimising for the Meta `Purchase` event) started the week of Sep 22 and took 60-76% of the weekly budget:

| Week ending | Adv+ Purchase spend | Its $/registration | Leads (lookalike) ad sets' $/registration |
| ----------- | ------------------- | ------------------ | ----------------------------------------- |
| Sep 22      | $1.5k               | $39                | $10-12                                    |
| Sep 29      | $6.3k               | $41                | $8-12                                     |
| Oct 6       | $6.9k               | $45                | $8-9                                      |
| Oct 13      | $6.1k               | $125-172           | $7-11                                     |
| Oct 20      | $7.4k               | $247               | $5.6-6.7                                  |

On the site's own page, since Oct 7 (GA4, split by `utm_term` = ad set id):

- Adv+ "US - 2": **17,124 sessions, 62 registrations (0.36%)**. Meta: $11,743 for 56 registrations (**$210 each**).
- The three Leads lookalike ad sets: about 3,600 sessions at **18-20% session-to-registration**, 685 registrations for $4,728 (**$6.90 each**).

Why it fails: Meta needs about 50 optimisation events a week. The Purchase campaign had 1-5 Playbook purchases a week
(ltf.json), so it bought cheap, low-intent impressions (CPM fell to $8-11; account CTR fell to 0.7% on Oct 20). Those
visitors don't register. The few who do show up and book less, which fits Oct 13/20's weaker show rate and bookings.

**Status now:** the Adv+ "US - 2" ad set reads **PAUSED** in the live API (it was ACTIVE in the 17:10Z snapshot). Before the pause,
it spent $875 on 10-21 for 12 registrations, while Leads spent $322 for 100.

Not the cause: the site form. Mobile is 95% of traffic, and 82% of people who start the form register (GA4: 1,034 starts, 843
registrations since Oct 7). Reminders reach site-form registrants: on Oct 13, 95% were reached by SMS and 100% by email.
The decline also began on Sep 29, a day before the site form launched.

## 2. What to do before next Tuesday (media buyer / Adam; I made no ad changes)

1. Keep the Adv+ Purchase campaign off, and put its ~$1k/day into the Leads CBO lookalike ad sets
   (LLA 5% Buyers+Attendees, LLA 5-10% and LLA 1% Wealth and Side Hustles, "Masterclass LP"). At recent rates ($6-9 per registrant), the same $10k
   would buy roughly 1,000-1,400 registrants a week instead of 450-580. Scale in steps (about 20% a day) so the CBO doesn't reset learning.
2. If you want a buyer-optimised campaign, wait for $5 purchase volume (the Playbook is now $5 and sold on our page). Revisit it at
   50+ purchases a week, and optimise on `CompleteRegistration` until then.
3. The $5 Playbook card on the confirmation page got **26 clicks in two weeks** (GA4 `vp_playbook_click`, about 3% of
   registrants). #202/#203/#204 and today's #209-#212 rework that page. Watch the click rate on the next cohort.

## 3. Tracking audit (registration to purchase)

| Step                              | Destination                                   | Status                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form start / error / registration | GA4 (forwarded by the site)                   | Working: `masterclass_registered` 430 for the Oct 20 week vs 410 site-form registrations in GHL                                                                                             |
| Registration                      | Meta `CompleteRegistration` (GHL server-side) | Working: Meta-reported 378-547 a week vs GHL 443-584                                                                                                                                        |
| Calendar add, Playbook card click | GA4                                           | Working (330 / 26 since 09-28)                                                                                                                                                              |
| Offer view, checkout start, order | `ltf_*` tables, `/admin/analytics/playbook`   | Working, but $0 test orders count as buyers. Fix: **#213** (+ SQL section 15)                                                                                                               |
| $5 purchase                       | GA4 `purchase`                                | **Broken: never forwarded (0 events).** Fix: **#216**                                                                                                                                       |
| $5 purchase                       | Meta pixel + CAPI, deduplicated on session id | Wired; `META_ACCESS_TOKEN` in prod. Unverified until the first live sale                                                                                                                    |
| $5 purchase                       | GHL tag `playbook-5-buyer`                    | Wired; `GHL_WRITE_TOKEN` in prod. Unverified until the first live sale                                                                                                                      |
| $5 purchase                       | vp-webinars board                             | **Missing** until vp-webinars **#52** merges (board reads GHL orders only)                                                                                                                  |
| GA4 form-error reasons            | GA4                                           | `reason` / `error_keys` are sent but not registered as custom dimensions, so they can't be reported. One-time GA4 admin step: Custom definitions > add `reason`, `error_keys` (event scope) |

## 4. Live end-to-end test: not run yet

The approved test is one registration plus one $0 PLAYBOOKTEST purchase. It's blocked on the contact details.

- The GHL workflow texts the registration phone about 10 times, so a made-up valid number would text a stranger. It needs a phone you own.
- The $0 order never fires GA4/Meta purchase events (by design: live orders over $0 only), so purchase tracking can only be proven by
  one real $5 purchase (then refunded in Stripe).
