# Metric Calculation Reference

This document describes the calculations implemented by this repository — the admin dashboard at
`vendingpreneurs.com/admin`. It is written from the executable code, not from the labels, and every
definition carries the file and line that implements it. Section 13 compares these calculations with
the MTD funnel dashboard and with SteelTrap.

It is the counterpart to the MTD dashboard's own `METRICS.md`. The two are meant to be read side by
side: where a definition differs, the difference is named here rather than averaged away.

`REPORTING.md` in this repository is the companion document. It holds the measured divergences, the
register of contested numbers, and the traps. This file holds the arithmetic.

There are four calculation pipelines, and they do not share their definitions:

1. **Channel report** — the Channels, Funnels and Executive tabs. Marketing attribution: which
   source, campaign and creative produced which outcome.
2. **Close mirror** — the Close tab. A funnel over our hourly copy of Close CRM, built to be
   comparable with the MTD dashboard.
3. **Booked-call metrics** — the daily and capacity views over Calendly.
4. **Cost and targets** — CAC per route, and the Q4 booking plan.

Unless a section says otherwise, a definition applies to the pipeline it appears under. A metric name
that appears in two pipelines does not necessarily mean the same thing in both, and where it does not,
that is stated.

---

## 1. Reporting windows and time zones

**This is the first thing to check when two numbers disagree.** Three different day boundaries are in
use inside this repository, and none of them is Pacific.

| Surface                     | Day boundary                      | Week definition                           | Implemented at                     |
| --------------------------- | --------------------------------- | ----------------------------------------- | ---------------------------------- |
| Close mirror, month to date | UTC calendar date                 | n/a                                       | `close-mtd-funnel-data.ts:36`      |
| Close mirror, week view     | UTC calendar date                 | **Friday to Thursday**                    | `close-week-view.ts:75-83`         |
| Channel spine writes        | UTC (`toISOString().slice(0,10)`) | n/a                                       | `channel-sync.ts:772-774`          |
| Channel report windows      | UTC date strings                  | n/a                                       | `channel-report.ts:568-570`        |
| Analytics week selector     | UTC                               | **Monday to Sunday**, complete weeks only | `admin-analytics-range.ts:164-178` |
| Booked-call metrics         | **America/New_York**              | n/a                                       | `booked-metrics.ts:39`             |

Two consequences worth stating plainly:

- **The Close month boundary is UTC.** A call booked late on the last day of a month in Pacific time
  falls into the following month here. The MTD dashboard uses Pacific. The two months are not the
  same period.
- **Our two week definitions disagree with each other.** The Close week view runs Friday to Thursday;
  the analytics week selector runs Monday to Sunday. The MTD dashboard and the weekly scorecard use
  Monday to Sunday. Any week-on-week comparison must name which week it means.

Boundary inclusiveness:

- Close mirror: inclusive at both ends, `.gte(from).lte(today)` on the booked date
  (`close-mtd-funnel-data.ts:51-52`).
- Channel spine reads: inclusive at both ends, `.gte("day", startDay).lte("day", endDay)`
  (`channel-report.ts:350-351`).
- Site lead reads: half-open, `>= start 00:00:00Z` and `< (end + 1 day) 00:00:00Z`
  (`channel-report.ts:308, 316-320`).
- Custom ranges: inclusive of both days, width capped at 1,096 days
  (`admin-analytics-range.ts:41, 122`).
- Setter credit: half-open on the end, `[since, until)` (`call-credit-data.ts:187`).

Cron schedules are UTC, as Vercel runs them. `close-lead-funnel-sync` runs hourly at minute 5;
`channel-sync` runs at 11:10 UTC, which is 4:10 Pacific (`vercel.json:45-62`).

---

## 2. Source fields

### Close mirror — the `close_lead_funnel` table

One row per Close lead that has a first sales call booked date. Refreshed hourly, upserted in place,
so **every value is current as of the last sync, not a snapshot of the reporting period**
(`close-lead-funnel-sync.ts:171-252`). After a complete walk the sync prunes rows it did not touch, so
a lead whose booked date is cleared in Close disappears from our reporting
(`close-lead-funnel-sync.ts:237-247`).

