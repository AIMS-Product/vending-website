# UTM builder refresh + registry backfill (2026-10-13)

Ask (Jess, Slack 10-13): one standard way for everyone to make UTM links (MH / AK
podcast links to the booking pages, one per show) and proof they land in reporting.

Found: the builder works. Jess's one link (newsletter/sept14, 09-14) brought 10 leads,
all with the exact five UTMs. She could not tell because `/admin/links` shows no results,
and the registry holds 1 row against 175 lead UTM combos, 517 Calendly combos and 605
YouTube Bitly links.

## Slices

1. `/admin/links` shows results per link: leads (collapseToLeads), booked (lead
   `call_booked_at`), calendar bookings (calendly_bookings on the same 5 UTMs, distinct
   invitees, not canceled), Bitly clicks. Match on the whole 5-tuple, lowercased.
2. Builder refresh: presets (Podcast MH / AK, IG bio, YouTube description, newsletter,
   GHL SMS, webinar), page picker (datalist), auto-slug, "use as template" from any row,
   "check a link" paste box, registry filter + imported badge.
3. Backfill `scripts/backfill-marketing-links.mjs` (dry run default). Origins: leads,
   calendly, YouTube Bitly (expanded by redirect, no token), webinar short links,
   Metricool post links. `created_by = 'backfill:<origin>'`; missing UTM = ''.
   Undo: `delete from marketing_links where created_by like 'backfill:%'`.
4. Coverage keeps counting builder-made links only, so imports cannot fake coverage.

Podcast rule: `utm_source=podcast&utm_medium=organic&utm_campaign=mh-podcast|ak-podcast
&utm_content=<show-slug>&utm_term=book-call`.
