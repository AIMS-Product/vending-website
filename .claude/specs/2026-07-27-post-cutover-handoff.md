# Vendingpreneurs — POST-CUTOVER HANDOFF (2026-07-27)

The site went live today. This is the state at handoff, what shipped, and what
is still open. Written for a fresh session.

Repo: `/Users/adamwolfe/vending-website` · Vercel: `aimanagingservices/vending-website`
Live: https://www.vendingpreneurs.com · Studio: https://www.vendingpreneurs.com/admin

---

## 0. Plain-English summary

- **We are live.** vendingpreneurs.com serves the Next.js app. Webflow is off.
- Leads capture, score, route to the right Calendly, alert Slack, and sync to
  Close — all confirmed working on the live domain.
- **One real open item:** UTMs currently land on the Close **lead** (the `SK - UTM`
  fields). Stephen wants them on the **contact** (`utm_source`, `utm_medium`, …).
  That needs a code change, not just an env swap — details in §4.

---

## 1. The cutover (done)

DNS never changed — apex and `www` already pointed at Vercel (`76.76.21.21`).
What was actually serving the old site was a **Webflow rollback proxy baked into
the 21-day-old production deployment** (identifiable by the response header
`x-vp-rollback-origin: webflow`). Going live meant deploying the app, not moving DNS.

Steps taken:

1. Merged `feat/conversion-embeds` → `main` (46 commits, clean fast-forward).
2. Lifted the freeze: `vercel.json` (`deploymentEnabled.main=true`, removed the
   production `ignoreCommand`), rewrote the AGENTS.md freeze section.
3. Cleared both project-level locks via the Vercel API:
   `commandForIgnoringBuildStep` → null, `autoAssignCustomDomains` → true.
4. Pushed `main` → production deployed → domain flipped.

**Rollback** if ever needed: re-promote the last rollback-proxy production
deployment. DNS does not change in either direction.

---

## 2. Bugs found and fixed today

### 2a. Close sync was 100% broken (the big one)

`searchContactsByEmail` called `GET /contact/?email=<email>`. **Close has no
`email` filter on that endpoint** — it ignores unknown params and returns the
org's first page of contacts. Proof: a made-up address returned the same 10
people as a real one. So every lookup came back with 10 "matches", the duplicate
guard in `sync.ts` threw `Multiple Close contacts matched …`, and **no lead was
ever created in Close**. The follow-up enrichment then failed with
`Qualification enrichment is missing a Close lead ID` — that error is a symptom,
not the cause.

Fix (`3ab6d4a`): search leads with the query language instead —
`GET /lead/?query=email:"<email>"` — and keep only contacts whose address matches
exactly. Verified: exact match returns 1, unknown address returns 0.

### 2b. Funnel leads never reached Slack, and Close was ≤10 min behind

Two submit paths exist:

- `submitLead` (`leads.ts`) — notifies inline. Used by the socials booking pages
  and legacy conversion pages.
- `submitInlineQualification` — used by **`/contact`, `/booking-meta`,
  `/booking-youtube`** (the paid-traffic funnels). It queued the Close sync but
  **never called the notification channels at all**.

Fix (`96a7134`): exported `notifyQualificationLead` from `leads.ts` and called it
plus `adminRunCloseSync()` from `after()` in the qualification actions, so the
visitor gets the instant fit result while Slack and Close land a second behind.
Close cron tightened `*/10` → `*/2` as a retry net.

### 2c. Studio redirects only worked for builder pages

Fix (`30f8e3b`): the proxy matcher now admits every public path and terminates it
with a redirect lookup, so an editor can retire **any** URL from Studio without a
deploy. The redirect table is cached in memory (60s TTL) so the home page and
apply funnel don't pay a database round trip per request.

⚠️ **Not verified live.** Tests pass (including a guard that public paths never
reach the admin auth gate), but no redirect row has been created and followed
end to end. First job for the next session: add one in Studio, confirm a real 301.

---

## 3. Verified live on the real domain

A submission on `www.vendingpreneurs.com/booking-meta` with Instagram UTMs
produced, in Close:

- Lead created, status **🆕 New**, phone attached
- Lead fields: `SK - UTM Source/Medium/Campaign/Term/Content`, `fbclid`
- Contact fields: purchase timeline, available capital, guide opt-in
- Inline result "PERFECT FIT" → top-closer Calendly (`cvr6-cfd-zgd`)

Adam confirmed Slack alerts are arriving in `#vp-site-leads`.

