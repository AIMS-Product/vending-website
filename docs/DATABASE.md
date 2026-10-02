# Database

Verified against the migration files on `main` (`faac091`) on 2026-10-02. This document
describes what the repository **defines**. What production **has applied** cannot be read from
the repository and is left as an owner task in section 3.

## 1. Basics

- **Engine:** Supabase (Postgres, Auth, Storage). The production project reference and region
  are not in the repository; they are in the Supabase dashboard and the Vercel environment
  (`NEXT_PUBLIC_SUPABASE_URL`). `supabase/config.toml` holds local-development settings only
  (`project_id = "vending-website"`).
- **Migrations:** 102 SQL files in `supabase/migrations/` (first `20260501042413_init_news_cms.sql`,
  latest `20261001120000_close_sync_kit_subscribe.sql`) plus `APPLY-IN-SQL-EDITOR.md`.
- **How they are applied today:** by hand. `APPLY-IN-SQL-EDITOR.md` says the Supabase CLI is not
  linked to this repo, so migrations are pasted into the Supabase SQL editor. Its sections 6 to
  10 (through `20261001120000`) are headed "Waiting on a hand-applied migration". Several
  migration files say "NOT YET APPLIED" in their own headers, for example
  `20260801090000_public_request_hits.sql`.
- **Consequence:** the repository can contain code that depends on a migration production does
  not have. The code is written to tolerate that in places (SEO loaders treat a missing table
  as "not set up" through `isMissingTable` in `src/lib/seo/db.ts`; the rate limiter fails open;
  the Kit enqueue fails soft), but not everywhere. A hand-applied migration that is missing
  produces silently absent features, not an error page.
- **Rules for new migrations:** forward-only, safe to run twice (`if not exists`, `drop ... if
exists`), no edits to a file once it has been applied anywhere. Published
  `qualification_form_versions` rows are immutable by trigger; a scoring change inserts a new
  version row. Never apply a migration to production from a feature branch.

## 2. Tables defined by the migrations (74)

All 74 have row-level security enabled in their migration. Twenty-eight carry policies (admin
read or write, checking the signed-in user against `app_users`, inline or through the `is_app_admin()` / `is_app_super_admin()` helper functions); the rest are
service-role only (RLS on, no policy), which means only server code using the service-role key
can reach them.

| Domain                             | Tables                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin access                       | `app_users`, `app_user_emails`, `app_user_events`                                                                                                                                                                                                                                                                                           |
| Leads, qualification, Close outbox | `lead_submissions`, `lead_forward_settings`, `close_sync_events`, `qualification_forms`, `qualification_form_versions`, `qualification_sessions`, `qualification_answers`, `public_request_hits`                                                                                                                                            |
| Bookings and Close mirror          | `calendly_bookings`, `calendly_booking_sessions`, `close_lead_funnel`                                                                                                                                                                                                                                                                       |
| Attribution and engagement         | `lead_page_views`, `lead_video_views`, `ga4_page_views`, `marketing_links`, `popups`, `popup_events`                                                                                                                                                                                                                                        |
| Chatbot                            | `chatbot_config`, `chatbot_conversations`, `chatbot_conversation_flags`, `chatbot_follow_up_tasks`, `chatbot_insights`, `chatbot_knowledge_suggestions`, `chatbot_learning_cases`, `chatbot_learning_runs`, `chatbot_site_recommendations`, `chatbot_unknown_questions`                                                                     |
| Channel spine, connectors, audit   | `channel_daily`, `channel_sync_runs`, `data_audit_runs`, `bitly_link_clicks`, `ghl_email_stats`, `metricool_posts`, `social_account_daily`, `youtube_videos`, `youtube_video_daily`, `manychat_events`, `webinar_events`, `cac_months`, `cac_routes`                                                                                        |
| Content and page builder           | `news_posts`, `case_studies`, `media_assets`, `redirects`, `seo_pages`, `page_revisions`, `page_preview_tokens`, `ai_page_proposals`, `page_builder_authors`, `page_builder_comments`, `page_builder_content_pieces`, `page_builder_route_prefixes`, `cta_presets`, `proof_items`, `approved_claims`, `source_documents`, `source_excerpts` |
| SEO command center                 | `seo_ai_checks`, `seo_baselines`, `seo_competitor_keywords`, `seo_content_pieces`, `seo_gsc_daily`, `seo_gsc_page_daily`, `seo_gsc_query_daily`, `seo_gsc_query_totals_daily`, `seo_keyword_volume_monthly`, `seo_keywords`, `seo_monthly_reviews`, `seo_rank_snapshots`, `seo_tasks`, `dataforseo_spend`                                   |

