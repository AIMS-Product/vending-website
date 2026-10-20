# LTF V2 launch runbook ($5 PDF: GHL embed vs Stripe Checkout)

Nothing here is live until Adam says so. Each step names who does it.

## 0. Decisions (Adam)

- [ ] Approve PDF copy (`src/lib/content/playbook-guide.ts`; render with `node scripts/playbook-guide/build.mjs`).
- [ ] Approve offer page copy (same file, `guideOffer`), including the **refund line (placeholder: 14 days, full refund)**.
- [ ] Stripe account to use (the local Stripe CLI is logged into Cursive, not Vendingpreneurs). Stripe Tax on or off.
- [ ] Support / reply-to email (`LTF_SUPPORT_EMAIL`).
- [ ] Shared link to put in the webinar: `https://www.vendingpreneurs.com/playbook/go?utm_source=webinar&utm_campaign=<date>`.

## 1. Database (Claude, after Adam OKs the additive migration)

`supabase/migrations/20261020002951_ltf_playbook_test.sql`: three new `ltf_*` tables, the `ltf_report`
view, private bucket `ltf-playbook`. Additive only; touches no existing table.

## 2. PDF upload (Claude)

`node --env-file=.env.local scripts/playbook-guide/build.mjs --upload` with `PLAYBOOK_PDF_OBJECT=v1/first-location-playbook.pdf`.
Re-run after any copy change; bump to `v2/...` and update the env var to roll a new version.

## 3. Stripe (Claude with VP account access)

- Product "The First Location Playbook", one-time price $5 USD -> `STRIPE_PLAYBOOK_PRICE_ID`.
- Webhook endpoint `https://www.vendingpreneurs.com/api/webhooks/stripe`, events:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `payment_intent.payment_failed`, `charge.refunded` -> `STRIPE_WEBHOOK_SECRET`.
- Statement descriptor and receipt emails on in the Stripe dashboard.

## 4. GHL, version A (Claude or Adam). NEVER inside "General Webinar V2"

The "Webinar LTF" course workflow fires on ANY sale in General Webinar V2 (page filter removed 2026-10-05).

- New funnel "LTF V2 PDF Test" with one order-form step (embed variant, same height-posting tracking
  code as the current checkout embed) selling a new $5 product "The First Location Playbook".
- Order form redirect -> `https://www.vendingpreneurs.com/playbook/guide-thanks`.
- New workflow, trigger Order Submitted, filter product = the $5 PDF product:
  1. Email the PDF (GHL-hosted file) to the buyer.
  2. Webhook POST `https://www.vendingpreneurs.com/api/webhooks/ghl-guide-order`, header
     `x-ltf-secret: <LTF_GHL_WEBHOOK_SECRET>`, JSON `{"order_id","email","name","amount"}`.
- Refund workflow (if GHL exposes the trigger): same webhook with `"status":"refunded"`.
- Check the "Webinar LTF" and "LTF Purchases to Meta Purchase Event" workflows do not trigger on the new
  product (the Meta one triggers on global product, so add a product filter or accept the event).
- `PLAYBOOK_GUIDE_GHL_EMBED_URL` = the new embed step URL.

## 5. Env (Claude): Vercel production + preview, then redeploy

All vars in `.env.example` under "LTF V2". Leave `PLAYBOOK_PDF_TEST` unset.

## 6. QA on the preview URL, Stripe TEST mode (Claude, Adam spot-checks on his phone)

- [ ] /playbook/go assigns, return visit keeps the version, both versions render on phone + desktop.
- [ ] B: test card 4242 pays, thank-you shows the download, email arrives, PDF opens.
- [ ] B: declined card 4000 0000 0000 0002 -> stays on Stripe, `payment_failures` counts it, nothing unlocked.
- [ ] B: double-click the buy button -> one session. Close the tab right after paying -> email still arrives.
- [ ] B: `stripe events resend <evt>` x3 -> one order, one email.
- [ ] B: unset RESEND_API_KEY on preview -> paid, thank-you download works, delivery_status=failed, webhook 500s, restore key -> retry sends.
- [ ] B: refund in Stripe -> download link goes to the recovery page.
- [ ] Recovery form: buyer email gets a link; unknown email shows the same message.
- [ ] A: GHL embed checkout -> GHL email with PDF, `ltf_orders` row variant a, course NOT granted (check contact in GHL).
- [ ] Thank-you URL with a fake or unpaid session id unlocks nothing.
- [ ] `/admin/analytics/ltf-test` shows the test orders in the right columns.

## 7. Launch (Adam says go)

Stripe live keys + live webhook secret in production, `PLAYBOOK_PDF_TEST=on`, redeploy, swap the
webinar's offer link to `/playbook/go?...`. Turning it off: unset `PLAYBOOK_PDF_TEST` (or anything but `on`)
and redeploy. `/playbook/go` then sends people to the current `/playbook`. Thank-you, download,
recovery and webhooks keep working for existing buyers.

## Judging (from the PRD)

Primary: buyers / unique visitors per version (`/admin/analytics/ltf-test`). The page refuses to call a winner below 30
buyers per version and shows a two-proportion z-test p-value after that. Set the duration from real traffic:
at ~5% conversion, detecting a 5% -> 7.5% lift needs roughly 1,500 visitors per version.

## Local test DB

`supabase start` fails on a fresh DB because of an older repo migration; the LTF tests run against a
stack started with only `20261020002951_ltf_playbook_test.sql`, with
`LTF_TEST_SUPABASE_URL` / `LTF_TEST_SUPABASE_SERVICE_KEY` set (`src/lib/ltf/orders.db.test.ts`).
