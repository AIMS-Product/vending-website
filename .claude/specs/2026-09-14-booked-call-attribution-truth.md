# Booked-call reporting: one definition, one number, 2026-09-14

**The problem is not missing data. It is missing definitions.**

In one session, "how many calls were booked today" was answered 24, then 34,
then 12. Every answer was defensible. None was labelled. Adam nearly sent the
wrong one to the marketing lead, and the whole point of this work — per Jess —
is "what gets measured gets managed", which fails the moment two people read
the same word differently.

This spec is the fix: name every number, pick the canonical ones, put the
definition next to the value everywhere it is shown.

## 1. Every "booked" number that exists today (all real, all different)

For Monday 2026-09-14, from production:

| #   | Meaning                                                    | Source                                                    | Value |
| --- | ---------------------------------------------------------- | --------------------------------------------------------- | ----- |
| A   | First sales calls **on today's calendar**                  | `close_lead_funnel.first_sales_call_booked_date = today`  | 24    |
| B   | **All meetings** on today's calendar                       | `calendly_bookings.event_start_at` on today, not canceled | 37    |
| C   | **All bookings created today**, landing any day            | Calendly `raw_payload->payload->created_at`               | 35    |
| D   | **New calls booked today** (C minus follow-up event types) | C + event-name classifier                                 | 12    |
| E   | Follow-ups/reschedules booked today                        | C minus D                                                 | 23    |
| F   | Booked today **that also land today**                      | C where `event_start_at` = today                          | 2     |
| G   | Capacity dashboard "Total Meetings Booked"                 | 24 new + 7 F/U + 3 resch, scheduled today                 | 34    |

**C (35) and G (34) are nearly the same number and mean nothing alike.** One is
bookings made today across two weeks of calendar; the other is meetings sitting
on today's calendar. This coincidence already caused one wrong report.

**The number Jess is asking for is D.** Her goal is "book 25 calls per day".
Today D = 12, which is under half. Reporting C (35) makes it look like +10 over.

### D by day, last week

| day       | new (D) | follow-up (E) | total (C) |
| --------- | ------- | ------------- | --------- |
| 09-08 Mon | 50      | 40            | 90        |
| 09-09 Tue | 16      | 32            | 48        |
| 09-10 Wed | 20      | 25            | 45        |
| 09-11 Thu | 13      | 31            | 44        |
| 09-12 Fri | 10      | 16            | 26        |
| 09-13 Sat | 6       | 5             | 11        |
| 09-14 Mon | 12      | 23            | 35        |

Only 09-08 cleared 25. The headline total (C) clears it most days. That gap
between C and D is the vanity metric Jess wants killed.

## 2. Attribution is mostly recoverable today — it is not a UTM problem

Joining `calendly_bookings.invitee_email` to `close_lead_funnel.email`
**resolves 26 of 35 of today's bookings to a channel.** Result:
Reactivation Scrapers 14, VSL 2, Google Ads 2, YouTube 2, Website 2,
Internal Webinar 2, Instagram 2, still unknown 8.

Only 8 of 35 carried a `utm_source` at all — but that is **not** a tracking
failure. Reactivation and scraper bookings are outbound; nobody clicks a tagged
link, so a UTM never existed. Chasing UTMs first would be fixing the wrong
thing.

Today's **new** calls (D = 12) by channel, via the email join:
VSL 2, Google Ads 2, YouTube 2, Website 2, Instagram 1, no Close match 3.

**Do the email join first.** Real UTM work matters only for genuinely inbound
bookings and is a much smaller job than it appeared.

## 3. UNVALIDATED — must be confirmed before anything ships

**The new-vs-follow-up classifier is a regex I invented and nobody has
approved.** It is:

```
/next steps|follow-?up|onboarding|reschedul|momentum|elevate/i
```

against `calendly_bookings.scheduled_event_name`. Today's 14 distinct event
names:

- Classified NEW: Vendingpreneurs Consultation (4), Vendingpreneurs Quick
  Discovery (3), Vendingpreneurs Consultation Call (2), Vending Accelerator
  Call (2), Route Planning Call (1)
- Classified FOLLOW-UP: Vendingpreneurs - Next Steps Call (6), Vendingpreneurs
  Follow-Up (4), Vendingpreneurs Next Steps Call (3), Vendingpreneurs
  Onboarding Call (2), Vending Discovery Call - Next Steps (2), Vendingpreneurs
  Momentum - Next Steps (2), Vendingpreneurs Rescheduled Call (2),
  Vendingpreneurs Elevate - Next Steps (1), Vending Discovery - Next Steps (1)

Doubtful calls: is "Route Planning Call" a new sales call? Is "Vending
Discovery Call - Next Steps" a first call with a bad name, or a follow-up?
**Pull the full event-type list from the Calendly API, have Stephen or Jess
mark each one new/follow-up/onboarding/internal, and check that mapping in as
data.** A regex over free-text event names is not a reporting foundation —
someone renames a Calendly event and the number silently moves.

## 4. Build: one definitions module, every surface reads it

`src/lib/services/booked-metrics.ts`

- One exported definition per metric (A–G above): `key`, plain-English
  `label`, `definition`, `source`, `basis` (booked-on vs lands-on),
  `includes` (new/follow-up/all).
- One reader returning `{ value, definition, asOf, coverage }`.
- Every surface — Goals page, funnel map, Channels tab — renders the value
  **with its definition attached**. No bare "booked" anywhere.
- Canonical defaults: **D** ("New calls booked") for marketing pace, **A**
  ("First calls on the calendar") for capacity.
- Attribution resolves in this order: Close funnel via email join → UTM →
  `(unattributed)`. Never silently blank.
- Reuse `channel-targets.ts` `channelKeyForFunnel` so channel labels match the
  Goals page exactly.

Then put D on the Goals page against the 25/day goal, with the forward
capacity view from `2026-09-14-funnel-map-live-data-handoff.md` §3.

## 5. Questions for Jess / Stephen — these block correctness

1. **Is the 25/day goal new calls only?** Assumed yes (D). If it includes
   follow-ups, today is 35 not 12 and everything above changes.
2. **Is it all channels or marketing-sourced only?** Reactivation Scrapers is
   the single biggest source and is outbound, not marketing.
3. **How does 25/day reconcile with the 800/month in `channel-targets.ts`?**
   25 x 22 workdays = 550, well under 800.
4. **The Calendly event-type mapping in §3** — needs a human to mark each one.
5. **Open-slot data** — no `CALENDLY_*` credentials exist in `.env.local`, so
   capacity/availability cannot be read. Where does the capacity dashboard get
   "29 open slots"?

## 6. Do not repeat these

- Do not report a "booked" number without saying which of A–G it is.
- Do not use `calendly_bookings.created_at` — that is our row-insert time
  (showed 1,899 "created today" from a backfill). Use
  `raw_payload->payload->created_at`.
- Do not treat "no UTM" as broken tracking until the email join has run.
- Do not turn missing into zero. Violated twice already in this work.
- `first_sales_call_booked_date` is the **scheduled** date, not the booked
  date. Code comments and the map still say otherwise — fix the wording.

## 7. Related

- `2026-09-14-funnel-map-live-data-handoff.md` — the map work, cohort basis,
  forward capacity gaps, and the lead-time baseline still to build.
- Nine commits local on `main`, unpushed. Suite green at 2,440.
- **Rotate `CLOSE_API_KEY`** — `api_5lK5…` was pasted in chat 2026-09-14.
