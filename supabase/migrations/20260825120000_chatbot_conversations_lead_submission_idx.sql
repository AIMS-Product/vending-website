-- Backs the Close engagement-note lookup: given a lead that just synced to
-- Close, find the conversation it came from.
--
-- The Close sync drain runs every two minutes and now performs this lookup
-- once per synced lead (src/lib/close/sync.ts -> writeChatbotEngagementNote).
-- Without an index that is a sequential scan of chatbot_conversations on a
-- two-minute cadence. The table is small today, so this is a ceiling being
-- removed early rather than a live problem.
--
-- Partial, matching the style of the captured_email and visitor_hash indexes
-- above it: the column is null for every conversation that never produced a
-- lead, which is most of them, and those rows are never the target of this
-- lookup.
create index if not exists chatbot_conversations_lead_submission_id_idx
  on public.chatbot_conversations (lead_submission_id)
  where lead_submission_id is not null;
