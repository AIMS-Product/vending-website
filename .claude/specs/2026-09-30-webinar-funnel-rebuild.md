# Webinar funnel rebuild on the site UI (2026-09-30)

Adam: rebuild the GHL webinar registration funnel on the vendingpreneurs.com UI, run it beside GHL, compare, turn nothing off.

## The funnel today (verified 2026-09-30)

| Step               | Page                                                                                                                                                                                                   | Built on                                                 | Notes                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ad -> registration | `webinar.vendingpreneurs.com/home` (control, ~$87K lifetime spend), `/webinar-registration` (~$26K), `/smart-ai-vending` (~$17K)                                                                       | GHL funnel "General Webinar V2" (`QNaJjWJ8p1VCTXNd7xPt`) | All three submit ONE form: "General 2026 Webinar Registration Form" `TsHS6bjzHkHakUa1ULxu`. Fields: first, last, email, phone, 5 hidden UTM fields, SMS consent. |
| Thank-you          | `/masterclass-thankyou-confirmation`                                                                                                                                                                   | GHL                                                      | Hand-reset countdown, AddEvent ($99) button, 3-question "Webinar Intake Form" `nnne5vuyx5sLjhqneIFg`, 3 member videos.                                           |
| Behind the form    | GHL workflow `1. New Lead > Form Submission Webinar`; Ivan's Zapier zap -> Zoom registrant, Close lead + event tag, Sheet, `zoom_url` write-back; `Webinar Leads to Meta Complete Registration` (CAPI) | GHL + Zapier                                             | Triggers are NOT readable via API.                                                                                                                               |
| Replays            | `/masterclass-replay-{adnb,dna,meta,advisory-team}`                                                                                                                                                    | GHL                                                      | Not rebuilt yet.                                                                                                                                                 |
| In-room booking    | `start-vending.com` -> `vendingpreneurs.com/start` (Calendly embed)                                                                                                                                    | Site                                                     | Already on the site UI.                                                                                                                                          |

Meta pixel `2008180456764704`: GHL pages fire PageView only (the site already does, globally). The registration conversion comes from GHL CAPI, so it follows the GHL form, not the page.

## What was built (branch `feat/webinar-funnel`)

- `/masterclass`: site hero (Anton headline, same claim), form on the first screen, Anthony's numbers live from GHL custom values, 5 operator photo cards, short fit lists. Phone height 5,512px vs GHL 9,548px.
- `/masterclass-confirmed`: live countdown from the GHL date (no weekly reset), free Google/Apple/Outlook calendar links (replaces AddEvent), whitelist step, live-only bonuses, the 3 member videos.
- Date and Anthony stats read from GHL custom values every 5 min, so the weekly rollover moves this page too.
- noindex, unlinked, no site chrome.

## Transfer checklist: what a registration must do (2026-09-30)

Submitting into the GHL form from our page is ruled out: GHL's submit endpoint answered a real-browser probe from
www.vendingpreneurs.com with `429 "No tokens provided" (missing-input-response)`, so it requires a captcha token
only GHL's own pages can mint. The site therefore does each step itself, through documented APIs.

| #   | What happens today on a GHL registration                                       | Done by today                                              | Site replacement                                                                                 | Status                                                         |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | GHL contact created: name, email, phone, SMS consent, 5 UTM fields             | GHL form                                                   | GHL `POST /contacts/upsert` (pattern already live in `src/lib/ghl/forward.ts`, queued + retried) | Needs a GHL write token in the site env                        |
| 2   | Event tag added (`webinar-oct6` etc, from vp-webinars event registry)          | GHL workflow "1. New Lead > Form Submission Webinar"       | Same upsert, `tags: [event tag]`                                                                 | Needs the tag source (read the registry or a GHL custom value) |
| 3   | Zoom registrant created; Zoom sends its confirmation                           | Ivan's Zapier zap                                          | Zoom API, same logic as `vp-webinars/automation/zoom/zoom_registrant_repair.py`                  | Needs `ANTHONY_ZOOM_*` in the site env                         |
| 4   | Personal Zoom join link written to GHL `zoom_url` (every email/SMS merges it)  | Zap + GHL workflow "2. URL Zoom Update"                    | Same script logic, GHL write                                                                     | Same as 3                                                      |
| 5   | Close lead + event cohort (`utm_content` prefix `oct06`, Entry Source Webinar) | Zap / GHL->Close webhook                                   | Site Close client (`CLOSE_API_KEY` present)                                                      | Must match the Zap's fields exactly; read them first           |
| 6   | Google Sheet row                                                               | Zap                                                        | Skip (dashboard reads Zoom/GHL/Close directly)                                                   | Confirm nobody still reads the Sheet                           |
| 7   | Meta "Complete Registration" (ad optimization signal)                          | GHL workflow "Webinar Leads to Meta Complete Registration" | Either the same GHL workflow via a tag trigger, or Meta CAPI from the site                       | UNKNOWN trigger; do not launch without it                      |
| 8   | Confirmation SMS + email, 4 reminder emails, reminder SMS, Anthony voice drop  | GHL workflows                                              | Same workflows, triggered by the tag from step 2                                                 | UNKNOWN trigger; do not launch without it                      |
| 9   | Original ad UTMs kept for reporting                                            | GHL form hidden fields + `eventData`                       | Upsert custom fields + the site's own lead attribution                                           | Buildable now                                                  |

Steps 7 and 8 are the only unknowns, and they are one question: what triggers those GHL workflows (form
submitted, or tag added)? If it is "tag added", the site upsert with the tag fires everything unchanged. If it is
"form submitted", Ivan adds "tag added: <event tag>" as a second trigger (additive, nothing turned off).

### Launch gate (nothing goes to paid traffic until all pass)

1. One test registration from the preview (a real contact Adam names) produces, within 5 minutes: GHL contact
   with tag + UTMs + zoom_url; Zoom registrant; Close lead in the event cohort; confirmation SMS + email received;
   Meta Events Manager shows CompleteRegistration.
2. The vp-webinars dashboard counts that test registrant in the event (then it is removed).
3. Split test: one ad set -> /masterclass. Compare opt-in rate, show rate, booked rate against control.

## Tracking

- Opt-in rate: vp-webinars dashboard now reads Meta landing-page views; per-page split works once an ad set points here (ads carry `landingPage`).
- Registrations per page: GHL form submissions carry `eventData.page.url`; `ghl_form_source_split.py` and the site's ghl-sync already read them.

## Open

- The shared `ApplyDisclaimer` mentions a "$5,000-$60,000 claim" not on this page; needs Kody-approved wording for the webinar pages.
- Intake form (3 questions) and replay pages not rebuilt.
- Split test: one Meta ad set -> `/masterclass`, control keeps the rest; judge on opt-in rate, then show rate.
