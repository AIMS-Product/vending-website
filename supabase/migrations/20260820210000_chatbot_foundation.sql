-- Site chatbot ("AI Setter") foundation schema.
--
-- All nine tables below are service-role only: RLS is enabled with no anon
-- or authenticated policies, same as public_request_hits and popup_events.
-- No client (browser or authenticated admin session) can reach these tables
-- directly. The public chat/config/lead API routes and the /admin/chatbot
-- pages all read and write through `createAdminClient()`, gating access in
-- application code (`requireAdmin()` for admin routes) rather than in RLS.
--
-- NOT YET APPLIED. Apply via the Supabase SQL editor / Management API, same
-- as the other recent migrations in this house.

-- ---------------------------------------------------------------------------
-- 1. chatbot_config — single row (id = 1), edited from /admin/chatbot.
-- ---------------------------------------------------------------------------

create table public.chatbot_config (
  id                    int primary key default 1 check (id = 1),
  enabled               boolean not null default false,
  persona_name          text not null default 'Mia',
  avatar_url            text,
  greeting              text,
  follow_up_message     text,
  teaser_text           text,
  brand_color           text,
  idle_trigger_seconds  int not null default 5,
  capture_mode          text not null default 'on_intent'
                        check (capture_mode in ('pre_chat', 'on_intent', 'off')),
  knowledge_base        text,
  model                 text not null default 'gpt-4o-mini',
  -- Comma-separated; app falls back to LEAD_NOTIFICATION_TO when blank.
  lead_routing_emails   text,
  notify_enabled        boolean not null default true,
  updated_at            timestamptz not null default now()
);

create trigger chatbot_config_set_updated_at
  before update on public.chatbot_config
  for each row execute function public.set_updated_at();

alter table public.chatbot_config enable row level security;

comment on table public.chatbot_config is
  'Single-row (id=1) chatbot configuration edited at /admin/chatbot. Service-role only.';

