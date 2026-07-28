# Vendingpreneurs — TRACKING + ANALYTICS HANDOFF (2026-07-28)

Continues `2026-07-27-post-cutover-handoff.md`. Site is live and healthy.
Written for a fresh session.

Repo: `/Users/adamwolfe/vending-website` · Vercel: `aimanagingservices/vending-website`
Live: https://www.vendingpreneurs.com · Studio: https://www.vendingpreneurs.com/admin

---

## 0. Plain-English summary

- **Marketing tracking was completely off on the live site.** It is on now.
- **SMS consent never reached Close.** Root cause was a missing config line, not
  the field ID. Fixed and proven with a live submission.
- **Studio redirects never worked end to end.** Two bugs fixed; a real 301 is
  confirmed on the live domain. One case still needs a database migration.
- **`/admin/analytics` was rebuilt** from 4 tiles into a 4-tab dashboard.
- **Leads are flowing.** 23 real prospects, 12 of which arrived during the
  session on 2026-07-27. Lead velocity is not dead.
- **Everything still open is blocked on Supabase access** (see §5).

---

## 1. Tracking — was dark, now live

Nothing was tracking on production. Two independent causes:

1. **GTM and GA4 were never ported** from Webflow at all.
2. Every other tag (Meta Pixel, HubSpot, ClickMagick, idpixel, Vidalytics,
   RightMessage, ManyChat, Wisepops) sat behind `NEXT_PUBLIC_TRACKING_ENABLED`,
   which **did not exist in any Vercel environment**.

Both Google IDs were recovered from the archived Webflow markup on the Wayback
Machine (the live page ran `gtag('config', …)` for both):

- GTM container: `GTM-57QRC275`
- GA4 property: `G-2SX78VE7VF`

Webflow served the Google loader through its own first-party-mode path
(`/lsfr…`), which only existed on Webflow's edge — so `TrackingScripts.tsx` uses
the standard `googletagmanager.com` loader instead.

`NEXT_PUBLIC_TRACKING_ENABLED=1` is now set on **production and preview**.

**Verified live** on `/`, `/booking-meta`, `/contact`: GTM container loads and
pulls in its own GA4 + two Google Ads conversion tags, plus LinkedIn, HubSpot,
Meta Pixel, ClickMagick, idpixel, Vidalytics, RightMessage, ManyChat, Wisepops.

⚠️ **Unverified:** whether the GTM container ALSO fires a GA4 tag. If GA4 shows
doubled pageviews, remove the `gtag('config', GA4_MEASUREMENT_ID)` line in
`TrackingScripts.tsx`. Kody should check GA4 realtime.

---

## 2. SMS consent — root cause was NOT the field ID

`CLOSE_CONTACT_PREFERENCE_FIELD_ID` was **absent from `src/lib/config.ts`** —
missing from both the schema and the `process.env` mapping. The Close client read
`env.CLOSE_CONTACT_PREFERENCE_FIELD_ID`, always got `undefined`, and
`assignCustom` skips an undefined field ID **silently**. The sync reported
"Synced" with no error while the answer never left the app.

That is why repointing the environment variable twice changed nothing.

Fixed in `config.ts`. A structural test now asserts every `CLOSE_*` id the client
reads from env is declared in config, so the next one fails CI instead of
vanishing.

**Proven live:** a submission wrote `💬 Transactional SMS Consent: true` to the
Close contact, alongside all five UTM fields.

---

## 3. Studio redirects — two bugs, one remaining migration

1. **Create-side:** validation only accepted builder page paths, rejecting the
   exact thing the feature exists for (a retired one-segment Webflow URL).
   Relaxed to any public path; `/`, `/admin`, `/auth`, `/api`, `/_next` and
   assets stay rejected because the proxy can never serve them.
2. **Serve-side:** `handleCustomBuilderPath` is terminal for every two-segment
   path but returned `next()` without checking the redirect table for
   unconfigured prefixes and non-builder shapes. Also `/news/{slug}` 404'd before
   consulting redirects.

**Proven live:** `/vp-check/redirect-0727` returned a real `301 → /contact`.
Test row deleted afterwards.

⚠️ **Still blocked:** one-segment sources (`/old-offer`) fail a DB CHECK
requiring two segments. Migration is written and committed but **not applied**:
`supabase/migrations/20260727220000_relax_redirect_source_to_any_public_path.sql`

---

## 4. Analytics rebuild — `/admin/analytics`

