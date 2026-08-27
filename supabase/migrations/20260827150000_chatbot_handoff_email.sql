-- Hand-offs now send a real email (bot flag_for_team and the admin Hand off
-- button both route through src/lib/chatbot/handoff-email.ts). These columns
-- are the delivery receipt the transcript shows: when, to whom, or why not.
-- Until this lands, "Handed off" meant a database row nobody was told about.
alter table public.chatbot_conversations
  add column if not exists handoff_emailed_at timestamptz,
  add column if not exists handoff_emailed_to text,
  add column if not exists handoff_email_error text;

-- Where support-reason hand-offs (existing customers: pause, billing, login)
-- go. Sales/callback hand-offs use lead_routing_emails. Null falls back to the
-- code default (jade@modern-amenities.com).
alter table public.chatbot_config
  add column if not exists support_email text;