| Column                         | Close source                                                           | Ref                                     |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------- |
| `funnel`                       | custom field "Funnel Name DEAL (Opp)"                                  | `close-lead-funnel-sync.ts:29`          |
| `first_sales_call_booked_date` | custom field "First Sales Call Booked Date", truncated to `YYYY-MM-DD` | `close-lead-funnel-sync.ts:28, 146-150` |
| `first_call_show_up`           | custom field "First Call Show Up (Opp)"                                | `close-lead-funnel-sync.ts:30`          |
| `qualified`                    | custom field "Qualified (Opp)"                                         | `close-lead-funnel-sync.ts:35`          |
| `status_label`                 | lead `status_label`                                                    | `close-lead-funnel-sync.ts:161`         |
| `setter_name`                  | custom field "Reactivation - Setter Name"                              | `close-lead-funnel-sync.ts:31`          |
| `lead_source`                  | custom field "Lead Source - Company"                                   | `close-lead-funnel-sync.ts:32`          |
| `sales_team_lane`              | custom field "Sales Team Lane"                                         | `close-lead-funnel-sync.ts:34`          |
| `call_disposition`             | custom field "Todays Call Disposition (Opp)"                           | `close-lead-funnel-sync.ts:36`          |

Won deals and revenue come from Close opportunities directly, not from this table
(`close-wins.ts`), filtered to `status_type = won` and dated by `date_won`.

**Custom fields are resolved by label at run time**, matched case-insensitively against Close's own
schema, not pinned to `cf_` ids (`close-lead-funnel-sync.ts:21-26, 51-77`). Only the booked-date and
funnel fields are required; a missing one throws rather than silently reading null. The practical
consequence: **renaming a custom field in Close breaks this sync**, where an id-pinned integration
would survive. The `cf_` ids that do appear in this repository belong to the outbound lead-writing
integration (`src/lib/close/sync.ts`), not to reporting.

**What this table cannot answer.** It holds only leads that booked. It cannot be used for lead volume
or acquisition questions. It carries no meeting-owner field, so any filter on who owns a meeting
cannot be applied on our side at all (`close-mtd-funnel.ts:19-23`).

### Channel report — the `channel_daily` spine

One row per day per marketing link. The unique key is six columns:
`day, source, medium, campaign, content, destination` (`channel-daily.ts:82`). `channel` is
deliberately **not** in the key, because it is derived from source and medium and including it would
fork a link's history whenever a channel is renamed (`channel-daily.ts:76-82`).

Dimension normalisation (`channel-daily.ts:84-104`): `source` and `medium` are lower-cased and
trimmed; `campaign` and `content` are trimmed but keep their case; a blank value becomes the literal
`(not set)`.

Columns read by the channel report (`channel-report.ts:348-349`):
`spend, impressions, reach, clicks, visits, leads, booked, showed, won, revenue`.

**`thankyou_visits` is carried by the type and by `METRIC_KEYS` but is not in that select list**
(`channel-report-rollup.ts:25, 46`). On this read path it is therefore always unobserved, and any
rate built on it is always null. This is a defect, not a definition.

---

## 3. Global exclusions and inclusion rules

### The SteelTrap rule — Close mirror only

A first call is excluded when the lead's **current** status or funnel matches
(`close-week-view.ts:31-33, 105-110`):

| Kind   | Literal values matched                 |
| ------ | -------------------------------------- |
| Status | `canceled (by lead)`, `outside the us` |
| Funnel | `ltf - quiz funnel`                    |

Status matching strips a leading emoji and spacing first, so `🔻 Canceled (by Lead)` matches
(`close-week-view.ts:98-103`). The exclusion is applied **before** the booked, showed and qualified
split, so an excluded call appears in no stage (`close-mtd-funnel.ts:118-121`). The count of excluded
calls is printed on screen rather than absorbed.

Note the difference in treatment of the quiz funnel: **we drop it entirely**; the MTD dashboard keeps
its row and removes it only from totals. See section 13.

### Reactivation Scrapers — a split, not an exclusion

`Reactivation Scrapers` is the outbound and reactivation funnel. It is **kept** in every total and
**split out** for the marketing line (`close-mtd-funnel.ts:36, 96-98, 122-128`):

```
marketing.X = totals.X - scrapers.X          for booked, showed, qualified
scrapers    = kept where funnel == "Reactivation Scrapers"   (trimmed, case-insensitive)
```

It is split so that ad spend is never divided by calls the ads did not buy. The marketing line is the
figure the weekly scorecard row "Marketing Meetings Booked" counts.

### Owner exclusions — we have none

This repository excludes no closer, setter or meeting owner from any count. The MTD dashboard excludes
five closer user ids from won and revenue, and its live surface additionally drops four meeting
owners. We cannot reproduce either: there is no owner field in our mirror. This is the largest single
reason our Won and Booked will not equal theirs. See section 13.

