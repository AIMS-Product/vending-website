# S1: webinar registration on the site, parallel run (2026-09-30)

Tier 1 (new write path into GHL that sends SMS/email and creates Zoom + Close records). safe-feature-slice.

## Slice

`/masterclass` form -> server action -> GHL contact upsert + tag `site-webinar-registration` -> GHL workflow
`1. New Lead > Form Submission Webinar` runs every step it runs for the GHL form. GHL pages stay live and untouched.

## Verified live before code (2026-09-30)

- Workflow tag step adds BOTH `webinar-registrant` and the event tag (`webinar-oct6`, hand-edited weekly). Update field
  `Webinar Registration = Yes`. Create/UPDATE opportunity in "Webinar Oct 6" / New Registrant, source = Contact.Source.
  Settings: re-entry ON, multiple opportunities ON, stop on response OFF. Published.
- Form custom fields (ids): utm_source `A5lto46gWq5GCV1gFAYV`, utm_medium `sTA2DpdX2T0hYmCK5QOK`,
  utm_campaign `aqH0AWiKM2AbQZ1jFkwK`, utm_term `q6085pCxGavjosxtkW8h`, utm_content `054iAlrjFHhqMU3AGUdn`.
- SMS consent: 100 of the last 100 GHL form submissions carry it, so the GHL form requires it. The site now does too.
- GHL changes made (additive, pre-approved): tag `site-webinar-registration` (`RoiCvwx3lqBrugsSg4YP`); second trigger
  "Contact tag added includes site-webinar-registration" named "Site registration (vendingpreneurs.com)". Form trigger kept.

## Invariants

1. No lost registration: the visitor sees the confirmation page only after GHL accepted the contact AND the trigger tag.
   Any failure returns a user-safe error on the form (fail closed) and a server log with status, no PII.
2. No duplicate contact: GHL upsert (location dedupe) is the only create.
3. Every downstream step fires: the trigger tag is removed first if the contact already carries it (a previous week),
   because "tag added" never fires for a tag already present.
4. Idempotent per email + event: a contact already carrying this event's tag (from the GHL form or an earlier site
   submit) is not re-triggered; they go straight to the confirmation page. Event tag = GHL `Webinar Date n Time`
   month/day with the roller's month keys (`webinar-oct6`, `webinar-sept8`).
5. UTMs preserved: non-empty UTMs write the same 5 custom fields the GHL form writes. Empty ones are not sent, so a
   returning contact's earlier attribution is not blanked.
6. Contact source is set only on create ("Site Masterclass Registration"), so a returning lead keeps its original source.
   Opportunity source then reads it, which splits site vs GHL registrations in the pipeline.

## Known limits (accepted, logged)

- Double submit racing the workflow (before it adds the event tag) can trigger twice -> a second confirmation SMS.
  The button disables while pending; GHL's own form has the same exposure.
- fbclid/fbp/fbc are not on the API contact, so GHL's Meta CAPI event from a site registration matches on
  email + phone only. Watch Events Manager match quality at the gate.
- Queue fallback (forward.ts pattern) skipped: a queued-but-unsent registration would show "you're in" with no SMS or
  Zoom link. Sync + fail closed is honest. Add a queue if logs show GHL errors at real volume.

## Env

`GHL_WRITE_TOKEN` (GHL PIT with contacts write) in Vercel Preview first, Production only at the swap.

## Gate (needs Adam's test contact)

Within 5 min of one preview registration: GHL contact (tags `site-webinar-registration`, `webinar-registrant`,
event tag; UTMs; zoom_url), Zoom registrant, Close lead in cohort, Sheet row, Meta Events Manager CompleteRegistration,
SMS + email received, vp-webinars dashboard counts it. Then remove the test registrant.

## Review pass (parallel-review, 2026-09-30): 13 confirmed, all applied except two LOW

- Existing contacts are never rewritten: an existing contact only gains name/phone fields it is missing (stops a
  stranger swapping a lead's phone for their own). Upsert must land on the looked-up contact id or it fails closed.
  Trade-off: a returning lead with a NEW phone keeps the old one in GHL.
- Trigger tag is always removed then added (does not trust the upsert's tag list).
- US/Canada phones only, E.164; names letters only (merged into the SMS); formula prefixes stripped for the Sheet.
- Limiter fails CLOSED (this path texts people), plus a per-phone budget (3/24h) on top of IP+email (5/10 min).
- 8s timeout per GHL call, one retry after 500 ms, a 2xx is never resent.
- SMS consent written to GHL "SMS Consent Marketing" (`7UnFD4LUSeTwW9QlVrqh`) with a timestamp.
- Not done (LOW): first name in the confirmation URL (pre-existing); Turnstile/BotID (honeypot + limits for now).
