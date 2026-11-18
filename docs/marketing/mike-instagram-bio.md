# Mike Instagram bio hub

Approved by Jess October 18, 2026; simplified to booking only November 17, 2026.
Public path: `/mike`.

Keep the approved Editorial profile, portrait and free-market-analysis booking
card. Booking is the page's only link. Jess requested removal of the YouTube
preview, newsletter, member-stories link and other exits to focus the page on
booking. No site header, cohort banner, site footer, popup or chat launcher on
this page.

Copy and destinations are in `src/lib/content/mike-bio.ts`; styles are scoped to
the route. The VP logo is the official vector supplied through Drive, preserved
from the approved prototype. Geist is self-hosted, with its OFL license.

## Tracking

Source `instagram`, medium `organic`, campaign `mh-ig-bio` throughout. Register
the entry and booking tuples with `/admin/links` when managing the bio link.
The three retired outbound tuples below remain documented for historical
reporting; they are no longer rendered on `/mike`:

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
tracker emits the landing view and the booking click. The prior outbound
`MikeBioLink` clicks remain historical data; no tracking records are removed.
Entry/session tags stay separate from each destination's placement tags.

The existing form, Calendly and Close pipeline remains the source of confirmed
bookings. A click is never recorded as a booking. Historical YouTube and
newsletter exits recorded clicks, not confirmed video watching or newsletter
subscriptions across domains.
The session identifies a browser; named leads are known only after capture.

## Release verification

Check `/mike` on the Vercel preview before merging. Verify route HTTP 200,
mobile/desktop layout, exactly one booking action (the booking card; the accessible
skip-to-content link is allowed), no video, newsletter,
stories or other exits, no navigation/popup/chat distractions, the booking
link's five tags, session/source handoff, and that the existing booking form
renders. Do not submit a fake lead or booking. GitHub CI covers typecheck, lint and tests; Vercel supplies
the production build. Confirm the live `/api/health` SHA after merge.
