# Handoff: marketing optimization, 2026-10-11 evening

## Done (merged, live)

- #141 /build-your-vending-business -> /process. #142/#143 Google Ads CEO view, live ad previews, range clipped to Jul 27. #144 trust-bar feed mapping. #145 click a channel in the flow chart. #146 CEO briefing + collapsed source notes. #147 quiz last-question submit scrolls into view ("See my next step"). #148 no chat greeting over the page on phones. #150 AGENTS: landing-page figures are CEO-approved. #151 Metricool fails the run when Meta returns nothing for the window.
- Ads account 18:20 PT (logged in google-ads-changelog.ts): 2 RSAs re-pointed to /contact, Brand > Vending Locations paused, 2 keywords paused, 14 exact keywords added, 39 negatives. Sync script restored byte-identical (verified on fresh load).

## Open

1. **Meta spend missing since Oct 8**: Metricool's Meta import stopped (API returns 0 campaigns Oct 8-11; ads are spending). Someone with Meta ad-account access reconnects in Metricool (brand 6626386 > Connections), then backfill: POST /api/admin/metricool-sync/run with `days=10` (CRON_SECRET).
2. **Verify** keyword/negative changes landed (ad changes verified): GAQL read or tomorrow's keyword_daily / ads UI change history with today in range. Note: Ads Scripts Preview/Run save the editor; the page self-reloads after load, wait ~20s before clicking.
3. **PR #152 (channel value card) not merged**: it uses Close funnel attribution, which credits only 56 of ~150 Google bookings to Google (43% filed under Lane 2), so Google reads $738/booked and $0.57 per $1. Needs Google credited by gclid (lead_submissions paid_attribution) before it is fair; Webinar spend also understated until Meta backfill.
4. **CEO card bug**: `ceoActions` flags "Cut Competitive Conquest" although the campaign is removed (not in campaign_status). Only flag campaigns present and ENABLED in health when health is set up.
5. Decisions with Adam: W2 +$1,000/mo ~Oct 18; BOOKINGS_ONLY at 30 (9 now); revert PR #140 wording? (asked, no answer); Liana: Purchase campaign doubled cost/registration, test pausing "Hammer Them Tuesdays"; Sales Ops: Close credit for Google.
6. Reports: .claude/specs/2026-10-11-google-ads-audit.md, 2026-10-11-meta-channel-mix-audit.md.
