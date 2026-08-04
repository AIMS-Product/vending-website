-- Dedicated, non-default form for /newsletter. Additive and idempotent: it
-- does not alter the published form used by lead magnets already taking leads.

insert into public.qualification_forms (id, name, slug, status, is_default, draft_schema)
values (
  '7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401',
  'The Route Newsletter Signup',
  'the-route-newsletter',
  'published',
  false,
  '{"version":1,"contactPhoneRequired":false,"questions":[{"id":"newsletter_email_consent","type":"consent","label":"Yes — send me The Route each week. I can unsubscribe anytime.","required":true,"normalizedRole":"consent"},{"id":"program_updates_consent","type":"consent","label":"Also send me occasional Vendingpreneurs program updates and event invites.","required":false},{"id":"sms_updates_consent","type":"consent","label":"Text me occasional updates at this number. Message and data rates may apply.","required":false,"normalizedRole":"contact_preference"},{"id":"pull_to_launch","type":"multiple_choice","label":"What''s pulling you to launch your own business?","required":false,"normalizedRole":"goal","options":[{"id":"replace_job","label":"Replace my full-time job","value":"replace_job"},{"id":"generational_wealth","label":"Build generational wealth","value":"generational_wealth"},{"id":"diversify_income","label":"Diversify my income","value":"diversify_income"},{"id":"life_event","label":"A life event","value":"life_event"},{"id":"other","label":"Other","value":"other"}]},{"id":"learn_most","type":"multiple_choice","label":"What do you want to learn most?","required":false,"options":[{"id":"getting_started","label":"Getting started the right way","value":"getting_started"},{"id":"machines_products","label":"Machines & products","value":"machines_products"},{"id":"locations","label":"Finding & securing locations","value":"locations"},{"id":"financing","label":"Financing & funding","value":"financing"},{"id":"legal","label":"Permits, legal & state rules","value":"legal"}]}]}'::jsonb
)
on conflict (id) do nothing;

insert into public.qualification_form_versions (
  id,
  form_id,
  version_number,
  question_count,
  normalized_roles,
  schema_snapshot
)
values (
  '9ba5f768-10a4-4d6f-a835-8fb8110ba402',
  '7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401',
  1,
  5,
  array['consent','contact_preference','goal'],
  '{"version":1,"contactPhoneRequired":false,"questions":[{"id":"newsletter_email_consent","type":"consent","label":"Yes — send me The Route each week. I can unsubscribe anytime.","required":true,"normalizedRole":"consent"},{"id":"program_updates_consent","type":"consent","label":"Also send me occasional Vendingpreneurs program updates and event invites.","required":false},{"id":"sms_updates_consent","type":"consent","label":"Text me occasional updates at this number. Message and data rates may apply.","required":false,"normalizedRole":"contact_preference"},{"id":"pull_to_launch","type":"multiple_choice","label":"What''s pulling you to launch your own business?","required":false,"normalizedRole":"goal","options":[{"id":"replace_job","label":"Replace my full-time job","value":"replace_job"},{"id":"generational_wealth","label":"Build generational wealth","value":"generational_wealth"},{"id":"diversify_income","label":"Diversify my income","value":"diversify_income"},{"id":"life_event","label":"A life event","value":"life_event"},{"id":"other","label":"Other","value":"other"}]},{"id":"learn_most","type":"multiple_choice","label":"What do you want to learn most?","required":false,"options":[{"id":"getting_started","label":"Getting started the right way","value":"getting_started"},{"id":"machines_products","label":"Machines & products","value":"machines_products"},{"id":"locations","label":"Finding & securing locations","value":"locations"},{"id":"financing","label":"Financing & funding","value":"financing"},{"id":"legal","label":"Permits, legal & state rules","value":"legal"}]}]}'::jsonb
)
on conflict (id) do nothing;

update public.qualification_forms
set
  current_published_version_id = '9ba5f768-10a4-4d6f-a835-8fb8110ba402',
  status = 'published',
  is_default = false,
  updated_at = now()
where id = '7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401';