Other objects the migrations create: Postgres functions (`publish_seo_page_atomically`,
`archive_seo_page_atomically`, `apply_seo_page_revision_update_atomically`,
`update_seo_page_slug_with_redirect`, `accept_ai_proposal_blocks`,
`prune_seo_page_manual_save_revisions`, `chatbot_append_message`, `chatbot_log_unknown_question`,
`record_video_view`, `handle_auth_user_created`, `is_app_admin`, `is_app_super_admin`,
`set_updated_at`, and trigger functions such as `prevent_page_revision_mutation`,
`prevent_qualification_form_version_mutation`, `case_studies_single_featured` and
`channel_daily_keep_program_channel`); storage buckets, including the public `news-images` bucket
(5 MB, AVIF/WebP/PNG/JPEG) and `page-builder-media` and `case-study-images` buckets; and
`purge_all_seo_pages_for_testing`, a guarded test-only RPC used by `scripts/purge-seo-pages.mjs`.

Important data rules live in `AGENTS.md` Learnings (spine keys, `channel_sync_runs.error`
semantics, `close_lead_funnel` scope, the `lead_video_views` trust date). Read the relevant entry
before changing how a table is written or read.

## 3. Migration ledger (owner action required)

Applied state is unknown to the repository. Hand-applied SQL does **not** appear in
`supabase_migrations.schema_migrations`, so that table cannot be used as the ledger. To fill the
ledger, an owner with production read access should:

1. List tables and compare with section 2:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' order by 1;
   ```
2. Check columns and constraints added by later migrations, for example
   `channel_daily.thankyou_visits` and the `close_sync_events_event_type_check` constraint
   (`20261001120000` adds the `kit_subscribe` and `warm_reply_activity` values).
3. Record the result in a table with columns: migration file, applied to production (yes/no),
   date, checked by.

Migrations known from the repository to need attention (state in production not verified):

| Migration                                                                | Why it matters                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `20260801090000_public_request_hits.sql`                                 | Rate limiting does nothing until this table exists (the limiter fails open)                                                     |
| `20260731120000_lead_submissions_email_index.sql`                        | Written to index `lead_submissions` for email lookups; `docs/archive/HANDOFF-HARDENING.md` (2026-07-31) lists it as not applied |
| `20260825130000_close_warm_reply_activity.sql`                           | Needed before `CLOSE_WARM_REPLY_ACTIVITY_ENABLED=true`                                                                          |
| `20260929120000` to `20260929125000`, `20260930120000`, `20260930121000` | SEO command center tables, baseline and AI checks (`APPLY-IN-SQL-EDITOR.md` sections 8 and 9)                                   |
| `20261001120000_close_sync_kit_subscribe.sql`                            | Without it, Kit newsletter signups are saved but never queued to Kit (section 10)                                               |

**Target process:** link the Supabase CLI (`supabase link`), baseline the current production
schema, and apply future migrations with `supabase db push` from CI or a reviewed local run, so
the ledger is the database itself.

## 4. Backups, recovery and access

Not defined in the repository. **(outside the repo)** Confirm in the Supabase dashboard: plan,
point-in-time recovery window, backup schedule, who holds the service-role key and database
password, and the date of the last restore test. Until those are recorded here, treat recovery
as untested.

## 5. Row-level security summary

- Public forms and chatbot routes write through server code using the service-role client;
  browsers never write to the lead tables (see the header of
  `supabase/migrations/20260504090000_lead_submissions.sql`).
- Admin read and write policies check the caller against `app_users`, inline or through
  `is_app_admin()` and `is_app_super_admin()`.
- Because most server code uses the service-role key (which bypasses RLS), RLS is the backstop
  for direct database access, and the application-level checks in `src/lib/supabase/auth.ts` are
  the primary gate. See [SECURITY.md](SECURITY.md).
