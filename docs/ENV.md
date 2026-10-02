# Environment variables

Every runtime variable the code reads, verified on 2026-10-02 against `main` (`faac091`) by
scanning `process.env` in `src/`, `next.config.ts`, `apps/mike-newsletter` and `scripts/`, and
against the zod schema in `src/lib/config.ts`. Values are never listed here. Set them in the
Vercel project (Settings, Environment Variables) for Production and Preview; a change reaches a
deployment only if it was created after the change.

Notes on `.env.example`:

- It does **not** list every variable. 39 runtime variables read by the code are absent from
  it (Calendly, cron, reporting, ingest, GA4, GHL, Metricool, YouTube, Kit, masterclass,
  tracking flags and others); this document is the complete list. `.env.example` is an env
  file and was deliberately left untouched by the change that added this document.
- `NEXT_PUBLIC_GA_ID` appears in `.env.example` but nothing reads it (GA4 loads through Google
  Tag Manager in `src/components/tracking/TrackingScripts.tsx`).

How validation works: `src/lib/config.ts` parses the environment once at import with zod. Only
the three Supabase variables are mandatory; if they are missing or malformed the process logs
`Invalid environment variables` and throws. Every other variable is optional and **fails
closed**: the feature that needs it records a `skipped` run, answers 503, or refuses to act,
as described in the "When unset" column.

Legend: **S** = server only, never exposed to the browser. **P** = `NEXT_PUBLIC_*`, embedded in
the browser bundle at build time.

## 1. Core

| Variable                                            | Scope | Required | Purpose / when unset                                                                       |
| --------------------------------------------------- | ----- | -------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                              | P     | No       | Canonical origin for tags, RSS, auth emails. Defaults to `https://www.vendingpreneurs.com` |
| `NEXT_PUBLIC_SITE_DOMAIN`                           | P     | No       | Host used when building lead-embed links. Defaults to `www.vendingpreneurs.com`            |
| `NEXT_PUBLIC_SUPABASE_URL`                          | P     | **Yes**  | Supabase project URL; app will not start without it                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                     | P     | **Yes**  | Supabase anon key (browser-safe; RLS applies)                                              |
| `SUPABASE_SERVICE_ROLE_KEY`                         | S     | **Yes**  | Bypasses RLS; used by all server writes and scripts. Most sensitive value                  |
| `ADMIN_GUEST_EMAIL`                                 | S     | No       | `app_users` viewer account behind "Continue as guest". Unset hides the button              |
| `ADMIN_DEV_AUTH_BYPASS`                             | S     | No       | `1`/`true`/`yes` skips admin auth, only under `NODE_ENV=development`; ignored elsewhere    |
| `NEXT_PUBLIC_TRACKING_ENABLED`                      | P     | No       | `1` turns on the third-party marketing tags and Vidalytics tracking. Off by default        |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`                 | P     | No       | PostHog token (public by design). Unset: PostHog does not load                             |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`             | S / P | No       | Sentry DSNs. Unset: Sentry does not initialise                                             |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | S     | No       | Source-map upload at build, only when all three are set and `CI` or `VERCEL` is set        |

## 2. Machine-to-machine secrets

| Variable                       | Scope | Used by                                                                      | When unset                                                                     |
| ------------------------------ | ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `CRON_SECRET`                  | S     | All 22 `/api/admin/<job>/run` routes                                         | Routes answer 503; no cron does anything                                       |
| `REPORTING_API_KEY`            | S     | `/api/reporting/kpi`, `/api/reporting/channels`                              | Routes answer 503                                                              |
| `MANYCHAT_INGEST_SECRET`       | S     | `/api/admin/manychat-ingest`                                                 | 503; nothing lands                                                             |
| `WEBINAR_INGEST_SECRET`        | S     | `/api/admin/webinar-ingest` (vp-webinars GitHub Action holds the same value) | 503; nothing lands                                                             |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | S     | `/api/webhooks/calendly` HMAC check                                          | Webhook answers 401 for every request                                          |
| `MASTERCLASS_SESSION_SECRET`   | S     | HMAC key (32+ chars) for the `mc_session` cookie                             | No cookie and no `/masterclass-confirmed` intake form; registration unaffected |

## 3. Lead capture and notifications

