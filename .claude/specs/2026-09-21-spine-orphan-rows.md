# Slice — clear orphaned booking rows from the spine

2026-09-21. Root cause is found and written into `REPORTING.md` §3. This spec
is the fix. **Not implemented.** Tier-1: `booked` feeds Book %, which feeds ad
spend decisions. Needs Adam's review before it is written.

## The defect

`channel_daily.booked` has two writers in `channel-sync.ts`:

1. site leads carrying `call_booked_at` — credited to the day the lead arrived;
2. Calendly bookings with no `lead_submission_id` — credited to the booking day.

`syncLeads` zeroes stale rows before rewriting, but the clearing set is built
only from keys that **current site leads** map to (`channel-sync.ts:510-528`).
Calendly-derived rows carry `leads=null` and match no lead key, so they are
never cleared. When a booking's assigned day changes — a date-bucketing fix, a
re-import, a corrected `booked_at` — the sync writes it at the new day and
leaves the row at the old day untouched forever. The rollup sums both.

Measured 2026-09-21: **34 orphan rows, 90 phantom bookings** since June.

| Week | Spine reads | Orphaned | Corrected |
| ---- | ----------- | -------- | --------- |
| W8   | 164         | 56       | 108       |
| W9   | 112         | 0        | 112       |
| W10  | 128         | 32       | 96        |
| W11  | 81          | 1        | 80        |

## The fix

In `syncLeads`, after building `rows` + `bookingRows`, read the existing
`channel_daily` rows in the window and zero the **outcome** columns on every
key this run did not regenerate.

```
keysWritten = new Set(all rows this run generates, by the six link dimensions)
stale       = existing window rows whose key is not in keysWritten
              and which carry a non-null booked/showed/won/revenue
→ upsert stale with booked: 0, showed: 0, won: 0, revenue: null
```

## What must NOT be touched, and why

- **`leads` must be left alone.** The stored `leads` column is written by four
  connectors (site leads, webinar registrations, GHL, ManyChat — `REPORTING.md`
  §2). Zeroing `leads` on a key `syncLeads` did not generate would wipe
  registrations and contacts. Only `booked`, `showed`, `won`, `revenue` are
  owned by this connector.
- **`spend`, `impressions`, `clicks`, `visits`** belong to metricool-ads, GA4
  and Bitly. Out of scope; leave them.
- Confirm before writing that `webinar-ingest.ts` still writes `booked: null`
  and no longer writes `showed`/`won`. It did as of 09716df. If that changed,
  this fix would fight it.

## Risks

- **It writes zeros across history.** Run it against a copy, or dry-run it
  counting affected rows, before letting it near prod. A bug here silently
  deletes real bookings — the opposite failure of the one being fixed, and
  harder to notice because numbers going down looks like bad news, not a bug.
- The sync's window bounds which rows can be cleared. An orphan outside the
  window stays. A one-off deeper pass (`days=400`) is needed after the fix
  ships to clear the existing 34.
- This fires only when a booking's day changes, which is why W9 has zero
  orphans and W8 has 56. It is not continuously firing — it is a trap that
  springs on the next re-import.

## Test

- Unit: a run that no longer generates a previously written key zeroes its
  `booked` and leaves `leads` untouched.
- Unit: a key the run does generate keeps its fresh value.
- Unit: a row whose only non-null column is `spend` is not rewritten.
- Regression against live data: W8 164 → 108, W10 128 → 96, W11 81 → 80.

## Cheaper alternative, if the sweep is judged too risky

Add an orphan check to `data-audit-checks.ts` that counts booked rows whose
`synced_at` predates the latest run covering that day, and surface it on the
confidence panel. That makes the defect visible without writing anything. It
does not fix the numbers.
