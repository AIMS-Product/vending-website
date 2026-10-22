# $5 Playbook: launch-day checklist (one ordered list)

Written 2026-10-21 pm from the overnight report's "Needs Adam" items 1-9 plus what changed during the day.
Background: `launch.md` (history), `docs/playbook-5-switch.md` (how the switch works).

**State checked 2026-10-21 ~21:50 PT (read-only GETs and a counts-only DB read):**

- `PLAYBOOK_GUIDE_LIVE` **is already set in Vercel production** (added ~13h earlier). `/playbook` and
  `/playbook/checkout` return 307 to `/playbook/go`, which 307s to `/playbook/guide`. The $5 offer is live.
- Prod `ltf_orders`: 6 rows. Two are $0 `PLAYBOOKTEST` orders (paid, sent), three are expired $5 test sessions,
  one is a pending $5 session from 10-21 16:23 UTC. No real paid sale yet.
- `/admin/analytics/playbook` reads 2 "paid buyers", $0 gross: the two test orders. PR #213 fixes the count.
- vp-webinars PR #52 (board counts Stripe sales) is **open**, so $5 sales do not show on the board yet.

So "launch day" is now "first real sale day". Work top to bottom. Each step lists what to check after it.

## A. Before the next webinar sends traffic

1. **Merge the leak guard first: #201.** Then #202, #203 and #204 in any order.
   - Dry run 10-21 pm: all four merge onto main `3d9bb572` with no conflicts. tsc 0, eslint 0, vitest 0 (4720 passed).
   - Check after each merge: the Vercel production deployment goes green, and `/playbook/guide` loads.
   - Rollback: revert the merge commit on GitHub (`Revert` button on the PR), which redeploys.
2. **Fix the report: #213.** Run section 15 of `supabase/migrations/APPLY-IN-SQL-EDITOR.md` in the prod SQL editor.
   Either order is safe (the page reads the new column as 0 until the SQL runs). Then merge #213.
   - Check: `/admin/analytics/playbook` shows "Paid buyers 0" and "Free orders 2" (until step 3).
3. **Delete the 10-20 test rows** (overnight item 1). This also kills the download links that showed up in transcripts.
   SQL editor, one transaction. Read the `select` counts first. Expect 6 orders, or more if real sales have landed since 10-21.

   ```sql
   begin;
   -- Test window only: everything created before the first real sale. Check the counts before deleting.
   select payment_status, amount_cents, count(*) from ltf_orders
     where created_at < '2026-10-21 17:00+00' group by 1, 2;
   delete from ltf_orders where created_at < '2026-10-21 17:00+00';
   delete from ltf_events  where created_at < '2026-10-21 17:00+00';
   delete from ltf_visitors v where created_at < '2026-10-21 17:00+00'
     and not exists (select 1 from ltf_orders o where o.visitor_id = v.visitor_id);
   commit;  -- or rollback; if the counts look wrong
   ```

   - Adjust the cutoff if you ran your own test after 10-21 17:00 UTC. The 16:23 UTC pending session falls inside it.
   - No rollback (deletes are permanent). These rows are test data only.

4. **Rotate the two exposed keys** (overnight item 7): the Stripe test secret key and the live restricted key `rk_live_…`.
   - Stripe dashboard > Developers > API keys > the key > Roll. For the live restricted key, roll it and paste the new
     value into Vercel production `STRIPE_SECRET_KEY`, then **redeploy**. Vercel env changes need a redeploy.
   - Check: open `/playbook/guide`, click Buy, and confirm the Stripe Checkout page opens. Close it without paying.
   - Rollback: Stripe keeps the old key alive for the expiry window you pick when rolling. Choose 1 hour, not "now".
5. **Stripe statement descriptor suffix "PLAYBOOK"** (item 4). Stripe > Settings > Business > Public details > Shortened descriptor,
   or set the suffix on the product. Cosmetic, but it cuts "what is this charge" refunds.
6. **Confirm the live webhook is enabled:** `we_1USetyJIfGazBhNXIvU56Dxk`, under Stripe > Developers > Webhooks.
   It should be Enabled, pointing at `https://www.vendingpreneurs.com/api/webhooks/stripe`, with recent deliveries returning 200.
   - Without it, a buyer who closes the tab before the thank-you page loads gets no email until someone runs recovery.
7. **Merge vp-webinars #52** so the board counts $5 sales. The board then picks them up on its next daily refresh.

## B. First real sale (acceptance)

8. Watch for the first real $5 order on `/admin/analytics/playbook`. Once it lands, check all of the following:
   - The buyer row shows **Emailed: Yes**, and "Paid but email not sent" stays 0.
   - Downloads go to 1 once the buyer opens the PDF. If they don't, that's not a bug yet. Re-check the next day.
   - **GA4 purchase** (item 5): GA4 > Reports > Realtime, or DebugView, shows `purchase` value 5 from `/playbook/guide-thanks`.
     If it is missing, add the GTM tag (GA4 Event, name `purchase`, trigger on the dataLayer `purchase` event) and publish.
   - **Meta**: Events Manager shows one `Purchase` worth 5.00 for that order (browser pixel + server CAPI, deduplicated on the Checkout Session id). $0 orders never send a server event.
   - **GHL**: the buyer's existing contact has the tag `playbook-5-buyer` (#209; tags existing contacts only, fail-soft).
   - **Stripe**: the payment shows the PLAYBOOK descriptor.
9. Only after all of step 8 holds: **pause the GHL "Webinar LTF" workflow** and archive the $67 GHL product.
   Pausing it first would strand any $67 checkout still in flight.

## C. Open decisions (no deadline on launch day)

10. **Old #197/#198 production deployments** (item 2) still serve readable play pages on their immutable `*.vercel.app` URLs.
    Deleting them is permanent and loses those rollback targets. Suggest deleting them once #201 has been live and
    stable for a day, because the rollback in D below doesn't need them.
11. **VendHub webhook log noise** (item 6): each $5 sale logs "no resolvable order_group_id" in VendHub, which
    shares the Stripe account. It's harmless. The fix goes in the vendhub repo (skip `metadata.ltf === "v2-pdf"`) and needs an owner.
12. **Content-funnel decisions D1-D4** (item 8): see the checklist at the top of #205.

## D. Turn-off (any time)

- Unset `PLAYBOOK_GUIDE_LIVE` in Vercel production, then **redeploy** (the value is read at build time).
- Check: `curl -sI https://www.vendingpreneurs.com/playbook` returns **200** (the $67 GHL page) instead of 307.
- **Buyer access survives the switch-off.** Download, thank-you, recovery and the webhook don't read the flag.
  Prove it right after switching off:
  1. On `/admin/analytics/playbook`, pick a real buyer. Do not copy their link anywhere.
  2. `curl -s -o /dev/null -w '%{http_code}\n' https://www.vendingpreneurs.com/playbook/guide-access` should return 200 (the recovery page).
  3. Ask the buyer, or use your own paid test order, to open the emailed link. The PDF should still download.
- If the GHL "Webinar LTF" workflow was already paused (step 9), un-pause it so $67 buyers get delivery again.
