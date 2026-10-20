# $5 First Location Playbook: launch runbook (Stripe only, no GHL)

Adam 2026-10-19: replaces the GHL playbook course. Stripe Checkout on our pages, PDF delivered by us,
all sales final, no GoHighLevel anywhere. Stripe account: Modern-Amenities LLC (`acct_1Q4q40JIfGazBhNX`).
Support / reply-to: support@modern-amenities.com.

## Done

- [x] Copy approved (Adam).
- [x] PDF built and uploaded to private bucket `ltf-playbook` as `v1/first-location-playbook.pdf` (prod storage).
- [x] Stripe TEST: product `prod_VTOsNHda8M0T90`, price `price_1USS4RJIfGazBhNXDxDl4Tlm`, webhook `we_1USS4SJIfGazBhNXNTpCwcgw`
      -> branch preview (with Vercel automation bypass param).
- [x] Preview env (branch-scoped `feat/ltf-v2-stripe-playbook`): STRIPE_SECRET_KEY (test), STRIPE_WEBHOOK_SECRET,
      STRIPE_PLAYBOOK_PRICE_ID, PLAYBOOK_PDF_OBJECT, LTF_SUPPORT_EMAIL.

## Live Stripe (done 2026-10-20)

- Live restricted key (Adam) in Vercel **production** as STRIPE_SECRET_KEY, plus STRIPE_WEBHOOK_SECRET,
  STRIPE_PLAYBOOK_PRICE_ID, PLAYBOOK_PDF_OBJECT, LTF_SUPPORT_EMAIL. PLAYBOOK_GUIDE_LIVE is NOT set.
- Live product `prod_VTc8cS8Kc0Urke`, price `price_1USetyJIfGazBhNXTFGHUa3h` ($5), webhook
  `we_1USetyJIfGazBhNXIvU56Dxk` -> https://www.vendingpreneurs.com/api/webhooks/stripe, **created DISABLED**:
  the route is not on main yet and VendHub's live traffic on the same account would fail against it.
  **Enable it right after the merge deploys** (Stripe dashboard -> Developers -> Webhooks -> enable, or
  `stripe-setup.mjs` without `--disabled`).

## Remaining

1. **Adam:** run `supabase/migrations/20261020002951_ltf_playbook_test.sql` in the SQL editor (section 14 of
   APPLY-IN-SQL-EDITOR.md). New tables only.
2. **Claude:** E2E on the preview in Stripe test mode: pay with 4242, thank-you download, email delivered,
   declined card 4000 0000 0000 0002, replayed webhook = one order and one email, refund revokes access.
3. ~~Live Stripe~~ done (see above). Original note: a live secret key for Modern-Amenities LLC is not on this machine (VendHub's local key is test
   mode). Adam pastes a live restricted key (Checkout Sessions write, Products/Prices write, Webhook Endpoints
   write, Charges/Balance read), then `STRIPE_SECRET_KEY=<live> node scripts/playbook-guide/stripe-setup.mjs
https://www.vendingpreneurs.com/api/webhooks/stripe /tmp/ltf-stripe-live.env` creates the live product, price and
   webhook. Add STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PLAYBOOK_PRICE_ID / PLAYBOOK_PDF_OBJECT /
   LTF_SUPPORT_EMAIL to Vercel **production**. Leave PLAYBOOK_GUIDE_LIVE unset.
4. **Merge** `feat/ltf-v2-stripe-playbook` into main (Adam runs the merge). Nothing changes publicly while the
   switch is off. Then **enable the live webhook** `we_1USetyJIfGazBhNXIvU56Dxk`.
5. **Go live (Adam says go):** set `PLAYBOOK_GUIDE_LIVE=on` in production and redeploy. Effects:
   `/playbook` and `/playbook/checkout` 307 to `/playbook/go` (UTMs kept), the webinar confirmation page shows the
   $5 teaser, the offer and checkout serve. Optionally point webinar emails/links straight at `/playbook/go`.
6. **Turn off:** unset `PLAYBOOK_GUIDE_LIVE` and redeploy. Old pages return; buyers keep thank-you, download,
   recovery and the webhook.

## Shared Stripe account note

VendHub's webhook on the same account also receives these checkout events. Its handlers skip sessions without
their metadata (200, logs "no resolvable order_group_id" / "invalid metadata"). No mis-fulfillment, just log
noise; a VendHub filter on `metadata.ltf === "v2-pdf"` would silence it.

## Report

`/admin/analytics/playbook`: visitors, checkout starts, buyers, conversion, net revenue per visitor, declines,
paid-but-not-emailed (should stay 0), downloads.

## 2026-10-20: unlisted live entry + test code

- `/playbook-stripe` (307 -> `/playbook/go`) always serves in production, unlisted. `/playbook` keeps selling the
  GHL course until `PLAYBOOK_GUIDE_LIVE=on`.
- Test link: `/playbook-stripe?promo=<LTF_PROMO_LINK_KEY>` shows Stripe's promo field on that session only.
  Code `PLAYBOOKTEST` (100% off, once, playbook product only). Test mode: coupon `EpP0Eep9`. Live: Adam creates the
  same code in the dashboard (the restricted key has no coupon permission).
- $0 orders fulfill (thank-you, download, email) and are never sent to Meta or GA4.
- Verified on the preview in Stripe test mode: paid 4242, $0 promo, declined card, 3x webhook replay, forged signature,
  fake session id, refund revokes access.