### Internal and test leads

Excluded from the site-lead collapse and from the Calendly source count unless the "include internal"
toggle is on (`channel-report.ts:438-442`).

### Lane 2 funnels — booked-call metrics

`Reactivation Scrapers`, `Reactivation Email`, `Sales Reactivation` are counted separately from
marketing in the booked-calls view (`booked-calls.ts:36-40, 152-154`), and excluded from the "new
calls booked" daily metric (`booked-metrics.ts:318, 477`).

---

## 4. Acquisition: leads, contacts, total captured

`applyLeadDefinition` (`channel-report.ts:238-294`) splits one acquired population in two. This is
the most misread area of the dashboard.

| Term               | Definition                                                                         | Typical week |
| ------------------ | ---------------------------------------------------------------------------------- | ------------ |
| **Lead**           | A form fill on vendingpreneurs.com itself                                          | ~110         |
| **Contact**        | Everyone else acquired: webinar registration, off-site form fill, ManyChat contact | ~1,200       |
| **Total captured** | leads + contacts                                                                   | ~1,300       |

The rule, per stored row (`channel-report.ts:265-272`):

- If the row's key is one a site lead was ever recorded under, it is a **leads** row and its value is
  the counted site-lead figure (zero if only repeats or test emails landed there).
- Otherwise the row's stored `leads` value is reassigned wholesale to **contacts**, and `leads` is
  nulled.

Keys with counted leads but no stored row are appended as synthetic rows with every other metric
explicitly null, so leads acquired today count before the nightly connector writes them
(`channel-report.ts:274-293`).

**Total captured is not a stored metric.** It exists only inside the Book % and cost-per-signup
formulas (`channel-report-rollup.ts:345-348, 456-459`).

**A silent degradation to know about.** If the `channel_daily` read fails, the whole tab reports
disconnected. But if only the `lead_submissions` read fails, `fetchFacts` returns the stored rows
**unmodified** — the leads-versus-contacts split never runs, `contacts` is undefined everywhere, and
Book % then denominates on the raw `channel_daily.leads` column (`channel-report.ts:212`). Nothing on
screen says so.

---

## 5. Bookings

### Close mirror

```
Booked = count of rows whose first_sales_call_booked_date falls in the window,
         after the SteelTrap exclusion
```

One row per lead by table construction, so this is **deduplicated per lead**
(`close-mtd-funnel.ts:100-106`). The date is the day the call is **scheduled for**, which is what the
Close field holds — not the day it was booked (`booked-metrics.ts:20-23`).

### Channel spine

`booked` on the spine is a stored column with more than one writer, and the writers date a booking
differently. This matters more than any formula in this document.

| Writer                      | Source value written       | Day credited to                 | Ref                          |
| --------------------------- | -------------------------- | ------------------------------- | ---------------------------- |
| `leads`, lead-matched       | the lead's `utm_source`    | the day the **lead arrived**    | `channel-sync.ts:703`        |
| `leads`, Calendly unmatched | the booking's `utm_source` | the day the call was **booked** | `channel-sync.ts:558`        |
| `manychat-ingest`           | `manychat`                 | the event timestamp             | `manychat-ingest.ts:128-129` |
| `webinar-ingest`            | —                          | **writes no bookings**          | `webinar-ingest.ts:203`      |

`webinar-ingest` writes `booked: null` deliberately: a webinar's bookings already reach the spine
through its tagged Calendly links, and writing the sheet's count as well double-counted every one of
them. On 2026-09-08 the spine read 74 where Calendly and the webinar record both said about 34. In-room
CTA bookings therefore arrive under the source `internal-webinar` from the Calendly path, not from the
webinar connector.

> `REPORTING.md` §3 currently cites `channel-confidence.ts:94` as the list of booking writers. That
> constant is `METRIC_CONNECTORS`, which only names a likely cause when a metric is missing, and it
> still lists `webinar-ingest` under `booked`. It is not a writer list. Correct that before relying on it.

**A lead's booking is credited to the day the lead arrived, not the day the call was booked.** Close
dates the same booking on the booking day. Bookings mature one to six days after arrival, so the two
systems displace 30 to 41 bookings across a week boundary and will never agree week-on-week at the
edges. This is a definitional difference, not a defect.

