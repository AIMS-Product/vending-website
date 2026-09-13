# HANDOFF — Vendingpreneurs attribution, reporting, and Q4 goal tracking

Paste-ready brief for a fresh session. Everything below was verified against
live production data on 2026-09-12/13. Trust it; do not re-derive.

---

## THE TASK

Two things, in order:

**1. Q4 channel goals (blocked, needs Adam).** Adam has a `Q4 Channel Goals.xlsx`
he wants set against the real Q3 baseline, turned into projections, and tracked
on the dashboard against weekly/monthly targets — per channel AND per team
(leads, channels, webinars, socials, ads, setters, closers). He is tying his own
performance reporting to this and presenting it to the company, so accuracy and
visual quality both matter.

BLOCKER: the file has never been readable. It arrived as a thumbnail image, not
a file, and is not on ~/Desktop or ~/Downloads. **Ask for it first. Do not guess
a single target.** Options: drag the real .xlsx in, save to ~/Desktop, paste as
text, or share the Google Sheet link.

**2. Finish attribution certainty (unblocked, can start now).** Two concrete
items, both described under OPEN WORK below.

---

## PROJECT

- Repo `AIMS-Product/vending-website`, local `/Users/adamwolfe/vending-website`,
  branch `main`. **A push to main deploys to www.vendingpreneurs.com in ~1 min.**
- Next.js 16 / React 19 / Tailwind 4 / Supabase (ref `aacisvhkmsaabqdvdmmf`) /
  Vitest. `AGENTS.md` is authoritative for repo rules.
- Admin is at `/admin`, auth-gated (a curl returns 307 to /admin/login — that is
  success, not failure). Adam's login: adam@modern-amenities.com.

### Verification — run all of these, paste real output, never infer success

```
npx tsc --noEmit
./node_modules/.bin/vitest run     # NOT `npx vitest` — triggers a failing pnpm deps check
./node_modules/.bin/next build     # kill any running next-server first; a guard blocks it
./node_modules/.bin/eslint <files>
./node_modules/.bin/prettier --write <files>
```

Baseline as of this handoff: **2,274 tests passing, tsc clean, build clean.**

### Hard rules

- No emojis. No dark theme. Inline SVG icons in the existing Lucide-ish style.
- Plain English in UI. No litotes, no irony — write the positive claim.
- **A dash means "not observed", never zero.** Never print a rate above 100%.
  Never fabricate a number a connector did not report.
- **Never touch a Calendly URL.** Not in `src/lib/chatbot/booking.ts`,
  `src/lib/content/booking-pages.ts`, or
  `src/lib/qualification/thank-you-links.ts`. Adam has challenged this twice —
  changing a live booking link would be a serious incident.
