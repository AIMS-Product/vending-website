# SEO baseline audit and Day 0 scorecard

Run 2026-09-28 against the live Search Console API (`sc-domain:vendingpreneurs.com`, a domain property), URL Inspection, GA4, prod Supabase and `curl` against production. The raw pulls are in `.tmp/` in the worktree and are not committed.

## 1. Why Google impressions fell (46K in March, 6.4K in September)

| Month             | Impressions | Clicks |
| ----------------- | ----------: | -----: |
| 2026-01           |      11,500 |  1,073 |
| 2026-02           |      15,779 |    985 |
| 2026-03           |      45,975 |  1,093 |
| 2026-04           |      21,461 |  1,076 |
| 2026-05           |      19,296 |    814 |
| 2026-06           |      20,194 |    729 |
| 2026-07           |      14,395 |    780 |
| 2026-08           |       9,320 |    742 |
| 2026-09 (to 27th) |       6,365 |    584 |

The drop is three separate events. Only the last one is the cutover.

1. **March was a spike, not a baseline.** `/news/top-10-profitable-products...` showed 16,670 times in March for 10 clicks. `how-much-money...` and `expected-costs...` added about 14,700 more, with 0 clicks. These were desktop impressions at positions 6 to 7 that almost nobody clicked. Measured by clicks, the site went from about 1,050 a month (Jan to Apr) to about 650 a month now. That is **down about 38%, not 86%**.
2. **July 12 to 20, before the cutover: the Webflow rollback proxy blocked Google.** Weekly impressions fell from about 5,000 to 2,400 in the week of July 13.
   - `top-10-profitable` slid from position 11 to 50 between 07-12 and 07-18.
   - `how-much-money` slid from position 9 to 41 on 07-19 and 07-20.
   - URL Inspection shows **"Blocked by robots.txt"** on /news URLs crawled 07-05 to 07-19.
   - This app's `src/app/robots.ts` has allowed everything since May, so that robots.txt came from the rollback proxy that answered on the domain from 07-07 (commit 333e5d4) until the cutover.
   - `top-10-profitable` recovered to position 7 to 9 within three days of the cutover (07-30).
3. **The cutover dropped the archived articles.**
   - 10 long-form Webflow articles that Google was still ranking were marked archived. They returned **404 from 07-27 until 08-31**. Commit 50ab2d3 then 308'd them to the `/news` index, which Google treats as a soft 404.
   - URL Inspection now reports them as "Not found (404)", "URL is unknown to Google" or "Page with redirect".
   - Together they held **52,984 impressions before the cutover**. The biggest was `how-much-money-do-vending-machines-make-2026`, the #3 page on the site at 32,460.

Per-30-day impressions by page, March to June vs August to September (top losses):

| Page                                                    | Before | After | Now                                                        |
| ------------------------------------------------------- | -----: | ----: | ---------------------------------------------------------- |
| /news/top-10-profitable-products...                     |  8,139 | 2,676 | live; position 6.2 to 8.7 (July rank loss, partly back)    |
| /news/how-much-money-do-vending-machines-make-2026      |  4,952 |     0 | 308 to /news                                               |
| /news/expected-costs-earnings-roi-vending-machines-2025 |  2,063 |     0 | 308 to /news                                               |
| /                                                       |  5,235 | 3,216 | 200 (position 12.5 to 13.5)                                |
| /news/how-to-choose-the-perfect-location...             |  2,652 | 1,150 | 308 to /news/best-vending-locations, now position 19 to 40 |
| /about-us                                               |  1,245 |     1 | 308 to /about (fine: /about has 1,303 since the cutover)   |
| courses.vendingpreneurs.com/                            |  1,348 |   379 | not this app                                               |
| /news/vending-machine-locator-high-earning-spots        |    622 |     0 | 308 to best-vending-locations                              |

### Every pre-cutover URL with 50+ impressions (71)

`.tmp/pre-urls-curl.json` holds the full list with status, redirect, canonical and noindex. Summary:

- **Lost, to be fixed (10):** the archived articles that 308 to `/news`. The content still exists: every row is in `news_posts` with `status = archived` and its full body (12K to 23K characters).
  - Pre-cutover impressions: `how-much-money...` 32,460, `expected-costs...` 11,003, `smart-vending-cashless-payments-iot` 2,473, `from-zero-to-first-vending-machine-guide` 842, `finance-first...` 574, `...passive-income` 563, `...legal-tax-licensing-2025` 529, `top-8-vendpreneur-mistakes...` 351, `vending-business-taxes...` 127, `...self-managed-route...` 62.
  - **Fix:** publish each row and drop it from the `/news` redirect group in `next.config.ts`, or 301 each to its matching /resources piece the day that piece is live. Then request indexing.
- **Redirected correctly (about 30):** `/about-us`, `/privacy-policy`, `/booking-website`, `/apply-vendingpreneurs`, the location articles going to `best-vending-locations`, `seasonal-vending-machine-ideas` going to `top-10-profitable`, and the courses.\* trailing-slash 308s. No action.
- **Other hosts (not this app):**
  - `academy.vendingpreneurs.com` is now a Framer site. 15 old URLs return 404 (about 5,000 impressions before July).
  - `community.` (Mighty Networks) and `join.` answer 403 to crawler user agents.

## 2. Technical check

- `robots.txt`: allows everything except `/admin/`. The sitemap is declared. OK.
- Sitemap: 40 URLs, all return 200 with a self canonical.
  - Every `lastmod` is the time of the request, so Google learns to ignore it.
  - URL Inspection indexed 34 of them.
  - Unknown to Google: `/solutions`, `/solutions/vendscout`, `/case-studies/lane-200k-per-year`, and **both /resources pages**.
  - Crawled but not indexed: `/case-studies/musa-sadi`.
