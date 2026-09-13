# Q4 channel goals: baseline, projections, and the dashboard that tracks them

Adam's ask (2026-09-13), verbatim intent: take the Q4 channel goals sheet, set it
against the real Q3 baseline, build projections, and scope how the dashboard
tracks progress against weekly/monthly targets — per channel, per team, per
person. He is tying his own performance reporting to this, so it has to be both
accurate and presentable to a room.

Scope named by him: leads · channels · webinars · socials · ads · setters ·
closers.

## BLOCKER — the goals sheet

`Q4 Channel Goals.xlsx` was attached as a thumbnail image, not a file. Its
contents are unknown. Not on ~/Desktop or ~/Downloads. Get the real file (drag
the xlsx in, save to ~/Desktop, paste as text, or share the Sheet link) before
any projection work. Do NOT guess targets.

## What already exists to build on (all verified 2026-09-12/13)

- **Channel spine** — `src/lib/services/channel-report.ts` (`getChannelsTab`):
  visits, leads, booked, won, spend per channel, with prior-period comparison
  and connector health. This is the projection substrate.
- **KPI framework** — `src/lib/services/kpi-report.ts` + `kpi-report-data.ts`.
  Four sections incl. Lane 2 setter rows.
- **Booking credit** — `src/lib/services/call-credit.ts` +
  `call-credit-data.ts`, surfaced at `/admin/bookings`. One answer per booked
  call with its evidence.
- **Overview** — `/admin` rebuilt 2026-09-13 (`76535b2`) as a channel command
  center: headline movement, leads-by-channel with brand logos, gaining/slipping,
  connector health.
- **Brand marks** — `src/components/admin/ChannelLogo.tsx`. Colour for
  YouTube/Instagram/LinkedIn/Meta/Google Ads/Trustpilot/TikTok/Braze, neutral
  glyph for owned surfaces, aligned dot fallback.

## Known measurement limits — a projection that ignores these will be wrong

1. **Show rate is an upper bound, not a measurement.** Only ~37% of booked calls
   carry any Close outcome; the rest are counted as shown. Any Q4 show-rate
   target needs the outcome-logging gap closed first or the number is fiction.
   See memory: `vending-website-show-rate-is-assumed`.
2. **Revenue has two legitimate bases** — cohort ($296K) vs Close cash ($503K).
   Pick ONE per goal line and label it. See memory:
   `vending-website-revenue-basis-trap`.
3. **Booking credit certainty, last 30 days of 509 calls:** 41% Calendly
   recorded who booked it, 27% the link carried a tag, 33% untagged self-booked
   (inferred from Close activity). Any per-setter Q4 target must state which
   tier it counts.
4. **9 Calendly user ids book calls but never host**, so 38 calls in 30 days
   show an id instead of a name. Resolvable via Calendly `GET /users/{uuid}`;
   token is in Vercel production, not available locally.
5. **Setter vs closer is derivable from behaviour**, no guessing needed:
   books-but-rarely-hosts = setter (Connor 47/5, Charlie 35/7), hosts-heavily =
   closer (Luke 20/116, Joseph 11/95, Christian 8/91, Shreya 6/71, Robin 1/29).
   Ariella (33/48) and William Nowak (17/19) genuinely do both.
6. **GHL forms carry 801 leads with no channel attribution** on the KPI tab —
   the single biggest attribution hole for goal tracking.
7. Overview thresholds are provisional: 5 leads to count as a mover, 10 leads to
   print a booking rate. Tune once Q4 targets are known.

## Suggested slices (order matters)

1. Read the goals sheet; restate each target with its measurement basis and
   whether we can currently measure it at all. Flag targets that are unmeasurable
   today — that list is the real work.
2. Q3 actuals per channel from the spine, same basis as each Q4 target.
3. Gap analysis: required weekly run-rate per channel to hit Q4 from Q3.
4. Goal-tracking surface: target vs pace vs actual, per channel, weekly and
   monthly, on the existing Overview/KPI pattern. Pace is the point — "ahead or
   behind, by how much", not just a total.
5. Team views: setters, closers, webinars, socials, ads — each reading the same
   credit rule already shipped, so no two pages disagree.
6. Close the outcome-logging gap (1) and the GHL attribution hole (6), or every
   number above stays an upper bound.

## Repo rules for whoever picks this up

Verify with `npx tsc --noEmit`, `./node_modules/.bin/vitest run` (NOT `npx
vitest`), `./node_modules/.bin/next build`, eslint, prettier. Push to `main`
deploys to www.vendingpreneurs.com within ~1 min. No emojis, no dark theme,
plain English in UI, a dash means not observed and never zero. Never touch
Calendly URLs.