Cancellations never reach the spine: only `status = 'booked'` rows are read (`channel-sync.ts:545`),
and a cancellation rewrites the row's status (`calendly-bookings.ts:120`). Deduplication is by
Calendly `invitee_uri` (`calendly-bookings.ts:37`), so webhook retries cannot double-count.

**Stale rows.** The spine is append-and-update; nothing deletes. When a booking's assigned day moves,
`clearMovedBookingRows` blanks the outcome on the old day, but only for links the run actually wrote
and only when a newer day for the same link exists in the same run (`channel-sync.ts:625-672`). A row
the sync stops generating keeps its last value forever. This was worth 90 phantom bookings before it
was fixed on 2026-09-21; 88 cleared, 2 remain on links with no surviving booking anywhere.

### Booked-call metrics — seven named measures

These are distinct on purpose, because "booked" has at least two useful meanings
(`booked-metrics.ts:94-181`). Bookings are dated by Calendly's own
`raw_payload -> payload -> created_at`, never by our mirror row's `created_at`, which would pile a
backfill onto the import date (`booked-metrics.ts:18-23`).

| Measure                  | Counts                                    | Dated by      | Dedupe       |
| ------------------------ | ----------------------------------------- | ------------- | ------------ |
| New calls booked         | event class `new`, Lane 2 excluded        | booked-on     | per booking  |
| All bookings made        | every class, cancellations included       | booked-on     | per booking  |
| Follow-ups booked        | class `follow_up`                         | booked-on     | per booking  |
| Reschedules booked       | class `reschedule`                        | booked-on     | per booking  |
| Booked today for today   | booked day equals scheduled day           | both          | per booking  |
| First calls on calendar  | Close first sales call dated that day     | scheduled day | **per lead** |
| All meetings on calendar | non-cancelled bookings scheduled that day | scheduled day | per booking  |

Event class comes from a reviewed mapping keyed by Calendly event-type URI, falling back to the event
name, not from a regex (`calendly-event-class.ts:110-138`). An unreviewed event type **fails closed**:
it is counted in no class and reported as unreviewed coverage rather than guessed as new
(`calendly-event-class.ts:137`, `booked-metrics.ts:380-381`).

**A broken read returns null, never zero** (`booked-metrics.ts:230-231`). Every measure carries a
coverage object naming what it could not see: unreviewed event types, undatable bookings, bookings
with no Close match, and Lane 2 rows dropped.

---

## 6. Showed, qualified and won

### Close mirror

```
Showed    = booked rows where isYes(first_call_show_up)
Qualified = booked rows where isYes(qualified)
Won       = Close opportunities with status_type = won and date_won in the window
```

`isYes` accepts exactly one value: the string `yes`, trimmed and lower-cased
(`close-week-view.ts:93-95`). Nothing else is truthy — not `true`, not `1`, not `y`. The MTD dashboard
accepts `true`, `yes` and `1`. Ours is the stricter of the two.

**The stages do not nest, and we do not pretend they do.** 16 of September's 444 booked calls are
logged qualified with no show logged (`close-mtd-funnel.ts:11-15`). A qualified-over-showed rate would
read above 100% for some funnels. **Every rate is over booked**, and the 16 are disclosed on screen.
This is a logging habit, not a data defect: a rep can record the outcome without ticking the show. It
must not be "fixed" by inferring a show from a qualification.

**Won is a different population.** It is selected by the day the deal was won, so a deal won this
month can belong to a call booked two months ago (`close-mtd-funnel.ts:16-18`). It is never expressed
as a share of the booked cohort. It is an opportunity count, not a lead count, so two won
opportunities on one lead count twice.

### Channel spine

`showed` and `won` are stored columns, summed as-is. There is **no qualified metric in the channel
pipeline at all** — qualification exists only in the Close mirror. A show is the rep's logged
`First Call Show Up = yes` in Close; it is never derived as booked minus no-show.

---

## 7. Rate metrics

Every rate in the channel pipeline goes through `pct` (`channel-report-rollup.ts:181-185`): null if
either side is null or the denominator is zero, otherwise one decimal place. **A zero denominator
produces null, never zero.** Likewise, a metric total is the sum of observed values and is null when
nothing in the group was observed, which is not the same as zero
(`channel-report-rollup.ts:162-171`).

### Book %

```
seen        = rows where leads is observed, or contacts is observed, or source == "internal-webinar"
Book %      = Σ booked over seen  ÷  Σ (leads ?? 0) + (contacts ?? 0) over seen  × 100
```

