# The link standard

**The link is the attribution.** Every outbound link, on every channel, carries
these five UTMs. Build links at `/admin/links`; never by hand. The lists below
are closed: the builder refuses anything else, and the dashboard shows an
off-list value as `unknown` rather than guessing.

Machine copy: `src/lib/analytics/link-standard.ts`. Change both together.

## Make a link in 30 seconds

1. Open `/admin/links`.
2. Click the kind of link under **Start from** (Mike podcast, Anthony podcast,
   YouTube description, Instagram bio, Newsletter, GHL text, Webinar invite).
   Everything that never changes fills itself.
3. Type the **content**: the one show, post, video or send this link lives in.
   Spaces and capitals are cleaned up for you.
4. **Save link**, then copy it. Its row below shows leads, booked calls,
   calendar bookings and clicks as they arrive.

One link per place it is posted. A new podcast, video or send gets a new
content value, never a reused link, or its results blend with the old one.
To spin up the next one, press **Use as template** on any row and change the
content.

Not sure a link is tracked? Paste it into the search box on `/admin/links`.
It says whether the link is in the registry, what it brought in, and what is
wrong with it if it is off the standard.

### Podcasts

| Who     | Page                  | Link                                                                                                        |
| ------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Mike    | `/booking-t5-socials` | `?utm_source=podcast&utm_medium=organic&utm_campaign=mh-podcast&utm_content=<show-name>&utm_term=book-call` |
| Anthony | `/booking-ak-t5`      | `?utm_source=podcast&utm_medium=organic&utm_campaign=ak-podcast&utm_content=<show-name>&utm_term=book-call` |

Every podcast lead lands in the **Podcast** channel. Per show, per host, it is
the row for that link.

## Funnels

Every link names the funnel it feeds, picked from Close's "Funnel Name" choices
(`src/lib/analytics/funnel-names.ts`). The builder requires one. On any row,
**Edit** sets the funnel, owner and note; the five tags never change once a
link is out. The row says where its funnel came from: the old sheet, Close
records, the source (YouTube, Google Ads), or the person who set it. **No
funnel** lists the rows still to decide; **Totals by funnel** is the sheet's old
funnel view, with results.

The funnel belongs to the link, never to its source. Dom's scripts and anyone
else read the same rows from `GET /api/reporting/links`
(`docs/marketing/reporting-api.md`).

The UTM master sheet ("MARKETING SALES OPS") was imported on 2026-10-14 by
`scripts/import-utm-sheet.py` (rows marked `backfill:sheet`). Make new links
here, not in the sheet.

## Imported links

Links that were already out before the builder (YouTube description links,
webinar short links, setter and ad links seen on leads and Calendly bookings)
were imported on 2026-10-13 by `scripts/backfill-marketing-links.mjs`. They
show with an **Imported** chip and their real results, but they never count
toward link coverage: they were not built on the standard. Most are off the
standard (`mike-ig`, `internal-webinar`, no `utm_term`); the row says what is
wrong, and **Use as template** pre-fills a corrected version. Re-run the script
(dry run first) to pick up new tagged links seen since.

## The five fields

| Field          | Meaning                                          | Values                                                                                                                                                                   |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utm_source`   | The platform the link is posted on               | `youtube` `instagram` `tiktok` `facebook` `linkedin` `x` `meta_ads` `google_ads` `ghl_sms` `ghl_email` `webinar` `chatbot` `newsletter` `podcast` `referral` `affiliate` |
| `utm_medium`   | How it reached them                              | `paid` `organic` `owned` `email` `sms` `chat`                                                                                                                            |
| `utm_campaign` | The thing being promoted, as a lowercase slug    | `webinar-sept15` `lead-magnet-90-day` `vsl`                                                                                                                              |
| `utm_content`  | The specific post, ad, video or message          | Metricool post id, Meta ad id, YouTube video id, GHL workflow step                                                                                                       |
| `utm_term`     | **The destination.** Where the link sends people | `book-call` `lead-magnet` `webinar-register` `apply` `content` `none`                                                                                                    |

`utm_term` is repurposed on purpose. Nothing here runs keyword ads that use it,
and "where were we sending them" needs a home on the link itself. Destination is
never inferred from the landing page.

## Destinations

| `utm_term`         | Use it when the link goes to                       |
| ------------------ | -------------------------------------------------- |
| `book-call`        | The calendar, directly                             |
| `lead-magnet`      | A download or free resource that captures an email |
| `webinar-register` | Webinar registration                               |
| `apply`            | The application form                               |
| `content`          | An article, video or page to read, with no capture |
| `none`             | Nothing in particular (a profile link, a mention)  |

## Sources and channels

`meta_ads` and `facebook` are different sources on purpose: one has spend, the
other does not. Same for `google_ads` and organic Google. `ghl_sms` and
`ghl_email` are the GoHighLevel sends; `newsletter` is the broadcast list.

## Examples

```
https://www.vendingpreneurs.com/webinar?utm_source=instagram&utm_medium=organic&utm_campaign=webinar-sept15&utm_content=reel-0911&utm_term=webinar-register
https://www.vendingpreneurs.com/book?utm_source=ghl_sms&utm_medium=sms&utm_campaign=no-show-followup&utm_content=step-2&utm_term=book-call
https://www.vendingpreneurs.com/start?utm_source=youtube&utm_medium=organic&utm_campaign=vsl&utm_content=dQw4w9WgXcQ&utm_term=lead-magnet
```

## Short links

The builder can mint a Bitly short link for any URL it produces. The short
link's click counts join back to the long link through `bitly_link_clicks`, so
use the Bitly version wherever a long URL is awkward (bios, SMS, video
descriptions). Build the long link first; never shorten a link that lacks the
five fields.

## What the dashboard does with a bad link

A post or click whose link is missing any of the five fields, or carries a
value off these lists, appears on the **Fix these links** panel on
`/admin/analytics` → Channels, with the exact problem spelled out. It is still
counted, under `unknown`, so nothing disappears; it just cannot be credited to
a destination until the link is fixed.