| Variable                                                                                                                | Scope | Purpose / when unset                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                                                                                                        | S     | Resend email for lead, chatbot and report mail. Unset: email channels are skipped            |
| `LEAD_NOTIFICATION_TO`                                                                                                  | S     | Recipients of lead alerts                                                                    |
| `LEAD_NOTIFICATION_FROM`                                                                                                | S     | From address (preferred)                                                                     |
| `RESEND_FROM_EMAIL`                                                                                                     | S     | Secondary from address used by chatbot mail, then a hard-coded default                       |
| `LEAD_NOTIFICATION_SUBJECT_PREFIX`                                                                                      | S     | Optional subject prefix                                                                      |
| `SLACK_WEBHOOK_URL`                                                                                                     | S     | Lead, no-book, chatbot and data-audit Slack posts. Unset: no Slack                           |
| `NO_BOOK_ALERT_ENABLED`                                                                                                 | S     | Kill switch for the no-book Slack alert; default on, set `false` to stop                     |
| `DATA_REPORT_TO`                                                                                                        | S     | Comma-separated recipients of the EOD/EOW report; a default recipient is built into the code |
| `MONEY_PAGE_INGEST_URL`, `MONEY_PAGE_SECRET`                                                                            | S     | Money Page funnel webhook. Unset: no forward                                                 |
| `KIT_API_KEY`                                                                                                           | S     | Kit v4 key for newsletter signups. Unset: signups are not pushed to Kit                      |
| `WESCALE_GHL_WEBHOOK_URL` or `WESCALE_GHL_TOKEN` + `WESCALE_GHL_LOCATION_ID` (+ `WESCALE_GHL_FIELD_IDS`, a JSON object) | S     | Forward leads to WeScale's GoHighLevel. All unset: no forward is queued                      |
| `CHATBOT_VALUE_FIRST`                                                                                                   | S     | `on` or `split` enables value-first chatbot behaviour; off otherwise                         |
| `OPENAI_API_KEY`                                                                                                        | S     | Chatbot and SEO page-builder AI. Unset: those features are unavailable                       |
| `OPENAI_SEO_MODEL`                                                                                                      | S     | Defaults to `gpt-5.5`                                                                        |
| `OPENAI_SEO_REASONING_EFFORT`                                                                                           | S     | One of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`; defaults to `medium`             |

## 4. Calendly

| Variable                                                                                                                               | Scope | Purpose / when unset                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `CALENDLY_API_TOKEN`                                                                                                                   | S     | Calendly REST reads (reconcile, backfill, chatbot booking check, audit). Unset: those Calendly API reads cannot run |
| `CALENDLY_CHATBOT_EVENT_TYPE_URI`                                                                                                      | S     | Event type for the chatbot availability tool; has a pinned default in `src/lib/chatbot/booking.ts`                  |
| `NEXT_PUBLIC_CHATBOT_CALENDLY_URL`                                                                                                     | P     | Chatbot booking embed URL; has a default in `src/lib/chatbot/booking.ts`                                            |
| `NEXT_PUBLIC_SETTER_CALENDLY_URL`, `NEXT_PUBLIC_LANE_1_CALENDLY_URL`, `NEXT_PUBLIC_LANE_1_TOP_CALENDLY_URL`, `NEXT_PUBLIC_ROADMAP_URL` | P     | Thank-you page routing per qualification band; defaults in `src/lib/qualification/thank-you-links.ts`               |

## 5. Close CRM

`CLOSE_API_KEY` enables the sync runner. Unset: the runner records a retryable failure and
events stay queued. `CLOSE_API_BASE_URL` defaults to `https://api.close.com/api/v1`.
Other scalar settings: `CLOSE_LEAD_STATUS_ID`, `CLOSE_FOLLOW_UP_ASSIGNED_TO`,
`CLOSE_WARM_REPLY_ACTIVITY_ENABLED` (off unless exactly `true`).

All variables below are Close custom-field ids, all server-only and optional. **A field's scope
(Lead or Contact) must match how it is written; sending a contact-scoped id on a lead update
makes Close reject the whole update.** Check scope with `GET /custom_field/{lead|contact}/{id}/`
before wiring a new one (README "Close custom fields"). An unset id means that field is not
written.