- **Both live /resources pages are orphans.** No sitemap page links to them, and `/resources` itself is a 404.
- Titles: 30 of 40 run over 60 characters (case studies 69 to 112, `top-10-profitable` 117). The homepage title is just "Vendingpreneurs" (15 characters), so it only competes on brand.
- Meta descriptions: the /news articles run 237 characters, and `/privacy`, `/spam-policy` and `/solutions` are over 160.
- Schema: Organization and WebSite everywhere. Case studies add VideoObject; /news and /resources add BreadcrumbList; FAQPage appears on `best-vending-locations` and both /resources pages. OK.
- Inbound internal links: 19 of 26 case studies, /solutions, /solutions/vendscout and all 3 /news articles have exactly 1 inbound link.

All of the above are now `seo_tasks`, owned by Adam: 8 technical tasks and 2 refresh tasks.

## 3. Day 0 (dry run 2026-09-28; Search Console final through 2026-09-25)

| Metric                                                                           |                                                                                Day 0 |
| -------------------------------------------------------------------------------- | -----------------------------------------------------------------------------------: |
| Non-branded impressions, last 7 days (north star)                                |                                                                                1,287 |
| Non-branded impressions, 28 days                                                 |                                                                                6,186 |
| Non-branded clicks, 28 days                                                      |                                                                                  258 |
| Branded impressions, 28 days                                                     |                                                                                1,044 |
| Total impressions / clicks, 28 days                                              |                                                                          7,230 / 665 |
| Pages with impressions, 28 days                                                  |                                                                                   76 |
| Queries at positions 1 to 3 / 4 to 10 / 11 to 20                                 |                                                                         67 / 97 / 53 |
| Sitemap URLs indexed                                                             |                                                                             34 of 40 |
| Live /resources pages / indexed                                                  |                                                                                2 / 0 |
| GA4 organic sessions, 28 days                                                    |                                                                                1,299 |
| GA4 organic key events, 28 days                                                  |                                                                   2,938 (see caveat) |
| Followers: YouTube / Facebook / Instagram / LinkedIn                             |                                             46,300 / 143,761 / 248 / 48 (see caveat) |
| DataForSEO: tracked keywords in the top 10 / top 3 / AI Overview citing the site | pending the full pull (the 73-keyword trial run: 0 / 0 / 0, with YouTube cited on 9) |

Caveats:

- GA4 counts more key events than sessions, so some key event fires on page view or scroll. Don't use it as a conversion baseline until the key-event list is checked in GA4.
- Instagram at 248 followers and LinkedIn at 48 look like the wrong account or metric in Metricool's timeline. Facebook is the page shared with Mike's brand. Check these before quoting them.

Freeze it:

1. Paste `APPLY-IN-SQL-EDITOR.md` section 9.
2. Run `node --env-file=.env.local scripts/seo-day0.mjs --write`.
3. Run it again after the full DataForSEO pull to add the rank metrics. It never overwrites a frozen value.

## 4. Scorecard and targets

Targets live in `SCORECARD` in `src/lib/services/seo-scorecard.ts`. They show on the Overview and in the Thursday EOW email.

| Metric                                        |       Day 0 |              30 days | 60 days | 90 days |
| --------------------------------------------- | ----------: | -------------------: | ------: | ------: |
| Non-branded impressions per week (north star) |       1,287 |                1,400 |   2,500 |   4,500 |
| Non-branded clicks, 28 days                   |         258 |                  300 |     400 |     600 |
| Tracked keywords in the top 10                |     pending |                    2 |       8 |      20 |
| Tracked keywords in the top 3                 |     pending |                    0 |       2 |       6 |
| AI Overviews citing the site                  |   0 (trial) |                    1 |       5 |      12 |
| Live /resources pages                         |           2 |                   14 |      19 |      25 |
| Indexed /resources pages                      |           0 |                   10 |      17 |      23 |
| Organic booked calls                          | not tracked | needs `/booking-seo` |         |         |

How the targets were set:

- **Pages:** the P1 plan publishes 3 to 4 pieces a week from week 1, so all 17 P1 pieces are live around week 5. P2 starts after that.
- **North star:**
  - A new page earns little for 4 to 8 weeks, so the 30-day mark counts only on recovery.
  - Restoring the 10 archived articles is worth up to about 1,000 a week if they rank as before. `how-much-money` alone ran 1,100 to 1,600 a week in June.
  - The 60- and 90-day marks add the P1 pages at about 50 to 150 impressions a week each once they rank.

## 5. Quick wins (positions 4 to 20, impressions rising, 28 days vs prior 28)

- "vending machine items": position 6.4, impressions 45 to 95. "top vending machine snacks": position 20.9 to 8. "popular vending machine snacks": 11.8 to 6.4. All three land on `/news/top-10-profitable-products...`, so they're one refresh task (trigger 1 playbook).
- `/news/best-vending-locations`: position 19.4 after absorbing the location article. Refresh task opened.
- The existing trigger-4 task on `/news/how-to-choose-the-perfect-location...` is for a URL that now redirects. Dismiss it: the best-vending-locations refresh covers it.

## 6. Recommended order

1. Restore the 10 archived articles, or map them to /resources pieces (urgent task). This is the only fix that brings back impressions Google already gave the site.
2. Link /resources into the site nav and request indexing for every new piece. Otherwise P1 launches orphaned.
3. Refresh `top-10-profitable`, the one page with real non-branded demand.
4. The title, lastmod and case-study linking tasks.
