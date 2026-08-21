# Handoff — Kody's homepage revisions + VendScout solutions page

Written 2026-08-20 at the end of a long session. Everything in "Shipped today"
is live on `main` and verified in production. Everything under "Kody's requests"
and "Still open" is NOT started.

---

## Source material

Kody's Slack message, 2026-08-20 4:29pm, plus a 4:56pm follow-up. Files are in
`~/Downloads/` (they are large, JS-rendered standalone exports — open them in a
browser, not a text editor):

| File                                                         | What it is                                         |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `Vending Accelerator Landing (standalone).html` (12MB)       | The homepage mockup. This is the main reference.   |
| `VendScout Solutions Page (standalone).html` (940KB)         | Rough wireframe, placeholder copy, lower priority. |
| `Program Overview.png`, `VendHub Example.png`, 2 screenshots | Supporting imagery.                                |

Also referenced: a Google Sheet, "Working tracker of page builds" (link is in
the Slack thread, 4:32pm). Not read as part of this handoff.

His framing: _"Think this will bring back some of the clarity of the previous
version before we migrated."_ Treat this as a clarity//conversion pass on the
existing homepage, not a rebuild — his own note says it "can map into what
exists."

---

## Kody's requests, interpreted

### 1. Remove aggregate "total people / revenue" claims — DO THIS FIRST

> "We remove all references to total people, revenue, etc."

Exact strings, both files must change:

- `src/lib/content/home.ts:126-128`
  - `"850+"` — Entrepreneurs launched
  - `"$3M+"` — Snack/Drink sales in Vendingpreneur machines
  - `"3,000+"` — Vending locations w/our guidance
- `src/lib/content/home-v2.ts:20-21` — same two stats with `tilt` values
- `src/lib/content/home-v2.ts:28` — **the SEO meta description** repeats all
  three. Easy to miss; it is not on-page copy.
- `src/lib/content/home-v2.ts:31-33` — three more standalone claim strings

**Interpretation flag — confirm with Kody before shipping.** "Total people,
revenue" is read here as _aggregate, program-wide_ claims (850+ entrepreneurs,
$3M+ in sales, 3,000+ locations). It is read as NOT including individual member
results, because his own mockup keeps them: the hero shows "GRAHAM & KATIE ·
$36K/MO · AFTER ONE YEAR", and the program section keeps "10-15 hours a week",
"< 30 days", "$1.5K-$5K in revenue generated per month" with a disclaimer
underneath.

This is an earnings-claims area — `src/lib/content/privacy.ts` already carries
"We do not sell get-rich-quick programs" language. If the intent is actually to
strip _all_ dollar figures including individual results, that is a much bigger
change touching case studies. **Ask before assuming.** Do not widen the scope on
your own judgement.

### 2. Top nav CTA — no work

> "Ignore the top nav cta in the mockup can leave as is"

Leave `src/lib/content/nav.ts` `headerCta` alone.

### 3. Alt CTA → 90-day roadmap landing page

> "alt cta leads to the 90 day roadmap lp"

The mockup hero has two CTAs: **JOIN NOW** (primary) and **GET YOUR FREE 90-DAY
ROADMAP** (secondary).

The destination exists and returns 200: **`/vending-route-blueprint`**
(`/resources/vending-route-blueprint` is a 404 — do not use it). Content lives
in `src/lib/content/lead-magnets.ts` ("The 90-Day Vending Route Roadmap", CTA
copy "Get the 90-day roadmap").

Point the homepage secondary CTA there. Confirm with Kody that
`/vending-route-blueprint` is the LP he means — the naming differs from how he
said it.

### 4. "Meet our team" → /about

> "Meet our team goes to about"

Whatever "Meet our team" element the homepage carries should link to `/about`,
not open a modal or scroll in-page.

### 5. Brand banner — bigger and bolder

> "We can increase the size and boldness of the bran banner that's currently
> running"

("bran" is a typo for "brand".) This is the existing logo strip — in the mockup
it reads **"TRUSTED BRANDS IN OUR MACHINES"** with 365, Alani NU, Cantaloupe,
micromart, PEPSICO, PRIME, poppi.

Scale it up and increase weight. It already runs on the live site, so this is a
sizing/emphasis change, not new work. Keep the existing marquee behaviour.

### 6. Hero test — a member who is not Mike or Anthony

> "Test including a member who is not mike or anthony in the hero"

The mockup does this with **Graham & Katie**, and there is already a case study
at `data/case-studies/graham-and-katie-parker.json`.

He said "test", so treat it as an A/B variant rather than a straight swap. The
site already has experiment/variant plumbing — leads carry `experimentKey` and
`variantKey` through to Close, and the admin analytics has a Lead quality tab
that splits by variant. Wire it through that so the result is measurable.

### 7. VendScout Solutions page — lowest priority