- Stage files explicitly. Never `git add -A`. Never commit `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, or `.claude/specs/2026-09-10-overnight-polish-handoff.md`
  (pre-existing untracked, not ours).
- Commit messages: conventional prefix, lowercase subject, body explains the
  judgement and the failure it prevents, no bullet lists. End with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Read-only DB access pattern used throughout: PostgREST + service role key from
  `.env.local`. The Calendly and Close API tokens are NOT available locally
  (sensitive in Vercel); the Close MCP connector works for Close reads.

---

## WHAT SHIPPED 2026-09-12/13 (all live on main)

| commit                | what                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `7c15ea2`             | chatbot can no longer claim a call booked on a setter's calendar              |
| `4525307`             | `/admin/bookings` — "Who set this call", one answer per booking with evidence |
| `c1292c5`             | KPI Lane 2 setter rows read the same credit rule as the ledger                |
| `7cfb352`             | labelled the two surfaces that read as credit but are not                     |
| `e1698a4` / `7969b0c` | per-setter tagged booking links (Lane 2 round robin)                          |
| `888b394`             | setter credit inferred from Close call/SMS before a self-booking              |
| `a92ffc1`             | KPI table: brand logos, empty columns hidden, plumbing moved to hover         |
| `76535b2`             | `/admin` rebuilt as a channel command center                                  |
| `ce167d5`             | Q4 scoping spec                                                               |

### The origin story (context for why the credit rule is shaped this way)

Setters were accusing the chatbot of stealing their booking credit. Root cause:
the chatbot's email-match fallback claimed ANY booking by a chatted-with address
within 30 days, ignoring which calendar. All 6 email matches on record were on
setter/closer calendars. Worse, our admin already showed it correctly — the thing
claiming the chatbot was a **note written on the Close lead**, which is the only
surface a setter actually reads. Lesson worth keeping: **when attribution is
disputed, check the CRM surface, not just our own dashboard.**

### The breakthrough

**Calendly has recorded who books every call the whole time** —
`invitee_scheduled_by` in the stored webhook payload. Never read until now. No
behaviour change needed from anyone. Read via PostgREST JSON selectors, no
migration:

```
scheduled_by:raw_payload->payload->>invitee_scheduled_by
booked_at:raw_payload->payload->>created_at
hosts:raw_payload->payload->scheduled_event->event_memberships   # free URI->name directory
```

### The credit rule (`src/lib/services/call-credit.ts`) — strongest evidence first

1. Rep Calendly recorded as booking it
2. A setter's own tagged link (`utm_source=setter&utm_content=<slug>`)
3. Chatbot's own tag
4. Another tagged link (channel self-booked)
5. Close's stated setter field
6. **Inferred:** last setter to call/SMS in Close within 48h BEFORE the booking,
   roster-restricted, shown with the gap and marked "not a record of the booking"
7. Untagged — says so, never guesses

**Never used as evidence:** the Calendly host (round robin picks a closer, not the
setter) and Close activity without the roster filter (setters and closers share
names).

---

## KEY FILES

- `src/lib/services/call-credit.ts` — the credit rule, setter roster, brand of
  evidence, `setterBookingUrl`
- `src/lib/services/call-credit-data.ts` — reads bookings + chat index
- `src/lib/close/setter-touch.ts` — the 48h inference
- `src/lib/services/close-booking-reconcile.ts` — writes it, 2-min cron, 6h
  per-lead recheck
- `src/lib/services/channel-report.ts` — **the channel spine; primary substrate
  for Q4 projections**
- `src/lib/services/kpi-report.ts` + `kpi-report-data.ts` — KPI framework
- `src/components/admin/ChannelLogo.tsx` — brand marks in colour, neutral glyph
  for owned surfaces, aligned dot fallback. **Reuse everywhere a channel is named.**
- `src/components/admin/OverviewPanels.tsx` + `src/lib/services/overview-highlights.ts`
- `src/app/admin/page.tsx` (overview), `src/app/admin/bookings/page.tsx`,
  `src/app/admin/analytics/page.tsx`

---

## THE SEVEN MEASUREMENT LIMITS — a Q4 projection that ignores these will be wrong

1. **Show rate is an upper bound, not a measurement.** Only ~37% of booked calls
   carry any Close outcome; the rest are counted as shown. A show-rate target is
   fiction until outcome logging improves.
2. **Revenue has two legitimate bases** — cohort ($296K) vs Close cash ($503K).
   Both correct. Pick one per goal line and label it.
3. **Booking credit certainty, last 30 days of 509 calls:** 41% Calendly
   recorded who booked · 27% link carried a tag · **33% untagged, inferred**.
   Any per-setter target must state which tier it counts.
4. **9 Calendly user ids book but never host** → 38 calls/month show an id, not a
   name. Fixable (see OPEN WORK).
5. **Setter vs closer is derivable from behaviour** — books-vs-hosts ratio:
   setters Connor George 47/5, Charlie Ingram 35/7; closers Luke Herman 20/116,
   Joseph Vaughan 11/95, Christian Hartwell 8/91, Shreya Bechra 6/71, Robin
   Perkins 1/29; genuinely both: Ariella 33/48, William Nowak 17/19.
   NOT setters (Adam, 2026-09-12): Mike Hoffmann, Kody Wirth, Dom Ellis, Eric,
   Jess, Adam, Anthony, Joe Dysert, Glenda Castro, Stephen Olivas.
6. **801 GHL form leads carry no channel attribution** on the KPI tab — the
   single biggest hole for channel goal tracking, larger than every tagged
   channel combined.
7. **Overview thresholds are provisional** — 5 leads to count as a mover, 10 to
   print a booking rate (`overview-highlights.ts`). Tune once targets are known.
   On a 7-day range these will blank most small-channel rates.

---

## OPEN WORK

**Can start immediately:**

- **Name the 9 unknown Calendly users.** `GET /users/{uuid}` returns name+email
  definitively. Token is in Vercel production only (`CALENDLY_API_TOKEN`,
  sensitive — `vercel env pull` returns empty). The app already has
  `createCalendlyApiClient`. Resolve + cache; +38 calls/month become named, 100%
  certain.
- **Surface proven vs inferred.** `/admin/bookings` and the KPI tab currently mix
  them in one number. Adam's actual question was "how do we be 100% sure" — the
  honest answer is to state the split (68% proven / 33% inferred) on the page so
  every report carries its own certainty.

**Needs Adam:**

- 6 Close leads still carry the old chatbot-worded note (written before `7c15ea2`).
  No Close API key locally; needs Adam or Stephen to delete.
- Confirm the setter/closer split for the behaviour-derived names above.
- Confirm or retune the two Overview thresholds.
- "Won" is often a dash on short ranges — one of four headline cards frequently
  empty. Consider swapping for Spend or Cost per lead.

**Already self-running, do not re-trigger:**

- The setter-touch inference fills in via the 2-minute reconcile cron as each
  lead comes up in its 6h rotation. Migration `20260912130000_setter_touch.sql`
  is applied. Coverage ceiling: 384 booked leads with no stated setter, of which
  286 have a linked Calendly row and can be timed; the other 98 cannot until
  bookings match back to leads by something other than email.

---

## WORKING STYLE ADAM EXPECTS

Direction → propose (3-7 bullets) → he confirms → execute. "go"/"yes"/"ship"
means execute immediately, no re-asking. Plain English status, no jargon in the
body. Verify before claiming done; never report success from inference. He
catches mistakes — two today — so flag uncertainty rather than smoothing it over.
He values being told what is NOT provable at least as much as what is.