-- Seed the one row up front so every reader can assume it exists.
insert into public.chatbot_config (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. chatbot_conversations
-- ---------------------------------------------------------------------------

create table public.chatbot_conversations (
  id                          uuid primary key default gen_random_uuid(),
  session_id                  text not null unique,
  -- Hash of the vp_chat_vid cookie, used only to recall a returning
  -- visitor's captured contact info so the bot does not re-ask. Never an
  -- identity signal and never surfaced in greetings.
  visitor_hash                text,
  status                       text not null default 'active'
                              check (status in ('active', 'abandoned', 'lead_captured', 'handed_off', 'closed')),
  -- [{role, content, ts}], upserted whole on every turn (atomic single write).
  messages                    jsonb not null default '[]'::jsonb,
  captured_name                text,
  captured_email                text,
  captured_phone                text,
  -- Extracted profile from extract-prospect-profile.ts. See lib/chatbot/learning.
  prospect_profile              jsonb,
  prospect_profile_emailed_at   timestamptz,
  -- No hard FK: lead_submissions is written by a different pipeline stage and
  -- the house style (see public_request_hits, popup_events) avoids cross-
  -- table FKs for tables written by more than one code path.
  lead_submission_id            uuid,
  message_count                 int not null default 0,
  last_message_at               timestamptz not null default now(),
  handed_off_at                 timestamptz,
  handoff_reason                 text,
  page_url                       text,
  user_agent                     text,
  created_at                     timestamptz not null default now(),
  constraint chatbot_conversations_messages_is_array
    check (jsonb_typeof(messages) = 'array')
);

create index chatbot_conversations_status_last_message_idx
  on public.chatbot_conversations (status, last_message_at desc);

create index chatbot_conversations_captured_email_idx
  on public.chatbot_conversations (captured_email)
  where captured_email is not null;

-- Backs the returning-visitor recall lookup (vp_chat_vid cookie -> most
-- recent captured contact info), the one read the visitor_hash column exists
-- for.
create index chatbot_conversations_visitor_hash_idx
  on public.chatbot_conversations (visitor_hash)
  where visitor_hash is not null;

alter table public.chatbot_conversations enable row level security;

comment on table public.chatbot_conversations is
  'One row per chat session. Service-role only; written by the public chat/lead API routes and read by /admin/chatbot.';

-- ---------------------------------------------------------------------------
-- 3. chatbot_conversation_flags — reviewer QA tags, one per (conversation, flag).
-- ---------------------------------------------------------------------------

create table public.chatbot_conversation_flags (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.chatbot_conversations (id) on delete cascade,
  flag              text not null
                    check (flag in (
                      'quality_good', 'quality_bad', 'needs_prompt_tuning',
                      'lead_high_intent', 'lead_low_intent', 'followup_needed',
                      'handoff_missed'
                    )),
  note              text,
  created_by        uuid references auth.users (id),
  created_at        timestamptz not null default now(),
  unique (conversation_id, flag)
);

create index chatbot_conversation_flags_conversation_idx
  on public.chatbot_conversation_flags (conversation_id);

alter table public.chatbot_conversation_flags enable row level security;

comment on table public.chatbot_conversation_flags is
  'Reviewer QA tags on a transcript, set from /admin/chatbot/conversations/[id]. Service-role only.';

-- ---------------------------------------------------------------------------
-- 4. chatbot_learning_runs — one row per learning-engine pass.
-- ---------------------------------------------------------------------------

create table public.chatbot_learning_runs (
  id                     uuid primary key default gen_random_uuid(),
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  conversations_scanned  int not null default 0,
  records_written        int not null default 0,
  ok                     boolean,
  error                  text
);

create index chatbot_learning_runs_started_idx
  on public.chatbot_learning_runs (started_at desc);

alter table public.chatbot_learning_runs enable row level security;

comment on table public.chatbot_learning_runs is
  'Audit trail for each run of the deterministic learning engine (lib/chatbot/learning/run.ts). Service-role only.';

-- ---------------------------------------------------------------------------
-- 5. chatbot_learning_cases — deterministic classifier output.
-- ---------------------------------------------------------------------------

create table public.chatbot_learning_cases (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.chatbot_conversations (id) on delete cascade,
  case_type        text not null
                   check (case_type in (
                     'stalled_lead', 'uncaptured_engaged', 'call_intent_no_booking',
                     'pricing_question_no_capture', 'resource_intent_no_capture',
                     'bot_fallback_pattern'
                   )),
  status           text not null default 'open'
                   check (status in ('open', 'resolved', 'dismissed')),
  confidence       real not null default 0.5,
  reason_summary   text not null,
  evidence         jsonb,
  -- Upserted on, so re-runs converge instead of duplicating.
  dedupe_key       text not null unique,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index chatbot_learning_cases_conversation_idx
  on public.chatbot_learning_cases (conversation_id);
create index chatbot_learning_cases_status_idx
  on public.chatbot_learning_cases (status, created_at desc);

alter table public.chatbot_learning_cases enable row level security;

comment on table public.chatbot_learning_cases is
  'Deterministic (zero-LLM) classifier findings over transcripts. Feeds follow-up tasks and insights. Service-role only.';

-- ---------------------------------------------------------------------------
-- 6. chatbot_follow_up_tasks — templated, approval-only drafts.
-- ---------------------------------------------------------------------------

create table public.chatbot_follow_up_tasks (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid references public.chatbot_conversations (id) on delete cascade,
  learning_case_id  uuid references public.chatbot_learning_cases (id),
  task_type         text not null
                    check (task_type in ('invite_to_call', 'send_resources', 'confirm_fit', 'general_follow_up')),
  priority          int not null default 2,
  status            text not null default 'open'
                    check (status in ('open', 'approved', 'sent', 'dismissed', 'snoozed')),
  channel           text not null default 'email',
  -- String-interpolated, non-LLM templates. Never auto-sent — a human
  -- approves and sends from /admin/chatbot/insights.
  draft_subject     text,
  draft_body        text,
  due_at            timestamptz,
  reason_summary    text not null,
  dedupe_key        text not null unique,
  created_at        timestamptz not null default now()
);

create index chatbot_follow_up_tasks_status_idx
  on public.chatbot_follow_up_tasks (status, due_at);

alter table public.chatbot_follow_up_tasks enable row level security;

comment on table public.chatbot_follow_up_tasks is
  'Approval-only follow-up drafts produced by the learning engine. Never auto-sent. Service-role only.';

-- ---------------------------------------------------------------------------
-- 7. chatbot_insights — cross-conversation patterns.
-- ---------------------------------------------------------------------------

create table public.chatbot_insights (
  id               uuid primary key default gen_random_uuid(),
  insight_type     text not null
                   check (insight_type in (
                     'objection', 'missing_answer', 'pricing_confusion', 'call_friction',
                     'resource_gap', 'weak_cta', 'high_converting_pattern', 'site_content_gap'
                   )),
  title            text not null,
  summary          text not null,
  affected_count   int not null default 0,
  impact_score     int not null default 0,
  status           text not null default 'open'
                   check (status in ('open', 'applied', 'dismissed')),
  evidence         jsonb,
  dedupe_key       text not null unique,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index chatbot_insights_status_idx
  on public.chatbot_insights (status, impact_score desc);

alter table public.chatbot_insights enable row level security;

comment on table public.chatbot_insights is
  'Cross-conversation patterns surfaced by the learning engine (>=3 same-topic conversations). Service-role only.';

-- ---------------------------------------------------------------------------
-- 8. chatbot_knowledge_suggestions — proposed additions to the admin KB.
-- ---------------------------------------------------------------------------

create table public.chatbot_knowledge_suggestions (
  id               uuid primary key default gen_random_uuid(),
  pattern_type     text not null,
  affected_count   int not null default 0,
  suggested_text   text not null,
  source_case_ids  uuid[],
  status           text not null default 'open'
                   check (status in ('open', 'applied', 'dismissed')),
  dedupe_key       text not null unique,
  created_at       timestamptz not null default now(),
  applied_at       timestamptz
);

create index chatbot_knowledge_suggestions_status_idx
  on public.chatbot_knowledge_suggestions (status, created_at desc);

alter table public.chatbot_knowledge_suggestions enable row level security;

comment on table public.chatbot_knowledge_suggestions is
  'Proposed additions to chatbot_config.knowledge_base, derived from >=2 shared learning-case patterns. Service-role only.';

-- ---------------------------------------------------------------------------
-- 9. chatbot_site_recommendations — proposed site content/CTA fixes.
-- ---------------------------------------------------------------------------

create table public.chatbot_site_recommendations (
  id                  uuid primary key default gen_random_uuid(),
  recommendation_type text not null,
  suggested_title     text not null,
  suggested_body      text not null,
  status              text not null default 'open'
                      check (status in ('open', 'planned', 'dismissed')),
  dedupe_key          text not null unique,
  created_at          timestamptz not null default now()
);

create index chatbot_site_recommendations_status_idx
  on public.chatbot_site_recommendations (status, created_at desc);

alter table public.chatbot_site_recommendations enable row level security;

comment on table public.chatbot_site_recommendations is
  'Site content/CTA gaps surfaced from insights, reviewed at /admin/chatbot/insights. Service-role only.';
