-- Chatbot widget: config-driven quick actions + starter questions.
--
-- quick_actions renders as a row of buttons under the panel header
-- (label + destination URL); starter_questions renders as tappable pill
-- chips above the input before the visitor's first message. Both are
-- admin-edited at /admin/chatbot, capped at 5 entries each in the app layer
-- (chatbotConfigInputSchema) — the column itself has no DB-level cap.
--
-- Additive only, matches chatbot_foundation.sql (NOT YET APPLIED — applied
-- by hand, same as the rest of this house's migrations).

alter table public.chatbot_config
  add column if not exists starter_questions jsonb not null default '[]'::jsonb,
  add column if not exists quick_actions jsonb not null default '[]'::jsonb;

update public.chatbot_config
set
  starter_questions = '["How much does it cost to start?","Do I need experience?","How does the program work?"]'::jsonb,
  quick_actions = '[{"label":"Book a call","url":"/book-now"},{"label":"Free 90-day roadmap","url":"/resources/roadmap"},{"label":"Success stories","url":"/case-studies"}]'::jsonb
where id = 1;

comment on column public.chatbot_config.starter_questions is
  'Tappable question chips shown above the input before the visitor''s first message. Array of strings, capped at 5 in the app layer.';
comment on column public.chatbot_config.quick_actions is
  'Button row under the panel header. Array of {label, url}; url must be a relative path or point at vendingpreneurs.com (see isSafeChatLinkUrl), capped at 5 in the app layer.';