> "very rough wireframe of a solutions page with placeholder copy" ... "Can get
> more put together"

His words: rough, placeholder. Do not build this out until the homepage work is
done and he confirms the copy is real.

Structure from the mockup, for reference:

- Hero: "Find, pitch, and secure vending locations" — CTAs "START YOUR VENDING
  BUSINESS" / "BUILD A ROUTE"
- Testimonial row: three slots (finding / pitching / contracts) — **all
  placeholder text**, needs real operator quotes
- Three-step section: `01 · FIND` (ranked locations), `02 · PITCH` (a site that
  pitches for you), `03 · SECURE` (signed the same day)
- Deep-dive section per step, starting "Your next 100 locations, found before
  your coffee gets cold."

---

## Shipped today (context — all live, verified in production)

1. **Booked-call attribution.** `lead_submissions.call_booked_at` / `call_status`
   / `call_reconciled_at`, mirrored from Close's "First Call Booked Date" by
   `src/lib/services/close-booking-reconcile.ts`, riding the existing 2-minute
   close-sync cron. Read-only against Close. All 547 leads backfilled.
2. **Admin leads page** — "Call booked" column + Booked/No-call filter + count.
3. **Channel normalisation** — `src/lib/analytics/channel.ts`. Merges
   `Instagram`/`instagram`/`mike-ig` and `meta`/`FaceBook`, rolls untagged into
   "Website", keeps per-person credit as sub-rows.
4. **Analytics** — booking metrics now read from Close instead of the dead
   Calendly table; breakdown rows carry booked counts; percentage deltas are
   withheld when the prior window has under 10 leads (this was rendering
   "+17,533%").
5. **Footer social links** — YouTube, Instagram, TikTok, LinkedIn.

### The numbers, for reference

Jul 27 – Aug 20: **18.8 form fills/day, 8.4 booked calls/day on the site, 44%
conversion.** Verified against Close meeting records — 184 of 265 bookings
happened within five minutes of form submit.

Close's `Funnel Name` field labels leads by _traffic source_, so a YouTube
visitor who books on our page is filed under YouTube. Only 26 of 265 were
labelled "Website" — that is where the CEO's "1.2 calls/day" came from.

---

## Still open (not started, each needs a decision)

| Item                                    | Detail                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`vendingpreneurs.ai` apex is broken** | `vendingpreneurs.ai` (no www) redirects to a ClickMagick "Bad Smart Link Domain" error. `www.vendingpreneurs.ai` is a live Perspective VSL funnel. Fix is a DNS change in Cloudflare — **not in this repo, needs Adam's go-ahead**, and someone should confirm who owns that ClickMagick account first. |
| **Calendly webhook dead in production** | `CALENDLY_WEBHOOK_SIGNING_KEY` only exists in Preview, never Production, so `/api/webhooks/calendly` has 401'd since Aug 3. Not blocking anything — Close covers booking state — but it is what would give live cancellations and per-calendar detail. Needs Calendly admin access.                     |
| **Stale banner on /admin/analytics**    | "448 calls were booked in this range. 348 of those came from outside this website" is still fed by the dead `calendly_bookings` table. Numbers are stale and sit next to live ones. Fix or hide.                                                                                                        |
| **Instagram account choice**            | Footer points at `@vendingpreneurs` (199 followers). `@mikehoffmannofficial` has 309K, and his tagged links book at 85% — the best of any channel. Adam's call whether to add or swap.                                                                                                                  |
| **No X or Facebook**                    | `x.com/vendingpreneurs` 404s; `facebook.com/vendingpreneurs` is not public. Deliberately not linked. If they exist under other handles, it is a one-line add in `src/lib/content/nav.ts`.                                                                                                               |

---

## Working notes for whoever picks this up

- **`AGENTS.md` first.** This is not the Next.js in your training data; read
  `node_modules/next/dist/docs/` before writing.
- **Pushes to `main` publish straight to www.vendingpreneurs.com.** No staging
  gate. Verify on the branch preview first.
- **Migrations do not auto-apply.** Paste SQL into the Supabase editor for
  project `aacisvhkmsaabqdvdmmf`. The CLI on this machine is authenticated to a
  different org and cannot reach it.
- **`LEAD_FIELDS` in `src/lib/services/lead-admin.ts` is an explicit column
  list.** Adding a DB column and a type is not enough — it must be added there
  too or the admin page silently receives null. This cost a round trip today.
- **Verify what renders, not just that the route returns 200.** Same lesson.
- Content strings belong in `src/lib/content/`, never inline in JSX.
- No emojis in UI. No dark theme.
- Repo checks: `npx tsc --noEmit`, `npx vitest run` (1544 passing), `npx eslint
src/`. One pre-existing lint warning in `src/app/admin/pages/actions.test.ts`
  is not yours.
