-- Kody's 2026-08-14 Form V2 revision for the VP Lead Capture form.
--
-- Reintroduces informational questions for email/comms sorting, presented one
-- at a time after the contact stage. A new gate question ("Do you already
-- operate vending machines?") routes "yes" to the leaner Operator path
-- (bottleneck + invest) and "no" to the Standard path (persona + confidence +
-- timeline + invest). Persona replaces the old pull_to_launch/learn_most
-- motivation questions. Scoring and routing are unchanged: operators earn the
-- full 40 urgency points in place of a timeline answer (see
-- src/lib/qualification/scoring.ts); invest points, the no-cash disqualify,
-- and every band threshold stay as they were.
--
-- Only the consents and invest are schema-required. The branch questions
-- (operator, persona, confidence, bottleneck, timeline) must be optional at
-- the schema level because completion validates every required question for
-- every session, and each path legitimately skips the other path's questions
-- (legacy one-shot callers also still submit timeline + invest only).
-- Path-level requiredness is enforced in
-- src/lib/services/qualification-inline.ts.
--
-- Option VALUES are the contract between the stored form and the scoring
-- engine / vp-fields.ts catalogs, so the three must move together. Copy here
-- matches src/lib/qualification/vp-fields.ts verbatim (mirrored in
-- src/lib/qualification/vp-seed-form.test.ts).
--
-- Published versions are immutable by design, so this publishes version 3
-- rather than editing version 2 — in-flight sessions keep answering against
-- the version they started on.

update public.qualification_forms
set draft_schema = '{"version":1,"questions":[{"id":"consent_updates","type":"consent","label":"Email me the guide and vending resources.","required":true,"normalizedRole":"consent"},{"id":"consent_contact","type":"consent","label":"I agree to receive calls and texts about my request. Msg rates may apply.","required":true,"normalizedRole":"contact_preference"},{"id":"operator","type":"single_choice","label":"Do you already operate vending machines?","required":false,"normalizedRole":"operator_status","options":[{"id":"yes","label":"Yes","value":"yes"},{"id":"no","label":"No","value":"no"}]},{"id":"persona","type":"single_choice","label":"Which of these sounds most like you right now?","required":false,"normalizedRole":"persona","options":[{"id":"diversifier","label":"I''m not desperate. I want a real asset that beats real estate or the stock market","value":"diversifier"},{"id":"escape","label":"I want to build something of my own","value":"escape"},{"id":"triggered","label":"Something''s changed in my life (or will be soon) and I''m ready to bet on myself","value":"triggered"},{"id":"family","label":"I want to build this with my spouse or kids","value":"family"},{"id":"unsure","label":"None of the above","value":"unsure"}]},{"id":"confidence","type":"single_choice","label":"How confident are you in finding a location and picking a machine?","required":false,"normalizedRole":"confidence","options":[{"id":"very_confident","label":"Very confident in both — I just want expert feedback","value":"very_confident"},{"id":"one_not_other","label":"Confident in one, not the other","value":"one_not_other"},{"id":"need_roadmap","label":"Not confident in either — I need a roadmap","value":"need_roadmap"},{"id":"almost_bought","label":"Not confident — I almost bought a random machine online","value":"almost_bought"}]},{"id":"bottleneck","type":"single_choice","label":"What''s holding your business back right now?","required":false,"normalizedRole":"bottleneck","options":[{"id":"locations","label":"Finding new profitable locations","value":"locations"},{"id":"underperforming","label":"An underperforming machine or route","value":"underperforming"},{"id":"financing","label":"Financing to add more machines","value":"financing"},{"id":"other","label":"Something else","value":"other"}]},{"id":"timeline","type":"single_choice","label":"When do you want your first machine earning income?","required":false,"normalizedRole":"timeline","options":[{"id":"asap","label":"ASAP","value":"asap"},{"id":"few_weeks","label":"Next few weeks","value":"few_weeks"},{"id":"1_3_months","label":"1–3 months","value":"1_3_months"},{"id":"unsure","label":"Not sure yet","value":"unsure"}]},{"id":"invest","type":"single_choice","label":"How much capital are you ready to invest?","required":true,"normalizedRole":"available_capital","options":[{"id":"15k_plus","label":"$15,000+","value":"15k_plus"},{"id":"10_15k","label":"$10,000 – $15,000","value":"10_15k"},{"id":"5_10k","label":"$5,000 – $10,000","value":"5_10k"},{"id":"3_5k","label":"$3,000 – $5,000","value":"3_5k"},{"id":"1_3k","label":"$1,000 – $3,000","value":"1_3k"},{"id":"no_cash","label":"None/Not ready to deploy capital yet","value":"no_cash"}]}]}'::jsonb,
    updated_at = now()
where id = 'a1b2c3d4-0000-4000-8000-000000000001';

insert into public.qualification_form_versions (
  id, form_id, version_number, schema_snapshot,
  question_count, normalized_roles, published_by, published_at
)
select
  'a1b2c3d4-0000-4000-8000-000000000004',
  f.id,
  3,
  f.draft_schema,
  jsonb_array_length(f.draft_schema->'questions'),
  array['consent','contact_preference','operator_status','persona','confidence','bottleneck','timeline','available_capital'],
  v.published_by,
  now()
from public.qualification_forms f
join public.qualification_form_versions v
  on v.id = 'a1b2c3d4-0000-4000-8000-000000000003'
where f.id = 'a1b2c3d4-0000-4000-8000-000000000001'
on conflict (id) do nothing;

update public.qualification_forms
set current_published_version_id = 'a1b2c3d4-0000-4000-8000-000000000004',
    updated_at = now()
where id = 'a1b2c3d4-0000-4000-8000-000000000001';
