# Mike Instagram bio hub

Approved by Jess October 18, 2026. Public path: `/mike`.

Use the **Editorial** local prototype: market analysis first, one YouTube
preview, newsletter, then a smaller member-stories link at the bottom. The
stories link is 14px, semibold and blue with an arrow, per Jess's final revision.
No site header, cohort banner, site footer, popup or chat launcher on this hub.

Copy and destinations are in `src/lib/content/mike-bio.ts`; styles are scoped to
the route. The VP logo is the official vector supplied through Drive, preserved
from the approved prototype. The thumbnail belongs to the exact linked video;
no player or autoplay is loaded. Geist is self-hosted, with its OFL license.

## Tracking

Source `instagram`, medium `organic`, campaign `mh-ig-bio` throughout. Register
these tuples with `/admin/links` before adding the bio link to Instagram:

| Placement             | Content                      | Destination   |
| --------------------- | ---------------------------- | ------------- |
| `/mike` entry         | `bio-v1`                     | `none`        |
| `/booking-t5-socials` | `bio-v1-book-call`           | `book-call`   |
| YouTube `3HDu68I0_-o` | `bio-v1-video-first-machine` | `content`     |
| `mikehoffmann.co`     | `bio-v1-newsletter`          | `lead-magnet` |
| `/case-studies`       | `bio-v1-case-studies`        | `content`     |

URLs are produced by the site's shared standard-link builder. Internal links
are relative so the existing attribution tracker carries `vp_session_id`, the
hub source path and the booking CTA name into the existing form. The root
tracker emits the landing view and the booking click; `MikeBioLink` emits the
other path clicks through the same first-party endpoint and PostHog mirror.
Entry/session tags stay separate from each destination's placement tags.

The existing form, Calendly and Close pipeline remains the source of confirmed
bookings. A click is never recorded as a booking. YouTube and the newsletter
are external exits: outbound clicks are measured, but their later bookings or
newsletter signups cannot automatically be attributed back across domains.
The session identifies a browser; named leads are known only after capture.

## Release verification

Check `/mike` on the Vercel preview before merging. Verify route HTTP 200,
mobile/desktop layout, one video, the exact full video title, stories below the
newsletter, no navigation/popup/chat distractions, all five tags, booking
session/source handoff, and the existing booking form renders. Do not submit a
fake lead or booking. GitHub CI covers typecheck, lint and tests; Vercel supplies
the production build. Confirm the live `/api/health` SHA after merge.