```
CLOSE_ADSET_ID_FIELD_ID
CLOSE_ADSET_NAME_FIELD_ID
CLOSE_AD_GROUP_ID_FIELD_ID
CLOSE_AD_GROUP_NAME_FIELD_ID
CLOSE_AD_ID_FIELD_ID
CLOSE_AD_NAME_FIELD_ID
CLOSE_AVAILABLE_CAPITAL_FIELD_ID
CLOSE_BAND_FIELD_ID
CLOSE_BUDGET_RANGE_FIELD_ID
CLOSE_BUSINESS_STAGE_FIELD_ID
CLOSE_CAMPAIGN_ID_FIELD_ID
CLOSE_CAMPAIGN_NAME_FIELD_ID
CLOSE_CLICKED_HREF_FIELD_ID
CLOSE_CONSENT_STATUS_FIELD_ID
CLOSE_CONTACT_PREFERENCE_FIELD_ID
CLOSE_ENTRY_SOURCE_FIELD_ID
CLOSE_EXPERIMENT_KEY_FIELD_ID
CLOSE_FBCLID_FIELD_ID
CLOSE_FIRST_LANDING_PATH_FIELD_ID
CLOSE_FIRST_LANDING_URL_FIELD_ID
CLOSE_FIRST_REFERRER_FIELD_ID
CLOSE_GBRAID_FIELD_ID
CLOSE_GCLID_FIELD_ID
CLOSE_GROUP_ID_FIELD_ID
CLOSE_GROUP_NAME_FIELD_ID
CLOSE_LANDING_PATH_FIELD_ID
CLOSE_LATEST_COMPLETED_AT_FIELD_ID
CLOSE_LATEST_LANDING_PATH_FIELD_ID
CLOSE_LATEST_LANDING_URL_FIELD_ID
CLOSE_LATEST_REFERRER_FIELD_ID
CLOSE_LEAD_UTM_CAMPAIGN_FIELD_ID
CLOSE_LEAD_UTM_CONTENT_FIELD_ID
CLOSE_LEAD_UTM_MEDIUM_FIELD_ID
CLOSE_LEAD_UTM_SOURCE_FIELD_ID
CLOSE_LEAD_UTM_TERM_FIELD_ID
CLOSE_LOCATION_STATUS_FIELD_ID
CLOSE_MACHINE_GOAL_FIELD_ID
CLOSE_PAID_PLATFORM_FIELD_ID
CLOSE_PAID_SOURCE_KEY_FIELD_ID
CLOSE_PRIMARY_GOAL_FIELD_ID
CLOSE_PURCHASE_TIMELINE_FIELD_ID
CLOSE_QUALIFICATION_STATUS_FIELD_ID
CLOSE_RESOURCE_TAG_FIELD_ID
CLOSE_SCORE_FIELD_ID
CLOSE_SOURCE_BLOCK_ID_FIELD_ID
CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID
CLOSE_SOURCE_PAGE_ID_FIELD_ID
CLOSE_SOURCE_PAGE_SLUG_FIELD_ID
CLOSE_SOURCE_PATH_FIELD_ID
CLOSE_STATE_MARKET_FIELD_ID
CLOSE_TARGET_KEYWORD_FIELD_ID
CLOSE_UTM_CAMPAIGN_FIELD_ID
CLOSE_UTM_CONTENT_FIELD_ID
CLOSE_UTM_MEDIUM_FIELD_ID
CLOSE_UTM_SOURCE_FIELD_ID
CLOSE_UTM_TERM_FIELD_ID
CLOSE_VARIANT_KEY_FIELD_ID
CLOSE_VP_SESSION_ID_FIELD_ID
CLOSE_WBRAID_FIELD_ID
```

## 6. Analytics connectors

| Variable                                                                                       | Scope | Purpose / when unset                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GA4_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`                                                  | S     | GA4 visits ingest; also the credential used for Search Console. Unset: GA4 falls back to `lead_page_views`, Search Console skips    |
| `GSC_SITE_URL`                                                                                 | S     | Search Console property (for example `sc-domain:vendingpreneurs.com`). Unset: connector records `skipped`                           |
| `METRICOOL_API_KEY`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_IDS` (or single `METRICOOL_BLOG_ID`) | S     | Metricool posts, ads and account series. Unset: connector records `skipped`. The first id in `METRICOOL_BLOG_IDS` owns shared posts |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`                | S     | YouTube Analytics as channel owner (token from `scripts/youtube-oauth-token.mjs`). Unset: `skipped`                                 |
| `GHL_API_KEY`, `GHL_LOCATION_ID`                                                               | S     | Read-only GoHighLevel connectors. Unset: `skipped`, Channels shows "Not connected"                                                  |
| `GHL_WRITE_TOKEN`                                                                              | S     | Write token used only by masterclass registration. Unset: the form refuses to register                                              |
| `BITLY_ACCESS_TOKEN`, `BITLY_GROUP_GUID`                                                       | S     | Bitly click sync. Unset: "not connected"                                                                                            |
| `MANYCHAT_API_KEY`                                                                             | S     | ManyChat API enrichment. Unset: events land without enrichment                                                                      |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`                                                      | S     | DataForSEO ranks and AI checks (API credentials, not the site login)                                                                |
| `DATAFORSEO_MONTHLY_BUDGET_USD`                                                                | S     | Hard monthly spend cap in USD; defaults to 25                                                                                       |

## 7. Platform and tooling variables

Set by Vercel or the toolchain; not configured by hand.

| Variable                                             | Read by                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `NEXT_RUNTIME`, `CI`, `VERCEL`           | Next, Sentry build config, dev-auth guard                                                           |
| `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_URL` | Environment labels (Sentry, PostHog, hidden internal pages) and password-reset / invite link origin |
| `ALLOW_NEXT_BUILD_WITH_RUNNING_SERVER`               | Override for `scripts/guard-next-build.mjs`; leave unset                                            |

Script-only variables (`SMOKE_BASE_URL`, `QA_BYPASS`, `YOUTUBE_API_KEY`, `ALLOW_REMOTE_PURGE`, the
`PLAYWRIGHT_*` and `CHATBOT_REPLAY*` variables and others) are documented in
[scripts/README.md](../scripts/README.md).

## 8. The newsletter app (`apps/mike-newsletter`)

A separate Vercel project with its own variables (see `apps/mike-newsletter/.env.example` and
its README): `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_KEY`, `ACTIVECAMPAIGN_LIST_ID`,
`ACTIVECAMPAIGN_SOURCE_FIELD_ID`, `ACTIVECAMPAIGN_TAG_ID`, `SUBSCRIBE_WEBHOOK_URL`,
`NEXT_PUBLIC_SITE_URL`, and the Vercel-provided `VERCEL_PROJECT_PRODUCTION_URL`.
