-- Who has agreed to get The Route, the weekly newsletter.
--
-- Its own column, not a lifecycle_status: "newsletter_subscribed" there means
-- "not a sales lead" (lead counts, the no-book alert), and a roadmap download
-- is still a lead. Set by the /newsletter signup and by a roadmap download
-- from /resources/roadmap, whose form carries the newsletter notice.
--
-- Must be applied BEFORE the code that writes it deploys: until the column
-- exists, every roadmap and /newsletter submit fails its lead update.

alter table public.lead_submissions
  add column if not exists newsletter_subscribed_at timestamptz;

comment on column public.lead_submissions.newsletter_subscribed_at is
  'When this person agreed to get The Route (/newsletter signup, or a roadmap download whose form showed the newsletter notice). Null = not subscribed. Independent of lifecycle_status.';

-- Existing /newsletter subscribers, from the consent their signup recorded.
-- Roadmap downloads before this change are deliberately NOT backfilled: their
-- form never told them about the newsletter.
update public.lead_submissions as lead
set newsletter_subscribed_at = consent.first_consent_at
from (
  select lead_submission_id, min(consent_accepted_at) as first_consent_at
  from public.qualification_sessions
  where form_id = '7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401' -- NEWSLETTER_FORM_ID
    and consent_accepted_at is not null
  group by lead_submission_id
) as consent
where lead.id = consent.lead_submission_id
  and lead.newsletter_subscribed_at is null;
