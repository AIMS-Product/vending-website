# Pre-call video engagement — handoff

2026-09-21. Live on `main`. Start here, not at the original spec.

## State

Recording works, proven end to end on prod. Five real sessions and 40 rows
landed within two hours of going live.

Surfaces: `/admin/analytics?tab=video` (the main one) and a per-person panel on
`/admin/bookings`. Hourly cron writes a Close note ~3h before each call.

All five migrations applied. Commits: bbdd284, a1c79d0, 6cbe372, 8c9e5f8 —
the last one needs a push.

## Four bugs found, every one of them past a green build

1. **Player keyed on the wrong id.** Vidalytics registers under the CONTAINER
   id (`vidalytics_embed_<id>`), not the embed id its docs name. Recorded
   nothing at all. Signature: `_vidalytics.embeds` with 30 keys, not 15.
2. **Simultaneous milestones raced backwards.** A scrub crosses 25 and 50 at
   once; separate beacons, both read the old value, 25 won. Now one event with
   the furthest milestone, and `greatest()` in SQL. Never reintroduce a
   read-compare-write here.
3. **"Watched nothing" counted people from before tracking existed.** A call
   list that would have reps chasing our own blind spot.
4. **PostgREST's 1,000-row cap** made the tab publish "1000 booked prospects"
   against 3,952. It reports the cap only in a header.

None were findable without driving the live page. tsc, lint, 2,812 tests and
the build were green through all four.

## The 90-day range — settled, 2026-09-21 evening

It renders. Driven on the real page at 90 days, 1.5s, 19 rows.

**The hang was never the query.** Measured against prod data, the deployed code
reads 3,038 bookings in 1.37s. What cost 70s was listing all 3,038 as rows that
could only say "Not tracked yet".

**The first fix clamped the query to the tracking start date, and that was
wrong.** It made 90 days cheap by dropping everyone who booked earlier — which
is almost everyone with a call coming up: 76 of 86 upcoming calls were set
before 2026-09-21. Those people are watching NOW. Michelle Swetoha booked on
the 18th, opened all fifteen videos at 22:06 on the 21st, call the next day at
19:30 — the clamp deleted her row on the morning of her call, and the page
still looked correct. Do not bound this query by the tracking date again.

The filter belongs on the ROW: listed if it has views OR was booked since
tracking began. A watcher is never dropped, whenever they booked.

**Three panel numbers were measuring our blind spot, not the prospects**, and
all three shipped green alongside the first four:

5. "0% of everyone who booked" — watchers over all 3,038 bookings. Reads as
   "nobody watches these"; the real answer was 56% of the nine people we could
   see. Denominator is now the observable population.
6. "Can't tell" counted every session-less booking in the window, so the strip
   showed 3,038 booked against 3,019 before-tracking and 2,362 can't-tell —
   buckets summing past their own total. Scoped; a test holds the arithmetic.
7. The table rendered "None" both for someone watched who opened nothing and
   for someone with no session. `/admin/bookings` already kept those apart;
   this tab collapsed them, which is the one thing the memory file says must
   never happen — it sends a rep after someone who did watch. Now "No session".

Seven bugs on this feature, every one past tsc, lint, the suite and the build.

## There is no backfill, and there never will be

Tracking began 2026-09-21 20:49 UTC. Nothing recorded plays before that, and
Vidalytics' own data is aggregate and per-anonymous-visitor with no per-person
history. Anyone who booked earlier reads "Not tracked yet" and is excluded from
the call list. Do not let anyone ask for that history again — it does not exist.

## Known ceiling, and it is large

**Three of every four real watchers cannot be named.** Measured: of four
watching sessions, one matched a lead. The booking redirect keeps the session;
a link sales emails does not, so they book on a phone and watch on a laptop as
a new browser with no lead attached.

### Email-matching is a dead end. Measured, do not try it again.

The "637 of 1,000" that motivated it was read under the PostgREST 1,000-row
cap and does not describe the population. The real 90-day shape: 3,038
bookings, 2,332 with no `lead_submission_id`, 1,820 distinct emails among them.

**Four of those 1,820 match a lead row. 0.2%.** A case-insensitive `ilike` over
a 40-email sample returned zero. Every stored lead email is already lowercase,
so case and whitespace are not the problem.

The reason is structural: `lead_submissions` holds 1,151 rows in total against
3,038 bookings in 90 days. Most bookings have no lead row to match because
those people never filled a form on the site — they came through webinar,
reactivation and Close. There is nothing to join to.

### The one open improvement: an identified link for sales

A signed short token in what sales emails, so the page can tie session to
person server-side. Signed, NOT a raw id — a forwarded link would otherwise
attribute the forwardee's watching to whoever it was sent to.

**What it keys on is now an open question, not a detail.** It cannot carry a
`lead_submissions` id, because three quarters of the people sales emails have
no lead row. It has to reference something that exists for all of them — the
Calendly booking, or the Close contact. Settle that with Adam before building.

## Anything touching this again

- Vidalytics will not initialise in a hidden tab. `activate_tab` first, and
  `list_tabs` before assuming which tab is attached — a drifted attachment made
  one run measure LinkedIn and report zeros.
- A seek alone does not fire `timeupdate` on a video whose media never loaded;
  it has to play first. Matters for testing, not for real visitors.
- Labels say REACHED, never watched. The stored number is a high-water mark, so
  a rewatch is not counted twice. Do not relabel it "watch time".

## How to check this feature, and it is not the suite

Seven bugs, none catchable by tsc, lint, 2,815 tests or the build. What caught
every one: drive the page, then read a row back out of Supabase.

The service layer can be measured directly without an admin session:

```
npx tsx --conditions=react-server --tsconfig tsconfig.json <script>
```

importing `@/lib/services/video-engagement-report` with `.env.local` loaded
into `process.env`. That gives real counts against prod in about a second.

Driving the page needs an admin session, and minting one via the Supabase
admin API is refused by the agent sandbox as credential materialization — Adam
has to log in himself at `/admin/login`. Budget for that in any session that
touches this.

One oddity that is NOT a bug: a prospect can appear twice with different
answers. Tenisha Upshaw has two real bookings on 09-24 — an advisory call with
no lead link and a consultation with one — so one row reads "7 of 15" and the
other "No session". The table is one line per BOOKING, which is correct.
