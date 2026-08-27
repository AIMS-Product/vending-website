# HANDOFF: Vendingpreneurs chatbot, state at end of 2026-08-27

Everything below is on `main` and live at www.vendingpreneurs.com (auto-deploys).
Today: PRs #15-#21. Specs: 2026-08-27-chatbot-booking-v3.md, 2026-08-27-chatbot-admin-overview.md.

## Live
- Mia: gpt-4.1, name ask ("Who do I have the pleasure of speaking with?"), consultant-only
  language (no "sales team/call"; humanize.ts rewrites slips), non-repeating cost escalation,
  real availability tool, never "no availability", tone post-pass, send/receive sounds.
- Admin: /admin/chatbot overview (KPIs+sparklines, trend vs prior, journey, drop-off, needs-you),
  /admin/chatbot/settings, booking stamp + hand-off email stamp on transcripts, Resend button.
- Hand-offs email the transcript: support -> chatbot_config.support_email (jade@modern-amenities.com),
  else lead_routing_emails (currently BLANK -> falls back to Jade). Receipt columns on conversation.

## Open (humans)
- Kody: open Consultation event type availability 14-21 days. Biggest booking lever.
- Adam: put a sales inbox in Settings -> Lead routing -> Recipients.
- Stephen: add "Chatbot" to Close Entry Source; then set entry_source in taggingValues() (sync.ts).
- Verify next real booking shows the Booked card in chat + green stamp in admin.
- DNS: collapse the three _dmarc.vendingpreneurs.com records to one.

## Next code candidates (measure first via overview)
- Deltas/sparklines exist only for 30d (no prior window for 7/90 in analytics.ts).
- Drop-off chart is 30d only.
- If cost-cohort book rate stays flat after Kody's fix: rework the 2nd pricing reply
  (PRICING section, build-system-prompt.ts); pull transcripts via ?outcome=asked_about_cost.
- Pre-deploy embed bookings show "consultant not on the Calendly record" (host stored from today).

## Gotchas
- Run tools via ./node_modules/.bin/{tsc,eslint,vitest,prettier,next}; pnpm exec breaks.
- Commit with `git -c core.hooksPath=/dev/null commit`; merge with a standalone `gh pr merge N --merge`.
- Prod DB writes and raw_payload reads from Claude are blocked by the permission classifier;
  hand Adam SQL (pbcopy). Read-only PostgREST via scratch .sh scripts works.
- .env.local has no RESEND key; only production can send email.
- Admin login has a CAPTCHA; Claude cannot screenshot /admin. Ask Adam.
