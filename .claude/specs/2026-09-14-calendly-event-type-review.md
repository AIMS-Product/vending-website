# Calendly event-type review — for Stephen / Jess, 2026-09-14

**What we need:** one word per calendar below. That word decides what counts as
a "new call booked" on the Goals page, which is the number the 25-a-day goal is
measured against.

**The four answers:**

- **NEW** — a first sales call with someone we have not sold yet. These are the
  only ones that count toward the 25-a-day goal.
- **follow-up** — a second or later call with someone already in conversation.
- **reschedule** — an existing call moved to a new time.
- **onboarding** — post-sale. Not a sales call.
- **internal** — a generic slot or an internal meeting, not a prospect call.
- **other brand** — not Vendingpreneurs (VendHub, Acquisition Ace, and so on).

**Why this exists:** until now this was a pattern match on the calendar's name,
guessed in code. Three different versions of that guess were live at once and
they disagreed by 202 bookings. All three counted generic `30 Minute Meeting`
slots and other brands' calendars as new Vendingpreneurs sales calls. A guess
also moves silently the moment someone renames a calendar in Calendly. This
list replaces the guess, and anything not on it is counted as nothing rather
than assumed to be a new call.

## The one that matters most: is "Next Steps" a first call?

Fifteen calendars have "Next Steps" in the name, 987 bookings. The draft calls
them follow-ups. **The data says they are first calls.**

| Evidence                                        | "Next Steps" | "Follow-Up" calendars (control) |
| ----------------------------------------------- | ------------ | ------------------------------- |
| Has an earlier new call for the same person     | 14.6%        | 47.9%                           |
| No earlier booking at all                       | 74.8%        | —                               |
| Lands on Close's recorded first-sales-call date | 61-91%       | 0-3%                            |

Three quarters of these people have no earlier booking anywhere in our records,
and Close records the call as their first sales call. The "Follow-Up" calendars,
measured the same way, behave like real second calls. The two groups are not the
same thing and the draft lumps them together.

**95.7% of them belong to Reactivation Scrapers.** That is the likely
explanation: these are Lane 2's own first-call calendars, where a setter books a
prospect after a cold conversation that never existed as a Calendly event.

If that is right, "Next Steps" should be classed **new**, and Lane 2 should be
excluded because of _whose_ call it is, not by mislabelling _what kind_ of call
it is. Practical effect on the marketing pace number is small — 0 to 3 a day,
since Lane 2 is excluded either way — but it changes the Team and Booked pages,
and it changes any count of new calls for the business as a whole.

**Question for you:** when a setter books a prospect onto a "Next Steps"
calendar, is that the prospect's first sales call?

## The others that need a ruling

These change the number the most, or nobody could agree on them:

| Calendar                            | Booked | Drafted as | The question                                                                           |
| ----------------------------------- | -----: | ---------- | -------------------------------------------------------------------------------------- |
| Vending Route Advisory Call         |    265 | NEW        | Is "Advisory" a first sales call, or a paid/post-sale call? 265 bookings turn on this. |
| Vending Discovery Call - Next Steps |     64 | follow-up  | Is this a first call with a confusing name, or genuinely a second call?                |
| Route Planning Call                 |     32 | NEW        | The two old versions of the code disagreed on this exact name.                         |
| Vending Route Consultation          |      2 | NEW        | Ambiguous against "Vending Route Advisory Call" — same thing or different?             |
| Vendingpreneurs - Luis Galarza      |      1 | NEW        | A personal calendar. Prospect calls or internal?                                       |
| Kickoff Call                        |      1 | onboarding | Assumed post-sale. Correct?                                                            |

## Every calendar, most-booked first

Mark the last column where the draft is wrong. Blank means the draft is right.

