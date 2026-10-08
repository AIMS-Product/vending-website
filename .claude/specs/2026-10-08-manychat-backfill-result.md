# ManyChat connect + backfill: result (2026-10-08)

Branch `feat/manychat-accounts` (worktree ~/vending-website-manychat). Follows
`2026-10-08-manychat-connect-and-backfill-handoff.md`.

## Done

- Keys `MANYCHAT_API_KEY_MIKE` / `MANYCHAT_API_KEY_ANTHONY` in .env.local + Vercel Prod/Preview.
  Mike's equals the old `MANYCHAT_API_KEY` (kept as fallback).
- Ingest is account-aware: payload `account` (default `mike`), per-account key, spine row per
  account (`content` = account). Migration `20261008120000_manychat_events_account.sql`.
- Probe `scripts/manychat-probe.mjs`; backfill `scripts/manychat-backfill.mjs` (dry run default,
  `--apply` writes); evidence rules `scripts/lib/manychat-match.mjs` (+ test).
- Tables for the write: migration `20261008121000_manychat_backfill.sql` (NOT applied).

## Facts learned (all verified against live data 2026-10-08)

- ManyChat IG contacts carry no email/phone (0/679). Close has no IG-handle field; Close notes
  hold no chat URLs or IG profile links (1,589 leads scanned). Name search is exact-name only.
- `findByCustomField` caps at 100 rows, no paging: cannot enumerate a keyword.
- Setter booking links put the ManyChat subscriber id in `utm_campaign` (Calendly + site forms;
  utm_term carries OptinKeyword via `{{cuf_13174144}}`). One Will Graves id was reused for 12
  invitees: ids used by >1 email are discarded (`personalLinkIds`).
- Anthony's page: 6 tags, no custom fields, 1 "Anthony IG" lead in Close -> no history to backfill.
- ManyChat lookups ~3.5s each, never 429'd.

## Match rules (RULES_VERSION 1)

Confirmed = 2+ of {link, name, handle, tag}, subscribed on/before booked date, and one of
link / tag / active (last interaction >= booked - 21d). Answer key = leads with a personal link
id, re-matched with the link hidden: 54 right, 0 wrong, 10 left unconfirmed.
Name alone was wrong 4 in 10; name+handle without activity wrong 2 in 2.

## Dry run (1,590 leads)

- Instagram funnel 1,544: confirmed 453 (29.3%), single-signal 145, ambiguous 8, conflict 2, none 936.
- Booked via DM link but Close credits another funnel (39 Reactivation Scrapers): 46, confirmed 37.
- Link-only (41, 38 active near booking): kept single; identity unproven (forwarded links seen).

## Open

1. Adam: approve PR -> merge -> apply both migrations -> `--apply`.
2. Slice 3 live feed (flow External Requests with `account`, or re-poll known ids).
3. Slice 4 dashboard: confirmed-only DM funnel per account + keyword, joined to Close wins by
   lead id; show coverage (confirmed / Instagram-funnel leads) beside it.
4. Slice 5: nightly audit check + freshness bar.
