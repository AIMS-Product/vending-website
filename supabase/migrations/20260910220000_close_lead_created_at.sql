-- First touch vs the chat.
--
-- When Close created the lead a chatbot conversation links to. Close sets
-- date_created once and nothing rewrites it, so comparing it with
-- chatbot_conversations.created_at says which came first: the chat (chatbot
-- first touch), or an earlier record (webinar, Typeform, a setter's Instagram
-- lead), in which case the chat was a middle touch.
--
-- Mirrored by reconcileCloseBookings on its normal pass. Applied by hand in
-- the Supabase SQL editor on 2026-09-10.

alter table public.lead_submissions
  add column if not exists close_lead_created_at timestamptz;
