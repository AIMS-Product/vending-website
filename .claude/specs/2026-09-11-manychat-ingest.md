# ManyChat → Instagram DM channel, plus prod data corrections

2026-09-11. Adam: ManyChat API key arrived; "keep cleaning / checking /
validating our data omnichannel".

## Findings that shaped this

- ManyChat public API (page "Mike Hoffmann", 67 tags, 65 flows) is per-contact:
  `findByName` / `findByCustomField` cap at 100 rows, date fields are not
  searchable, email and phone matching hit 0 of 54 recent leads. No reporting
  endpoint. So: push from flows, enrich by id.
- Spine rows with source `ghl` carry medium `pearl`, campaign `book-call`:
  Pearl (the DM setter in the ManyChat tags) sending booking links. Adam:
  "GHL = Go High Level". Mapped to Instagram DM. Assumption flagged.
- `ltf` = Low ticket funnel (Adam), paid, campaign `wescale`.
- This morning's `(not set)` → Unknown re-labelling moved 70 leads, 42 booked
  and 849 visits (30d) out of Website. `(not set)` is the spine's own blank
  marker, and blank means "landed on our site untagged" = Website by the
  standing rule. Reverted; only `(data not available)` stays Unknown.

## Slice

1. `manychat_events` (contact × stage × day, RLS service-role only) +
   `POST /api/admin/manychat-ingest` (bearer `MANYCHAT_INGEST_SECRET`, mirrors
   webinar-ingest) + `ingestManychatEvent`: validate, enrich via
   `subscriber/getInfo` when `MANYCHAT_API_KEY` is set, upsert, recompute the
   day's Instagram DM spine row (leads = new_lead, clicks = booking_link_sent,
   booked = call_booked, won = closed; distinct contacts).
2. `channel.ts`: `Instagram DM` (`manychat`, `ghl`), `Low ticket funnel`
   (`ltf`), GA4 blanks → Website.
3. Connector registry + coverage expectations for Instagram DM.
4. `docs/marketing/manychat-ingest.md`: the one-line flow edit for Mike.

Invariants: null is not observed; same contact + stage + day counts once;
enrichment failure never drops the event; secrets never logged.

## Owed

- Apply migration `20260911210000_manychat_events` in prod.
- Mike adds the External Request actions (doc above). Until then the row shows
  hollow marks with cause "manychat-ingest: never ran".
- GHL registration-form mapping (Webinar vs GHL forms double count) still open.