(`channel-report-rollup.ts:338-350`.) Bookings are denominated on **everyone the channel acquired**,
leads plus contacts — not on site leads alone. Denominating on leads alone published the Webinar
channel at 300%, because 4,037 registrations sat in contacts and were skipped.

Rows carrying a booking but no audience of their own are handled by source
(`channel-report-rollup.ts:296-313`):

- `source == "internal-webinar"` — the night-of and replay CTAs, shown inside the room. Everyone
  clicking had already registered and is already counted in contacts, so these bookings join the
  numerator and add nothing to the denominator. This is an exact literal source match and the only
  special-cased source string in the pipeline.
- Everything else with no audience is a genuine direct link. It is disclosed separately as
  `directBooked` and **never folded into the rate** (`channel-report-rollup.ts:440-451`).

A regression bar is pinned in the tests: channels with no contacts must not move when this logic
changes — YouTube 62.5%, Google Ads 49.5%, Chatbot 53.7%, Newsletter 50%
(`channel-report-rollup.test.ts:139-144`).

### Other channel rates

| Rate               | Formula                                            | Coverage guard | Ref                                |
| ------------------ | -------------------------------------------------- | -------------- | ---------------------------------- |
| Lead % (opt-in)    | leads ÷ visits, over rows where visits is observed | yes            | `channel-report-rollup.ts:363-368` |
| Win %              | won ÷ booked, over rows where booked is observed   | no             | `channel-report-rollup.ts:438`     |
| Funnel stage share | stage ÷ last non-null prior stage                  | no             | `channel-report-rollup.ts:376-410` |

`ofObservedPct` (`channel-report-rollup.ts:272-291`) denominates on every row where the denominator is
observed, counting a denominator row with no numerator as zero. With the coverage guard on, the result
is nulled when the numerator visible on those rows is less than half the numerator across all rows —
a defence against key mismatch quietly understating a rate.

**Show rate is not a per-channel field.** It exists only as a funnel-stage share, where the stage
order is visits → leads → booked → showed → won (`channel-report-rollup.ts:90-96`). Because the
previous stage is the last one with a non-null total, a stage's denominator can silently fall back
further up the funnel when an intermediate total is unobserved.

### Close mirror rates

```
Showed % of booked    = round(showed / booked × 1000) / 10      one decimal, null at zero
Qualified % of booked = round(qualified / booked × 1000) / 10   one decimal, null at zero
Won                   = no rate over booked; always null
```

(`close-mtd-funnel.ts:92-94, 167, 176, 185`.) Note that the panel's per-funnel table rounds to a whole
percent and shows an em dash at a zero denominator (`CloseMtdFunnelPanel.tsx:35-37`), so the same
underlying rate appears at two precisions on one screen.

---

## 8. Revenue

```
Deal revenue = Close opportunity value ÷ 100        (Close stores cents)
Revenue      = Σ deal revenue over won deals in the window
```

(`close-wins.ts:201`, `close-mtd-funnel.ts:133`.) A null value in Close stays null rather than being
coerced, and such a deal still counts as a win while adding nothing to revenue. Those deals are
counted and named on screen as unvalued (`close-mtd-funnel.ts:190`). Money is displayed as whole
dollars with thousands separators.

Won deals and revenue by channel come from Close opportunities, never from our own lead records.

There is no ARR, MRR or package-tier calculation anywhere in this repository. No average deal size or
revenue-per-close is computed in the channel pipeline.

---

## 9. Attribution and grouping

A row is attributed by its own stored dimensions; there is no first-touch or last-touch model applied
at read time. Grouping is a flat equality group on one of `channel`, `campaign`, `content` or
`destination` (`channel-report-rollup.ts:118, 494-498`).

**Channel labels are recomputed live, with one exception.** For every row whose stored channel is not
in `PROGRAM_CHANNELS` (which contains only `Webinar`), the channel is re-derived from source and
medium at read time and overwritten if it differs (`channel-report-rollup.ts:66-76`). A mapping change
therefore re-labels historical rows without a backfill. Rows already tagged `Webinar` are frozen.

Rows where only visits or reach were observed are moved out of the main table into a tail section
rather than presented as channels with no outcomes (`channel-report-rollup.ts:464-470, 514-516`).

Cost metrics (`channel-report-rollup.ts:428-459`):

```
Cost per lead   = spend ÷ leads          null when either is absent, and when leads is 0
Cost per booked = spend ÷ booked         same
Cost per signup = spend ÷ (leads + contacts)   only when contacts > leads
```

