# Google Wallet webinar pass (slice 1: save + join + reminders)

Google approved Vendingpreneurs for Wallet publishing on 2026-10-23 (issuer 3388000000023209914,
console BCR2DN6DZKLN7YLE). Plan of record: ~/vp-wallet-pass/.claude/specs/2026-10-21-wallet-pass-plan.md.
Launch target: after the Oct 27 webinar, alongside Apple Wallet (Apple dev account still pending).

## What ships

- `/masterclass-confirmed` shows Google's official Add to Google Wallet badge to a registrant who
  just registered (signed `mc_session`) and is in the rollout: `GOOGLE_WALLET_ROLLOUT_PERCENT`
  (deterministic by contact id, default 0) or `?wallet=1` for team tests.
- `/masterclass/wallet/<token>` (token = the personal calendar token, HMAC, no PII) builds the signed
  save JWT server-side and 302s to pay.google.com. One pass class per room
  (`<issuer>.vp_masterclass_<UTC yyyymmddhhmm>`), one object per contact per room.
- The pass's Join button is `/masterclass/join/<token>`: reads the contact's personal Zoom link from
  GHL at tap time (same `readJoinUrl` as the calendar route, own rate-limit `masterclass_join`),
  falls back to `/masterclass-confirmed`. Never registers anyone in Zoom.
- Cron `/api/admin/wallet-reminders/run` every 5 min: T-24h, T-1h, live. Lists the room's class
  objects from Google (no table of holders), `addMessage` TEXT_AND_NOTIFY once per pass by message id.

## Invariants

- No name, email or phone on the pass or in the JWT. Only the opaque GHL contact id in object ids.
- A tampered, expired or earlier-room token never reaches GHL or Google; it lands on /masterclass.
- A reminder is sent to each pass at most once (message id), however often the cron runs.
- Button hidden and cron idle unless both GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SA_KEY are set.

## Verified live 2026-10-23 (throwaway room 2026-10-24T01:30Z, contact `walletlivetest1`)

Class inserted and auto-approved; object inserted; `sendDueReminders` sent 1, re-run 0 (already
sent); object shows `reminder_1h:textAndNotify`. Found two bugs only the live API shows: Google
returns `state: "active"` lowercase, and a token assertion must use the real clock.

## Next slices

2. Attended -> "Watch the replay"; no-show -> roll to next Tuesday + tap-time GHL re-registration
   (`utm_source=wallet-pass`); expire after 3 misses. Needs Zoom attendance from vp-webinars.
3. Apple Wallet (.pkpass + APNs updates) once Apple activates the account.
4. Show-rate comparison: pass holders = object ids in the room class vs Zoom attendance.
