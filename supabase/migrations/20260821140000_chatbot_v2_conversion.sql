-- Site chatbot v2: in-chat booking attribution + the unanswered-question loop.
--
-- Two additions, both additive:
--
-- 1. chatbot_conversations gains call_booked_at / booked_event_uri. The
--    Calendly webhook (/api/webhooks/calendly) stamps these when an invitee
--    arrives carrying utm_source=chatbot and a utm_content matching a
--    conversation id — that pair is the whole chat -> booked call attribution
--    chain the admin funnel reports on.
-- 2. chatbot_unknown_questions records questions the model self-reported it
--    could not answer confidently (the flag_unknown_question tool), so
--    /admin/chatbot/insights can show real gaps and an admin can answer one
--    straight into chatbot_config.knowledge_base.
--
-- NOT YET APPLIED. Applied by hand via the Supabase SQL editor, same as the
-- rest of this house's migrations. Every reader tolerates the pre-migration
-- shape (see chatbot/config.ts's isMissingColumnError pattern), so deploying
-- ahead of the migration degrades rather than breaks.

alter table public.chatbot_conversations
  add column if not exists call_booked_at timestamptz,
  add column if not exists booked_event_uri text;

comment on column public.chatbot_conversations.call_booked_at is
  'Set when a Calendly invitee.created webhook arrives tagged with this conversation id (utm_content). Cleared on invitee.canceled so booked-call KPIs count live bookings only.';
comment on column public.chatbot_conversations.booked_event_uri is
  'Calendly scheduled_event URI for the booked call. Retained after a cancellation as an audit trail.';

create index if not exists chatbot_conversations_call_booked_idx
  on public.chatbot_conversations (call_booked_at desc)
  where call_booked_at is not null;

-- ---------------------------------------------------------------------------
-- chatbot_unknown_questions — model-reported answer gaps.
-- ---------------------------------------------------------------------------

create table if not exists public.chatbot_unknown_questions (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.chatbot_conversations (id) on delete cascade,
  question         text not null,
  -- Normalized question text, so the same gap asked twenty different times
  -- collapses to one row instead of flooding the insights rail.
  dedupe_key       text not null unique,
  ask_count        int not null default 1,
  status           text not null default 'open'
                   check (status in ('open', 'answered', 'dismissed')),
  answer           text,
  created_at       timestamptz not null default now(),
  last_asked_at    timestamptz not null default now(),
  answered_at      timestamptz
);

create index if not exists chatbot_unknown_questions_status_idx
  on public.chatbot_unknown_questions (status, last_asked_at desc);

alter table public.chatbot_unknown_questions enable row level security;

comment on table public.chatbot_unknown_questions is
  'Questions the chatbot self-reported it could not answer confidently (flag_unknown_question tool). Reviewed and answered into the knowledge base at /admin/chatbot/insights. Service-role only.';
