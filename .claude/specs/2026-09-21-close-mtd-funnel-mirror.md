# Slice — mirror the MTD funnel with our own Close mirror (2026-09-21)

Shipped with the spine-orphan audit check in the same session. Read `REPORTING.md`
§4 (Qualified), §5 (Our mirror of it) and §9 before quoting anything below.

## What it is

`/admin/analytics?tab=close` now opens with the month so far — booked → showed →
qualified → closed-won — computed only from `close_lead_funnel`, our hourly copy of
Close. Every stage prints the population it counted and the Close field it read.
Nothing is quoted from Stephen's sheet.

Files:

- `src/lib/services/close-mtd-funnel.ts` — pure builder, no IO.
- `src/lib/services/close-mtd-funnel-data.ts` — its own read of the month window.
- `src/components/admin/CloseMtdFunnelPanel.tsx` — the screen.
- `src/lib/services/close-week-view.ts` — `isYes` and `labelOf` exported so the two
  views cannot drift on what "Yes" means.

## Measured September 1-21, 2026 (live, at build time)

| Stage      | Count | Rate            |
| ---------- | ----- | --------------- |
| Booked     | 444   | —               |
| Showed     | 250   | 56.3% of booked |
| Qualified  | 188   | 42.3% of booked |
| Closed-won | 40    | —               |

Revenue $281,609, 0 unvalued. 32 excluded by the SteelTrap rule.
Marketing 235 · `Reactivation Scrapers` 209.

## Three decisions this slice made, all visible on screen

1. **The stages do not nest.** 16 of the 444 are logged `Qualified (Opp)` = Yes with
   no `First Call Show Up (Opp)` = Yes. A qualified-over-showed rate would read above
   100% for some funnels. Every rate is over **booked**, and the 16 are disclosed.
2. **Won is a different population.** It is pulled by `date_won`, so a deal won this
   month can belong to a call booked two months ago. It is never expressed as a share
   of the booked cohort.
3. **Stephen's rule is not reproduced.** `close_lead_funnel` has no meeting-owner
   field, so his exclusion of four meeting owners — one of them Spencer Reynolds, an
   active VP setter — cannot be applied here at all. The screen says so in words
   instead of implying agreement.

## What would close the gap

Close meeting-activity ingestion. Our Close client has no meeting-activity listing
(`src/lib/close/client.ts` lists only per-lead activities), so it is real new
ingestion and a slice of its own. Until someone runs a matched-window comparison
against his Booked, the September stages are **unverified** in `REPORTING.md` §9 —
not wrong, not confirmed.

## Not done

- No browser walkthrough: `/admin` is behind a Supabase login. Verified instead by
  rendering the real component with production data and asserting no error strings,
  plus a production `next build`.
- No comparison column holding Stephen's live number; there is no feed for it, and a
  hardcoded one would rot. The definitional differences are rendered instead.
