-- Booking credit vs entry credit.
--
-- Two different questions that the single "Booked" badge used to answer with
-- one word, wrongly: what brought this person in, and who got them onto the
-- calendar. A chatbot lead that a setter later called and booked has to show
-- both, and must never read as if the chatbot booked the call.
--
-- Both values are mirrored from Close by reconcileCloseBookings, which already
-- reads the lead's custom fields on every pass. Close stays the source of
-- truth; we only cache what it says so the admin can render it without a live
-- CRM call per row.

alter table public.lead_submissions
  add column if not exists booked_by_setter text,
  add column if not exists entry_resource_tag text;

comment on column public.lead_submissions.booked_by_setter is
  'Close custom field "Reactivation - Setter Name": the setter who got this lead onto the calendar via call/SMS/VM. Null means no setter is recorded, which is not the same as "the chatbot booked it".';

comment on column public.lead_submissions.entry_resource_tag is
  'Close custom field "Resource Tag": how the lead entered the system (chatbot, website-application, lead-magnet, webinar, ...). Entry credit, never booking credit.';
