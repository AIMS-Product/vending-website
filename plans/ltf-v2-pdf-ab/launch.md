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

## Status (2026-10-21)

Done:

- Merged to main: #197 (Stripe $5 playbook, unlisted `/playbook-stripe` -> `/playbook/go` -> `/playbook/guide`),
  #198 (checkout-style order card, hero with PDF page viewer), #199 (hotfix below).
- Live webhook `we_1USetyJIfGazBhNXIvU56Dxk` enabled after the merge deployed.
- Live coupon code `PLAYBOOKTEST` created (Adam, dashboard).
- Live $0 test passed twice on 2026-10-20 (16:41 and 19:02 UTC): both orders `paid`, email `sent`,
  `download_count` 1. Three abandoned $5 test sessions sit `pending` and expire on their own.

10-20 preview leak: the hero viewer (#198) reused the full-resolution page renders, so readable copies of
paid play pages were served from `public/images/playbook-guide/`. #199 replaced them with `page-<n>-locked.webp`
(blur baked into the file) and removed the readable files; the old URLs now return the HTML fallback and
`/_next/image` answers 400 for them. Prevention: `src/lib/content/playbook-guide-images.test.ts` fails if any
page other than 1 or 2 is unlocked or any readable page file sits in that folder, and `build.mjs` refuses to
start if `READABLE_PAGES` holds anything but 1 and 2.

Open (Adam decides; see `.claude/specs/2026-10-21-overnight-plan.md` section 6):

1. Delete the 10-20 test rows (2 $0 orders, 3 abandoned $5 sessions, their events/visitors)?
2. Delete the old #197/#198 production deployments (their immutable URLs still hold the readable pages)?
3. Go live: set `PLAYBOOK_GUIDE_LIVE=on` in production and redeploy. `/playbook` and `/playbook/checkout`
   307 to `/playbook/go` (UTMs kept) and the webinar confirmation page shows the $5 teaser.
   Turn off: unset it and redeploy; buyers keep thank-you, download, recovery and the webhook.
4. Stripe statement descriptor suffix "PLAYBOOK" (checkout shows Modern-Amenities LLC).
5. GA4 `purchase` needs a GTM tag; verify on the first real sale.
6. VendHub's webhook logs one "unresolved checkout" per sale (see below); fix belongs in the vendhub repo.
7. Roll the Stripe keys that appeared in session transcripts.

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
