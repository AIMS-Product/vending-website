> 2026-10-19 update: Adam dropped GHL and the A/B split. This is now a Stripe-only replacement of the
> playbook offer. Current runbook: `launch.md`. The A/B design below is historical.

# LTF V2: $5 PDF playbook, GHL embed vs Stripe Checkout (A/B)

Branch `feat/ltf-v2-stripe-playbook` (worktree `~/vending-website-ltf-v2`). LOCAL ONLY. No push, no preview,
no GHL publish until Adam approves next week. Launch switch `PLAYBOOK_PDF_TEST` defaults off.

## Brief

- Feature: webinar traffic hits one link, gets a sticky 50/50 version, buys the same $5 PDF through either
  the GHL checkout embed (A) or Stripe-hosted Checkout (B), and gets the PDF.
- Test question: GHL embed vs Stripe checkout. Same offer page, same PDF, same price; only the checkout differs.
- Invariant: only a server-verified paid Stripe session (B) unlocks the PDF; one payment = one order = one
  fulfillment, however many clicks, retries, or webhook replays.
- Unsafe outcomes: thank-you URL alone unlocks the PDF; duplicate orders/emails; buyer pays and cannot get the
  PDF; price taken from the client; **A purchase grants the GHL course** (Adam: "we don't want that");
  switching the test off strands existing buyers; anything goes live before Adam says so.
- Previous behaviour preserved: `/playbook`, `/playbook/checkout`, `/playbook/thank-you` ($67 course funnel)
  untouched; GHL "Webinar LTF" course workflow untouched.

## Key finding

GHL "Webinar LTF" course-grant workflow trigger is funnel `General Webinar V2` + Sale with NO page filter
(changed 2026-10-05). Any sale in that funnel grants the course. The $5 product therefore lives in a NEW GHL
funnel with its own product-filtered delivery workflow. Never add the $5 product to General Webinar V2.

## Design

- Offer page `/playbook/guide` (one page for both versions). `/playbook/go` assigns the `vp_ltf` cookie
  (visitor uuid only; version read from the DB, 1 year). Button: A -> `/playbook/guide/checkout` (GHL embed of the new funnel), B -> POST
  `/api/playbook-guide/checkout` -> 303 to Stripe.
- Supabase (`ltf_*` tables, service role from server only, RLS on with no policies):
  `ltf_visitors` (assignment, source), `ltf_events` (offer_view, checkout_start), `ltf_orders`
  (provider, variant, visitor, source, email, amount, fee, payment/delivery status, access token hash,
  download count; unique on provider + external id).
- Stripe: price from env `STRIPE_PLAYBOOK_PRICE_ID` only. Reuse an open session for the same visitor
  (repeat clicks). Webhook verifies signature; `checkout.session.completed` /
  `async_payment_succeeded` -> `fulfillOrder(sessionId)` (re-retrieves session from Stripe, atomic
  pending->paid transition, atomic delivery claim). `charge.refunded` -> refunded, access revoked.
  Thank-you page calls the same `fulfillOrder` (closed-browser and slow-webhook cases both covered).
- Delivery: private storage bucket `ltf-playbook`; `/playbook/guide/access/<token>` checks paid + not
  refunded, then 302s to a 5-minute signed URL. Email via Resend. Recovery form rotates the token and
  re-sends; same response whether or not the email bought (no enumeration); rate limited.
- GHL: B buyers upserted as contacts with tag `ltf-v2-pdf-buyer` via `after()`; delivery never waits on it.
  A orders come in through a product-filtered GHL workflow webhook (shared secret) so both arms report the same way.
- Report: `/admin/ltf-test`: visitors, checkout starts, buyers, conversion, gross, fees, refunds, net
  revenue per visitor, delivery failures, downloads, per version.

## Progress

| #   | Slice                                                                                             | Tier | Status                                                  |
| --- | ------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| S0  | Plan + spec                                                                                       | -    | done                                                    |
| S1  | PDF: tactical plays + Mike videos + assignments (HTML -> PDF build)                               | 3    | done (copy awaits Adam approval)                        |
| S2  | Migration + assignment + offer page behind switch                                                 | 1    | done (migration not applied to prod)                    |
| S3  | Stripe checkout + webhook + fulfillment + access + email + recovery                               | 1    | done (real-DB tests; Stripe E2E in S6)                  |
| S4  | A arm: GHL funnel/product/workflow + order webhook                                                | 1    | code done; GHL setup blocked on Adam (launch.md step 4) |
| S5  | Admin report                                                                                      | 2    | done (/admin/analytics/ltf-test)                        |
| S6  | E2E in Stripe test mode (failed card, double click, replay, closed browser, failed email, refund) | 1    | blocked: needs VP Stripe test keys                      |

## Inputs needed from Adam

1. VP Stripe account test + live keys (CLI here is logged into Cursive).
2. Final PDF copy approval (S1 draft).
3. Refund terms + tax treatment (Stripe Tax on/off).
4. Support / from email for delivery.
5. OK to apply the additive `ltf_*` migration to the prod Supabase project (new tables only).

Launch steps and QA checklist: `plans/ltf-v2-pdf-ab/launch.md`.
