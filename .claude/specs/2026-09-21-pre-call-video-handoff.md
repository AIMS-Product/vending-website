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

## Not verified

**The 90-day range.** It hung at ~70s on sequential batches; 8c9e5f8 issues
them in parallel but that is UNPUSHED and unmeasured against prod. Confirm it
renders before trusting any 90-day number. 7d and 30d were fine.

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

Two open improvements, neither recovering the past:

1. **Email-match the unlinked bookings.** 637 of 1,000 in the 90-day window had
   no `lead_submission_id`, but they carry `invitee_email` and most will match a
   lead by email, recovering the session. Self-contained; nobody else needs to
   agree to it.
2. **Identified link for sales.** A signed short token in what sales sends, so
   the page can tie session to lead server-side. Use a signed token, NOT a raw
   lead id — a forwarded link would otherwise attribute the forwardee's watching
   to the original person. Needs Adam and Kody, because it changes what sales
   sends.

## Anything touching this again

- Vidalytics will not initialise in a hidden tab. `activate_tab` first, and
  `list_tabs` before assuming which tab is attached — a drifted attachment made
  one run measure LinkedIn and report zeros.
- A seek alone does not fire `timeupdate` on a video whose media never loaded;
  it has to play first. Matters for testing, not for real visitors.
- Labels say REACHED, never watched. The stored number is a high-water mark, so
  a rewatch is not counted twice. Do not relabel it "watch time".
