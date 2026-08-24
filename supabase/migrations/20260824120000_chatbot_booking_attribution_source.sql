-- Site chatbot: labels HOW a booking got attributed to a conversation.
--
-- The utm_content match in booking-attribution.ts is exact-evidence: the
-- visitor booked through the calendar embedded in that exact chat. Most
-- bookings never carry that tag -- the visitor left and booked later from
-- /book-now or an emailed link -- so booking-attribution.ts now also falls
-- back to matching the invitee email against a conversation's
-- captured_email within a trailing window. `attribution_source` records
-- which kind of match produced the stamp, so /admin/chatbot can distinguish
-- a certain conversion from an inferred one instead of treating them the
-- same.
--
-- NOT YET APPLIED. Applied by hand via the Supabase SQL editor, same as the
-- rest of this house's migrations. booking-attribution.ts tolerates the
-- pre-migration shape (see its isMissingColumnError pattern), so deploying
-- ahead of the migration degrades rather than breaks: call_booked_at still
-- gets written, the label just doesn't.

alter table public.chatbot_conversations
  add column if not exists attribution_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chatbot_conversations_attribution_source_check'
  ) then
    alter table public.chatbot_conversations
      add constraint chatbot_conversations_attribution_source_check
      check (attribution_source in ('in_chat', 'email_match'));
  end if;
end $$;

comment on column public.chatbot_conversations.attribution_source is
  'How call_booked_at was matched: in_chat = exact utm_content match to this conversation id, email_match = fallback match on captured_email within the trailing window. Null before either match runs or pre-migration.';
