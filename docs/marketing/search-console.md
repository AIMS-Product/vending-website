# Google Search Console connector

Fills **Seen** (impressions) and **Clicked** (clicks) for the **Organic search**
channel on `/admin/analytics?tab=channels`, from Search Console's Search
Analytics API. Daily cron at 11:50 UTC (`/api/admin/search-console-sync/run`),
connector name `search-console`.

- Reads Google **web** search totals per day, final data only, for the
  property in `GSC_SITE_URL`. It re-reads the last 10 days on every run because
  Search Console publishes a day two to three days late.
- Written to `channel_daily` under source `google-search-console`, medium
  `organic`, which resolves to Organic search. It is a separate row from GA4's
  google/organic visits on purpose: a search click and a site session are
  different counts, and GA4's organic key is not fixed.
- Auth is the GA4 service account (`GA4_SERVICE_ACCOUNT_JSON`) with the
  read-only scope `webmasters.readonly`. No new key or OAuth grant is needed.
- Until it is set up, the run records `skipped: <why>`, and the trust bar and
  the sync health table show it as not connected.

## Owner setup (once)

1. Find the service account's address: the `client_email` value inside
   `GA4_SERVICE_ACCOUNT_JSON` (it ends in `.iam.gserviceaccount.com`). The probe
   in step 4 also prints it.
2. In Search Console, open the vendingpreneurs.com property, then
   **Settings → Users and permissions → Add user**. Paste that address, set
   permission **Restricted**, and add it.
3. Set `GSC_SITE_URL` to the property exactly as Search Console names it:
   `sc-domain:vendingpreneurs.com` for a domain property, or
   `https://www.vendingpreneurs.com/` for a URL-prefix property. Set it in
   Vercel **Production** and **Preview**, and in `.env.local`.
4. Confirm access, read-only, from a checkout with `.env.local`:

   ```sh
   node scripts/search-console-probe.mjs
   ```

   It lists the properties the service account can see and prints the last 7
   days of clicks and impressions. It writes nothing.

5. After the deploy that carries `GSC_SITE_URL`, backfill once (Search Console
   keeps 16 months):

   ```sh
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.vendingpreneurs.com/api/admin/search-console-sync/run?days=480"
   ```

   The cron keeps the last 10 days current from then on.

## Reading the numbers

- Seen and Clicked on Organic search are Google's own counts for the whole
  site in web search. Bing and other engines have no Seen or Clicked; they
  still show up as visits through GA4.
- Search Console clicks and GA4 organic visits do not match one to one. A
  click can end before GA4 loads, and GA4 drops visitors who decline consent.
  Compare the two as trends, not as one number.
