# Channels tab: honest funnel, bucketed sources, data confidence

2026-09-11. Adam: "these charts are abysmal", "why does all of this have
nothing", "need a much better confidence check". Scope: the Channels tab only.

## Root causes seen in prod

- The funnel divides unrelated populations: Seen is Metricool impressions from
  three social brands, Clicked is Bitly (no token, 47), Visited is GA4 for the
  whole site. 0% and 24,006% follow.
- `resolveChannel` title-cases any unknown source, and GA4 sends referrer
  hostnames as source, so 40+ rows are hostnames with visits only.
- Rates cross populations: Webinar leads come from GHL registrations (3,763)
  while visits are GA4 on our site (450). Booked includes Calendly bookings
  with no lead form (leads null), so booked ÷ leads passes 100%.

## Slices

1. `channel.ts`: hostnames map to channels (youtube.com → YouTube,
   l.instagram.com → Instagram, t.co → X, bing/yahoo/duckduckgo → Organic
   search, chatgpt.com/claude.ai → AI assistants, webmail → Email, own domains
   and calendly.com → Website, `(data not available)` → Unknown, anything else
   with a dot → Referral). `google` becomes "Organic search". `ghl_form` →
   "GHL forms".
2. Rollup: rates only over rows where both sides were observed (same key, so
   same population). Direct bookings counted separately. Funnel splits into
   upstream reach (Seen, Clicked, with channel coverage) and the on-site funnel
   (Visited → Lead → Booked → Showed → Won) with paired shares. Rows with no
   leads, booked or spend move to a collapsed tail.
3. `buildConfidence`: coverage matrix (channel × metric, expected vs
   observed, cause from connector health) plus reconciliation against sources:
   lead_submissions vs spine leads (excluding Webinar and GHL forms),
   webinar_events registrations vs Webinar leads, ga4_page_views sessions vs
   spine visits, direct bookings, unattributed visit share.
4. `ChannelsPanels.tsx`: render the above. Native `<details>` for the tail.

Invariants: null is not observed, never zero. No rate crosses populations.
Every check prints both numbers it compared.