| Calendar name                             | Booked | Drafted as  | Correct? |
| ----------------------------------------- | -----: | ----------- | -------- |
| Vendingpreneurs Consultation Call         |    448 | NEW         |          |
| Vendingpreneurs Consultation              |    345 | NEW         |          |
| Vendingpreneurs Onboarding Call           |    309 | onboarding  |          |
| Vendingpreneurs Rescheduled Call          |    300 | reschedule  |          |
| Vendingpreneurs Quick Discovery           |    285 | NEW         |          |
| Vending Accelerator Call                  |    279 | NEW         |          |
| Vending Route Advisory Call               |    265 | NEW         |          |
| Vendingpreneurs Next Steps Call           |    243 | follow-up   |          |
| Vendingpreneur Next Steps                 |    228 | follow-up   |          |
| 30 Minute Meeting                         |    144 | internal    |          |
| New Vendingpreneur Strategy Call          |    140 | NEW         |          |
| Vendingpreneurs - Next Steps Call         |    137 | follow-up   |          |
| Vendingpreneurs Call - Next Steps         |    128 | follow-up   |          |
| Vendingpreneurs Follow-Up                 |    121 | follow-up   |          |
| Vendingpreneurs Momentum - Next Steps     |     72 | follow-up   |          |
| Vending Discovery Call - Next Steps       |     64 | follow-up   |          |
| Vendingpreneurs Strategy Session          |     51 | NEW         |          |
| Vendingpreneurs Next Steps Session        |     46 | follow-up   |          |
| Vendingprenuers Consultation              |     42 | NEW         |          |
| Vending Route Discovery                   |     40 | NEW         |          |
| Vending Quick Discovery                   |     34 | NEW         |          |
| Vending Consult Call                      |     34 | NEW         |          |
| Route Planning Call                       |     32 | NEW         |          |
| Vendingpreneurs Consultation Session      |     32 | NEW         |          |
| VendHub Consultation Call                 |     29 | other brand |          |
| Vendingpreneur Follow-up (30 mins)        |     27 | follow-up   |          |
| Vendingpreneurs Connect - Next Steps      |     21 | follow-up   |          |
| Vending Opportunity - Next Steps          |     18 | follow-up   |          |
| Vendingpreneur Follow-up                  |     17 | follow-up   |          |
| New Meeting                               |     13 | internal    |          |
| Vendingpreneurs Pathway - Next Steps      |     10 | follow-up   |          |
| Vending Discovery - Next Steps            |      8 | follow-up   |          |
| AI Operator Collective Consult Call       |      8 | other brand |          |
| 45 Minute Meeting                         |      7 | internal    |          |
| Vendingpreneurs Discovery - Next Steps    |      6 | follow-up   |          |
| One-off meeting                           |      6 | internal    |          |
| Acquisition Ace Strategy Call             |      5 | other brand |          |
| Vendhub Consultation Call                 |      5 | other brand |          |
| Vendingpreneurs - Strategy Call (o)       |      3 | NEW         |          |
| VendHub Next Steps Call                   |      2 | other brand |          |
| Vendingpreneurs - Next Steps              |      2 | follow-up   |          |
| Vending Route Consultation                |      2 | NEW         |          |
| Vendingpreneurs Discovery Call            |      1 | NEW         |          |
| Vendingpreneurs - Luis Galarza Reschedule |      1 | reschedule  |          |
| 60 Minute Meeting                         |      1 | internal    |          |
| Vendingpreneurs - Luis Galarza            |      1 | NEW         |          |
| Vendingpreneurs Elevate - Next Steps      |      1 | follow-up   |          |
| Kickoff Call                              |      1 | onboarding  |          |
| Vendingpreneurs Launch - Next Steps       |      1 | follow-up   |          |
| VendHub \| VendScout Demo                 |      1 | other brand |          |

## After review

Answers go into `src/lib/services/calendly-event-types.json` — set each entry's
`class` and fill in `reviewedBy` and `reviewedOn`. The Goals page shows how many
of the 50 have been signed off, so the number carries its own confidence until
this is done.
