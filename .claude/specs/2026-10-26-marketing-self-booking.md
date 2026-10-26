# Marketing self-booking: own our booked calls

Approved by Adam 2026-10-26 (all four pieces). Branch `feat/marketing-self-booking`, worktree
`~/vending-website-selfbook`. Nothing reaches `main` without Adam's OK.

## Why

Marketing booked ~200 first calls Oct 1-26 (422 MTD minus 221 Reactivation Scrapers). Setters convert
what we capture; marketing does not own the booking. Goal: more calls the lead books on OUR calendar,
measured daily, without touching GHL flows or setter process.

## Baselines (prod, 2026-10-26)

- Site leads Oct 1-26: 459, of which 238 have a Close first-call date (52%), 221 never booked.
- Chatbot Oct: 90 chats, 62 abandoned, 23 emails captured, 8 booked.
- Calendly webhook healthy: 1,037 rows Oct (759 created / 241 canceled), UTMs on ~30%.
- Meta: site pixel fires PageView only. `META_ACCESS_TOKEN` returns "API access blocked".
- Google: offline "CRM - Booked Call" upload exists (`google-ads-booked-calls` cron +
  `scripts/google-ads/upload-booked-calls.js`). Browser tag `NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO`
  is NOT set in prod.
- GHL already runs webinar ADNB/RDNA email+SMS+voice and Meta CompleteRegistration/Purchase. Out of scope:
  never duplicate webinar follow-up.

## Slices

1. **Ad conversions.** Meta Lead (form submit) + Schedule (booking) via pixel and Conversions API with a
   shared `event_id` for dedupe; hashed email/phone only. Verify the Google offline upload lands and the
   action is Primary; set the browser send_to if the label is available.
2. **Self-booked scoreboard.** Daily count of `new`-class Calendly bookings (calendly-event-types.json)
   made by the lead through a marketing surface (site embed, chat calendar, follow-up email link).
   Excludes setter-booked (Lane 2 titles / setter UTM) and Reactivation Scrapers. Shown on Call Forecast.
3. **No-booking follow-up (Tier-1: outbound to leads, safe-feature-slice).** Site lead with consent and
   no booking 10 min after submit: email with booking link prefilled + 3 open times; day 1 and day 3
   nudges; stop on any booking (Calendly webhook or Close date), unsubscribe, or bounce. Sender:
   `LEAD_NOTIFICATION_FROM`. Kill switch env `SELF_BOOK_FOLLOWUP_ENABLED`. Never SMS (setter channel).
4. **Chatbot rebuild.** Question-led page openers, in-chat plan built from answers + member wins,
   email-for-plan, calendar at engagement, abandoned-chat recovery email. Track msgs/chat, email rate,
   booking rate before/after.

## Guardrails

- No GHL writes. No SMS. No PII in git or logs. Kill switch per outbound feature.
- Each slice: tests + typecheck + build green, preview verified, Adam approves merge.