A spend total of exactly zero is treated as unobserved rather than free. Cost per signup is computed
only in the shape where registrations outnumber site leads, which is the webinar case.

Read caps, which matter when judging whether a figure could have been truncated: pages of 1,000 rows
up to 200,000 rows per query (`channel-report.ts:54-56`), upserts in chunks of 500
(`channel-daily.ts:74`).

---

## 10. Cost of acquisition

Per route (`cac-report.ts:169-205`):

```
proration factor = clamp(days elapsed ÷ days in month, 0, 1)
prorated fixed   = fixed monthly cost × proration factor
spend used       = observed spend when the source is "auto", else the typed figure
total cost       = prorated fixed + spend used        (null only when both are absent)
closes used      = Close's count when present, else the typed count
CAC              = total cost ÷ closes used           null when closes is absent or zero
```

Rounded to two decimals. Observed spend is summed from `channel_daily` over the **full calendar
month**, not the elapsed window (`cac-report-data.ts:140-155`), while the fixed cost is prorated to
days elapsed. Those two bases differ, by design, but a mid-month CAC mixes them.

Where a typed spend and an observed spend both exist and differ by more than a dollar, the gap is
reported rather than resolved (`cac-report.ts:192-197`). Blended CAC sums route costs and route closes
and divides once (`cac-report.ts:231-245`); routes with closes but no cost model are counted and named
separately, because they pull the blended figure down (`cac-report.ts:250-254`).

Status bands against the March benchmark (`cac-report.ts:137-150`): beating at or below it, moderate
up to 20% above, critical beyond 20%.

---

## 11. Booking targets

Targets are booking counts by channel, grown from a measured baseline rather than seeded by hand
(`channel-targets.ts:29-39, 140`):

```
target(month) = round(August 2026 baseline × 1.1 ^ months after August)
```

The basis is Close first sales calls by funnel name, first call per lead only, cancellations included,
follow-ups excluded — the same definition the Q4 plan's June-to-August baseline used. Targets apply
from September 2026 onward; earlier months show actuals only. A multi-month target is the sum of each
month's target, not a compounded range. September totals 619; Q4 totals 2,226.

**The plan workbook's own August baseline is not used.** Its Q4 Growth Plan tab states 821 booked
calls for August; the same workbook's Booked Call Summary says 523, and 523 is what Close returns
exactly (`channel-targets.ts:12-24`). The 821 reconciles with no measure we can reproduce, so the
three competing totals derived from it are rendered as superseded rather than encoded.

Funnels outside the plan roll up to "Other funnels" and carry no goal. Leads with no funnel in Close
are counted but never allocated to a channel (`channel-targets.ts:106-115`).

---

## 12. Setter credit

Credit for a booking resolves through a strict precedence chain, strongest evidence first
(`call-credit.ts:78-176`). The first rule that matches wins.

| #   | Rule                                                     | Basis      | Evidence quality                         |
| --- | -------------------------------------------------------- | ---------- | ---------------------------------------- |
| 1   | Calendly's `invitee_scheduled_by`                        | `calendly` | Calendly recorded who booked it          |
| 2   | `utm_source == "setter"`, name parsed from `utm_content` | `tag`      | The link says whose it was               |
| 3   | `utm_source == "chatbot"`                                | chatbot    | Booked from the calendar inside the chat |
| 4   | Any other `utm_source`                                   | channel    | Self-booked from a tagged link           |
| 5   | Close's setter field                                     | `close`    | A note a human typed, not a record       |
| 6   | Last setter to call or text before the booking           | `touch`    | Inferred, shown with the time gap        |
| 7   | Nothing matched                                          | untagged   | Shown as "No tag"                        |

Rule 2 requires the parsed name to match `^[a-z][a-z-]{1,40}$`; a tag that fails falls to "No tag"
rather than inventing a name (`call-credit.ts:194`).

Rules 5 and 6 are the weak ones and are labelled as such on screen. Close's setter field is a note
rather than a system record, which is why it sits below every tagged source. Use
`close_lead_funnel.setter_name` for it, not `lead_submissions.booked_by_setter`.

Roles come from the Lane 2 roster as of 2026-09-11, classifying each rep as setter, scraper or
setter-closer (`call-credit.ts:304-319`). This repository computes no closer credit and no won-deal
attribution by person.

---

## 13. Comparison with the MTD dashboard and SteelTrap

