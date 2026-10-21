# Switching the webinar Playbook offer from $67 (GHL) to $5 (Stripe)

**Gate: Loana signs off first.** Nothing below runs before that. The launch history is in `plans/ltf-v2-pdf-ab/launch.md`.

## State on 2026-10-21 (checked with GETs on prod)

| URL | Today |
|---|---|
| `/playbook` | 200: the $67 GHL page (the live webinar offer) |
| `/playbook/checkout` | 200: the GHL order form, embedded |
| `/playbook/guide` | 200: the $5 Stripe page, unlisted |
| `/playbook-stripe` | 307 to `/playbook/go`, then to `/playbook/guide` (shareable test link) |

The switch already exists: `PLAYBOOK_GUIDE_LIVE` (`isGuideSwapLive` in `src/lib/ltf/assignment.ts`). It is unset in production, so production stays on $67. When it is `on`:
- `/playbook` and `/playbook/checkout` 307 to `/playbook/go` (`next.config.ts`; UTMs are kept). `/playbook/thank-you` stays up for GHL buyers already mid-checkout.
- The webinar confirmation page shows `GuideTeaser` ($5) instead of `PlaybookTeaser` ($67) (`ConfirmedSections.tsx`).

Previews and `next dev` always show the switched state, so a reviewer sees the $5 path. This PR's preview shows it too.

## Flip (in this order)

1. **Enable the live Stripe webhook** `we_1USetyJIfGazBhNXIvU56Dxk` (Stripe dashboard > Developers > Webhooks > enable). Without it, a buyer who closes the tab before the thank-you page loads gets no email until someone runs recovery.
2. **Confirm the `ltf_*` tables exist in production.** Section 14 of `APPLY-IN-SQL-EDITOR.md`. `/admin/analytics/playbook` loads without an error once they do.
3. Set `PLAYBOOK_GUIDE_LIVE=on` in Vercel **production** and **redeploy**. The value is read at build time.
4. Check the switch took:
   - `curl -sI https://www.vendingpreneurs.com/playbook` returns 307 to `/playbook/go`.
   - The webinar confirmation page shows the $5 card.

## What stops, and whether it matters

| GHL workflow | Fed by | After the flip |
|---|---|---|
| Webinar LTF | the $67 GHL order | No new sales reach it. Delivery moves to us: Resend email plus `/playbook/guide-access`. Pause the workflow only after the first $5 sale is delivered (acceptance below). |
| LTF Purchases to Meta Purchase Event | the $67 GHL order | No new sales reach it. Meta still gets a Purchase: `src/lib/ltf/meta-capi.ts` sends one server-side per paid order (`onPaid`), valued at what Stripe charged. Do not run both for one sale: they never overlap, since a sale goes through one checkout. |

- GA4 and PostHog: the `/playbook/thank-you` purchase event now reports `PURCHASE.value`, derived from the GHL page's price (this PR). The $5 path has its own thank-you, `/playbook/guide-thanks`.
- The vp-webinars board counts GHL orders only until vp-webinars PR #52 (Stripe source for `ltf.json`) merges. Merge that first, or the first $5 sales are invisible on the board.

## Acceptance (before retiring the $67 checkout)

All three must hold for the first real $5 sale:
1. The buyer receives the delivery email, and the download works.
2. The order shows on `/admin/analytics/playbook`.
3. The order shows on the vp-webinars board's Playbook panel (needs #52, then its next daily refresh).

Only after that: pause "Webinar LTF" and archive the $67 GHL product.

## Rollback (one step)

Unset `PLAYBOOK_GUIDE_LIVE` in Vercel production and redeploy. `/playbook` serves the $67 page again. Paid $5 orders keep their access links: the download route does not depend on the switch.
