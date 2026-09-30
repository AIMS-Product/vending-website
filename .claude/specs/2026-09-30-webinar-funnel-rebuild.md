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

## Not wired yet (preview only)

The form validates and redirects but writes nothing. Options, in order of preference:

1. **Same GHL form**: post to GHL's form-submit endpoint from the visitor's browser (what GHL's own pages do). Everything downstream is identical. Endpoint is undocumented and Cloudflare-protected; a headless probe was blocked. Needs one real test registration (Adam's go: it creates a Zoom registrant, Close lead and sends the SMS/email).
2. **GHL API upsert + tag**, and Ivan adds that tag as a second trigger on the registration workflow and the zap. Documented, but needs the site a write token and Ivan's change.

Question for Ivan: what does the registration zap trigger on (GHL form submission, workflow webhook, or tag)? That answer picks 1 or 2.

## Tracking

- Opt-in rate: vp-webinars dashboard now reads Meta landing-page views; per-page split works once an ad set points here (ads carry `landingPage`).
- Registrations per page: GHL form submissions carry `eventData.page.url`; `ghl_form_source_split.py` and the site's ghl-sync already read them.

## Open

- The shared `ApplyDisclaimer` mentions a "$5,000-$60,000 claim" not on this page; needs Kody-approved wording for the webinar pages.
- Intake form (3 questions) and replay pages not rebuilt.
- Split test: one Meta ad set -> `/masterclass`, control keeps the rest; judge on opt-in rate, then show rate.