### A question that has to be settled first

The MTD dashboard's `METRICS.md` states its Booked is the count of eligible **leads** whose First
Sales Call Booked Date falls in the window, and says explicitly that it is not built from meeting
records or activity titles. `REPORTING.md` §5 in this repository describes that dashboard's Booked as
meeting activities, title-filtered and deduplicated per lead, with four meeting owners dropped.

Those two descriptions cannot both be true of the same pipeline. Either they describe different
surfaces, or one characterisation is out of date. **This changes the answer materially**: if Booked is
the lead field, our mirror reads the same field on the same grain and the two should reconcile closely,
and the meeting-owner filter we have been treating as unreproducible does not apply. Settling this is
the single highest-value question in this document.

The comparison below uses the MTD dashboard's own document as the statement of its definitions, and
the SteelTrap column as that document describes it.

| Metric               | This repository                                             | MTD dashboard                                                  | SteelTrap                                              | Same?                                             |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Day boundary         | UTC                                                         | Pacific                                                        | Pacific; New York for won outcomes                     | **Different**                                     |
| Week                 | Friday–Thursday (Close view), Monday–Sunday (analytics)     | Monday–Sunday                                                  | Inclusive of displayed range                           | **Different**                                     |
| Booked               | Lead's First Sales Call Booked Date in window, one per lead | Same field, one per lead                                       | First native meeting creation, deduplicated per person | Same as MTD; different from SteelTrap             |
| Showed               | `First Call Show Up (Opp)` equals `yes` exactly             | Same field; accepts `true`, `yes`, `1`                         | Native meeting held or completed                       | Near-identical to MTD; different from SteelTrap   |
| Qualified            | `Qualified (Opp)` truthy, **over booked**                   | Same field, **over booked**                                    | Canonical boolean, **over showed**                     | Same as MTD; different denominator from SteelTrap |
| Won                  | Close opportunities by `date_won`, opportunity grain        | Same, opportunity grain                                        | Normalised outcome by outcome date                     | Same grain and cohort                             |
| Revenue              | Close `value` ÷ 100, nulls preserved                        | Close `value` ÷ 100 via a `$`/comma-stripping parser           | Upstream-normalised dollars                            | Same formula                                      |
| Excluded statuses    | Canceled (by Lead), Outside the US, by label                | Same two, by status id                                         | Broad case-insensitive label match                     | Same intent                                       |
| Quiz funnel          | **Dropped entirely**                                        | Row kept, excluded from totals only                            | Dropped at the Leads producer; kept elsewhere          | **Different**                                     |
| Closer exclusions    | **None**                                                    | Five closer user ids dropped from won and revenue              | None in the CRM funnel projection                      | **Different**                                     |
| Meeting-owner filter | **Impossible** — no such field                              | Four owners dropped on the live surface, per `REPORTING.md` §5 | n/a                                                    | **Cannot be matched**                             |
| Scrapers             | Kept in totals, split out for the marketing line            | Not a separate concept                                         | Not a separate concept                                 | Ours only                                         |
| Leads / acquisition  | Site form fills and total captured, from our own spine      | Close leads by `date_created`, known funnels only              | Canonical submission projection                        | **Not comparable**                                |
| Book %               | booked ÷ (leads + contacts) per channel                     | booked ÷ leads created, exported only                          | booked ÷ leads created, shown                          | Different population                              |
| Targets              | August 2026 baseline, +10% compounding per month            | Static per-funnel goals in `goals.json`                        | Per-business-day seed × business days                  | **Different**                                     |
| Projection           | None                                                        | Calendar-day month projection                                  | None on that table                                     | Theirs only                                       |
| ARR / MRR            | None                                                        | Package-tier rules                                             | None                                                   | Theirs only                                       |
| Revenue per close    | None in the channel pipeline                                | Revenue ÷ closed won                                           | Not calculated                                         | Theirs only                                       |
| Sales cycle          | None                                                        | `date_won` − booked date, arithmetic mean                      | Won − lead created, median                             | All three differ                                  |
| Setter credit        | Six-rule precedence chain                                   | Not calculated                                                 | Separate UTM facts                                     | Ours only                                         |

### Why our numbers will not equal theirs, in order of size

1. **The closer exclusions.** They drop five closer user ids from won and revenue. We drop none. Any
   won or revenue comparison is wrong until one side adopts the other's list.
2. **The day boundary.** Our Close month and week boundaries are UTC; theirs are Pacific. Activity in
   the last seven hours of a Pacific day lands in our next day, and at a month edge, in our next month.