**What was wrong:** booking rate showed **1343.5%** (309 Calendly bookings ÷ 23
website leads — Calendly also receives Saleskick, phone, and direct-link
bookings). Counts were stale and disagreed with `/admin/leads`. Fixed 90-day
window, `utm_source` only.

**Now:** four tabs, one fetch, `force-dynamic`.

- **Overview** — leads / qualified / booked / booking rate, each with
  prior-period comparison + sparkline. Range switcher 7/30/90d/1y.
  Booking rate now counts only bookings traceable to a lead (FK or invitee
  email); outside bookings are reported separately, never folded in.
- **Acquisition** — channel mix, all five UTM params, campaign table scoring
  each campaign on leads → qualified → booked → rate.
- **Pages & funnel** — captured → started → finished → qualified → booked with
  per-step drop-off; landing page vs submit page; referrers grouped by host.
- **Lead quality** — fit result shown to the visitor, timeline, capital,
  business stage, region, Close sync health.

**Test/internal leads are excluded by default** via `admin-analytics-internal.ts`
(team domains, plus-addressed emails, test domains, names containing "test").
Filtering was chosen over deleting because one QA round produced 45 fake rows
against 11 real ones and deleting does not survive the next test session.

### What the data already says

- **43.5% of leads never start the questions** (23 captured → 13 started).
  Everyone who starts, finishes. The whole loss is at step one — highest-leverage
  fix on the site.
- **`book-call` / `mike-ig` books at 75%** (4 leads → 3 booked), while
  `start-vending-business` and `ltf_buyers` produced 2 qualified each and 0 booked.
- **10 of 23 saw "Not right time"**, only 3 got a positive fit. Scoring may be
  too tight, or the traffic mix is wrong.
- 78% have no timeline/capital/state — those belong to the older long form; the
  live funnel only asks timeline and capital. Not a bug.

---

## 5. BLOCKED — all on Supabase access

The Supabase project `aacisvhkmsaabqdvdmmf` sits under an account this machine
cannot reach (`supabase projects list` does not include it), and
`SUPABASE_SERVICE_ROLE_KEY` is marked Sensitive in Vercel so it cannot be read
back. Three things wait on it:

1. Apply the redirect migration (§3).
2. **Set Kody's Studio password.** Studio has no set-password-to-a-value
   function — only "send password setup email" — and **Adam's account is `Admin`,
   not `Super admin`**, so even that is read-only for him. Super admins are
   `james@`, `jess@` (pending), `kody@`. Kody is **Super admin · Active**, so the
   fastest unblock is Kody using "Forgot password?" himself.
3. Any future schema change.

**Unblock:** Supabase dashboard login for that project, or the service role key.

---

## 6. Open questions for Adam

- `Nathan Wirth · nrwirthdesign@gmail.com` — real lead or Kody's test? Kept
  deliberately; deletion is irreversible.
- Confirm with Stephen before he deletes the five `SK - UTM *` lead fields.
  The site no longer writes them (proven), but deleting a Close field destroys
  its history — export first if anyone reports on pre-cutover attribution.

---

## 7. Things worth knowing

- **Preview and production share one Supabase project** — a preview submission is
  drained by the production cron and shows in production's lead list.
- **Vercel encrypts env values**; `vercel env pull` returns empty strings.
- **Studio sessions are per-domain** — a preview login does not carry to
  `www.vendingpreneurs.com`, and each new preview URL needs a fresh login.
- **Close's `/contact/?email=` filter is silently ignored** — it returns the
  org's first page. Use `GET /lead/?query=email:"<addr>"` for exact lookups.
- **Close scope-locks custom fields**: sending a contact-scoped field ID on a
  lead update 400s the entire update. Attribution and qualification are both
  split by scope in `sync.ts` — keep it that way.
- Close's web session can drive its API from the browser, but destructive calls
  need the `_csrf_token` cookie sent as an `X-CSRFToken` header, plus
  `organization_id` (Vendingpreneurs =
  `orga_Qwbx9tyUrl7Jdjurg9xJ8N6w1MN4PD2NQOgIhd8r7rC`).
- A full pre-cleanup export of all 56 leads was saved to the session scratchpad
  as `all-leads.tsv` before any deletion.

---

## 8. Cleanup done

- 45 fake/internal rows deleted from `/admin/leads`; 11 real prospects kept.
  All test leads deleted from Close. Verified zero remaining.
- Test redirect row created, verified as a real 301, then deleted.