Route checks: `/`, `/contact`, `/booking-meta`, `/booking-youtube`,
`/booking-t5-socials`, `/booking-b5-socials`, `/news`, `/robots.txt`,
`/sitemap.xml` all 200 · `/apply` → `/contact` 308 · `/admin/*` gated · apex serves.

---

## 4. OPEN — UTMs must move from the lead to the contact

**Stephen (Slack, 3:52pm):** the UTMs are mapping to the Saleskick (`SK`) UTM
fields on the lead. He wants them on the **contact** fields, and intends to
delete the SK fields.

Contact-scoped IDs he supplied (they match the Close API):

| Field          | Contact-scoped ID                                |
| -------------- | ------------------------------------------------ |
| `utm_source`   | `cf_HA1ayKpXNvIKtmfTfLKWTZoEdBrpq5M35d19GinU5on` |
| `utm_medium`   | `cf_3csfRoa17yTIJBIBTZf0wJOVTypxE7nMyx6mq9Y0x5f` |
| `utm_campaign` | `cf_jnbd0xzUY3tuxzxiGxBs2h0NuExeXMvAoTUM2R64Lq3` |
| `utm_content`  | `cf_R7o66i0XPycLQHlxOLbIqk6c6j3oB8CzxF3e3apI1hn` |
| `utm_term`     | `cf_xmkvth6khfF5h4PS6NYUYSeVfKR1UlSN9ssGTw3xHfj` |

**This is not an env swap.** Attribution is written through `updateLead`
(`updateCloseLeadSourceFields` in `sync.ts`), and Close **400s the whole update**
if a contact-scoped field ID is sent on a lead. Dropping these IDs into the
existing `CLOSE_UTM_*_FIELD_ID` vars would break every sync.

The pattern to copy already exists: `syncQualificationEnrichment` splits
`qualificationLeadCustomFields` (→ `updateLead`) from
`qualificationContactCustomFields` (→ `updateContact`). Do the same for
attribution — split `sourceCustomFields` by scope and write each group to its own
object. Then set the contact-scoped env vars and remove the lead-scoped SK ones.

Also confirm with Stephen **before** he deletes the SK fields, since
`CLOSE_UTM_*_FIELD_ID` currently points at them in both preview and production.

---

## 5. Other open items

1. **SMS consent field** — `CLOSE_CONTACT_PREFERENCE_FIELD_ID` was pointing at
   something that never wrote. Repointed to `💬 Transactional SMS Consent`
   (`cf_htWtseC2d2BXJwswLMCVz8N0zjYqjk7j4neEe0eyFmV`) on preview + production and
   deployed, **but not yet verified with a submission**. Note Close also has a
   `💬 Promotional SMS Consent` field — confirm which one the team wants, given
   the checkbox says "calls and texts about my request".
2. **~42 parked leads** — old rows stuck from bug 2a, still `needs_review` in
   `/admin/leads`. Now that the lookup is fixed they should recover via "Fix now"
   / per-row "Retry sync". Worth a pass to see how many are real prospects.
3. **Test leads in `/admin/leads`** — `vp-ig-e2e-0727@`, `vp-ig-final-0727@`,
   `vp-live-cutover-0727@`, `vp-instant-0727@` (all `@vendingpreneurs-test.com`),
   plus `Stephen Testing 01/02/03`, `adam test`, `KodyLive CheckTest`, `Test Test`.
   Close is already clean — both test leads there were deleted.
4. **Redirect feature unverified live** — see §2c.
5. **Preview `CRON_SECRET` was rotated** by me (production untouched) because the
   original is stored as sensitive and can't be read back. If anyone had the old
   preview value saved, it no longer works.

---

## 6. Things worth knowing

- **Preview and production share one Supabase project**, so they share the lead
  table and the Close sync queue. A staging submission can be drained by the
  production cron and vice versa.
- **Vercel encrypts env values** — `vercel env pull` returns empty strings for
  them. You cannot read `CRON_SECRET` or `CLOSE_API_KEY` back out.
- **Cron jobs can be run on demand**: Vercel → Project Settings → Cron Jobs →
  **Run**. That's the fastest way to force a Close drain during a live test.
- **Studio login is app-owned** (Supabase `app_users`), not Vercel. Kody needs no
  Vercel account. Sessions are per-domain, so a preview login doesn't carry over
  to `www.vendingpreneurs.com`.
- Close's web session can drive its API from the browser, but destructive calls
  need the `_csrf_token` cookie sent as an `X-CSRFToken` header.
