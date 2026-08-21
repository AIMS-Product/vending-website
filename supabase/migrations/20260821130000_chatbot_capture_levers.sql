-- Chatbot widget: capture levers to reduce anonymous conversations.
--
-- capture_aggressiveness controls which assistant reply triggers the
-- on-intent inline capture card (eager=1st reply, balanced=2nd reply
-- [today's behavior], relaxed=3rd reply). exit_intent_capture toggles a
-- one-time desktop exit-intent (mouseout toward the top of the viewport)
-- capture prompt. Both admin-edited at /admin/chatbot; defaults preserve
-- today's behavior for existing rows.
--
-- Additive only, matches chatbot_foundation.sql (NOT YET APPLIED — applied
-- by hand, same as the rest of this house's migrations).

alter table public.chatbot_config
  add column if not exists capture_aggressiveness text not null default 'balanced' check (capture_aggressiveness in ('relaxed','balanced','eager')),
  add column if not exists exit_intent_capture boolean not null default true;

comment on column public.chatbot_config.capture_aggressiveness is
  'Which assistant reply triggers the on-intent inline capture card: eager=1st, balanced=2nd (default), relaxed=3rd.';
comment on column public.chatbot_config.exit_intent_capture is
  'Show a one-time inline capture card on desktop exit-intent (mouseout toward the top of the viewport) when a conversation is active and nothing is captured yet.';
