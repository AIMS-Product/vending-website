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

-- ---------------------------------------------------------------------------
-- Helper functions.
--
-- Both exist because PostgREST cannot express "modify a value based on its
-- current value" — an upsert can only set literals, and a jsonb append needs
-- the existing array. Doing either as read-then-write from the application
-- opens a lost-update race against the chat route, which rewrites the whole
-- messages array once per turn from a snapshot taken before the model call.
-- ---------------------------------------------------------------------------

-- Appends one message to a conversation transcript atomically. The Calendly
-- webhook uses this to drop in a booking confirmation without ever reading
-- and rewriting the array, which would delete any turn that landed in
-- between.
create or replace function public.chatbot_append_message(
  p_conversation_id uuid,
  p_message jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  update public.chatbot_conversations
     set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
         message_count = jsonb_array_length(coalesce(messages, '[]'::jsonb)) + 1
   where id = p_conversation_id;
$$;

comment on function public.chatbot_append_message(uuid, jsonb) is
  'Atomic single-message append to chatbot_conversations.messages. Used by the Calendly webhook so a booking confirmation can never clobber a concurrent chat turn.';

-- Records a question the bot could not answer, incrementing the ask count on
-- an existing row instead of overwriting it. `status` is deliberately left
-- alone on conflict: a dismissed question stays dismissed rather than
-- reappearing on the insights rail every time someone asks it again.
create or replace function public.chatbot_log_unknown_question(
  p_conversation_id uuid,
  p_question text,
  p_dedupe_key text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.chatbot_unknown_questions
    (conversation_id, question, dedupe_key)
  values
    (p_conversation_id, p_question, p_dedupe_key)
  on conflict (dedupe_key) do update
    set ask_count = public.chatbot_unknown_questions.ask_count + 1,
        last_asked_at = now();
$$;

comment on function public.chatbot_log_unknown_question(uuid, text, text) is
  'Upserts a self-reported answer gap, incrementing ask_count on repeat. The insights rail ranks by that count, so it must be a real increment rather than a fixed default.';

revoke all on function public.chatbot_append_message(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.chatbot_log_unknown_question(uuid, text, text) from public, anon, authenticated;

-- The revoke above is only half the pattern (see the seo_page_fn_revoke /
-- seo_page_fn_grant pair). Without this grant both functions exist but are
-- unexecutable, and because both call sites are fail-soft console.warn a
-- permission denial would look exactly like "migration not applied yet" --
-- silently no-op forever.
grant execute on function public.chatbot_append_message(uuid, jsonb) to service_role;
grant execute on function public.chatbot_log_unknown_question(uuid, text, text) to service_role;