3. **The week definition.** Our Close week view runs Friday to Thursday. Theirs runs Monday to Sunday,
   as does our own analytics selector. Comparing a five-day window to a seven-day one manufactured a
   25-booking gap that did not exist.
4. **The quiz funnel.** We drop it from the funnel entirely; they keep its row and exclude it from
   totals. Totals agree in intent; any per-funnel comparison does not.
5. **Acquisition is not comparable at all.** Their Leads column read 365 for a week with 809 webinar
   registrants, and we do not mirror it on purpose. Our two acquisition figures — 109 site form fills
   and 1,308 total captured for the same week — answer a different question and differ from each other
   by more than ten times.
6. **Channel Book % is a different rate.** Ours denominates on everyone a channel acquired; theirs on
   Close leads created. Neither is wrong; they are not the same number.

### What is already known to agree

On matched windows our Close mirror tracks their Booked within three bookings, about 2%. The marketing
line matched exactly in the week of 8 September: their total of 172 minus 83 scrapers is 89, and ours
computed independently is 89.

---

## 14. Reconciliation order

When two numbers disagree, work in this order. Most disputes end at step two.

1. **Confirm both windows.** Same start, same end, same length, and name the time zone each side used.
   Check the week convention before anything else.
2. **Confirm the population.** Is the metric lead-based (booked, showed, qualified) or
   opportunity-based (won, revenue)? Is the figure per lead, per booking, or per opportunity?
3. **Confirm which "booked" is meant.** The Close mirror counts a lead's scheduled first call. The
   channel spine counts bookings attributable to a marketing channel and dates a lead's booking to the
   lead's arrival day. The booked-call metrics count Calendly bookings on the day they were made. The
   spine is roughly half the company total because the sales team's own rebooking has no marketing
   channel.
4. **Apply the exclusions explicitly**, in the order the code applies them: SteelTrap rule first, then
   the scraper split. Ask whether the other side excludes owners.
5. **Check staleness before trusting a historical figure.** The spine never deletes. Compare
   `synced_at` against the latest run for that day. Bookings are checked nightly by
   `spine-orphaned-bookings`; spend, visits, clicks, leads and won have no such check, so the same
   defect there is still silent.
6. **Recalculate every total from its own counts**, never by averaging row percentages.
7. **Respect null.** A null is "we could not observe this"; a zero is "we observed none". A rate with a
   zero denominator is null here, not zero.
8. **Measure through `fetchFacts`**, never off raw `channel_daily` rows. Skipping it bypasses the
   leads-versus-contacts split and reports Webinar Book % as 0.7% where the page says 300%.

---

## 15. Known defects in this repository

Listed so the other team does not have to discover them, and so neither side treats them as
definitions.

| Defect                                                    | Consequence                                                                | Ref                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `thankyou_visits` is not in the channel select list       | Always unobserved on this path; any rate on it is null                     | `channel-report.ts:348-349`                             |
| A failed `lead_submissions` read degrades silently        | Book % denominates on raw stored leads with no notice                      | `channel-report.ts:212`                                 |
| `METRIC_CONNECTORS` lists `webinar-ingest` under `booked` | Names a connector that writes no bookings when a gap is explained          | `channel-confidence.ts:94`                              |
| Two week conventions inside one app                       | Friday–Thursday on the Close tab, Monday–Sunday in the selector            | `close-week-view.ts:75`, `admin-analytics-range.ts:168` |
| Three day boundaries across pipelines                     | UTC, UTC, and New York                                                     | see section 1                                           |
| Two roundings of one rate on one screen                   | One decimal at stage level, whole percent in the table below it            | `close-mtd-funnel.ts:92`, `CloseMtdFunnelPanel.tsx:35`  |
| Mid-month CAC mixes bases                                 | Fixed cost prorated to days elapsed, spend summed over the full month      | `cac-report.ts:175`, `cac-report-data.ts:144`           |
| Two bookings on broken links                              | Real bookings, wrong attribution; the nightly check ignores them by design | `REPORTING.md` §3                                       |
| Close custom fields resolved by label                     | Renaming a field in Close breaks the hourly sync                           | `close-lead-funnel-sync.ts:51-77`                       |

---

Last verified against the code on 2026-09-21. Every line reference in this document was read at that
commit. When a formula changes, this file changes with it in the same commit, or it becomes the most
expensive kind of documentation.
