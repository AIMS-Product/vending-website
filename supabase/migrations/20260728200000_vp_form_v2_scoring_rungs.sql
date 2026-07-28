-- Kody's 2026-07-28 scoring revision for the VP Lead Capture form.
--
-- Timeline gains a "Next 30 days" rung. Invest replaces "Less than $3,000"
-- (which auto-disqualified, and was on its own disqualifying ~44% of real
-- leads) with "$1,000 - $3,000" plus an explicit "No available cash to invest"
-- as the only disqualifying answer. Points and band thresholds live in
-- src/lib/qualification/scoring.ts; option VALUES here are the contract between
-- the stored form and that engine, so the two must move together.
--
-- Published versions are immutable by design, so this publishes version 2
-- rather than editing version 1 — in-flight sessions keep answering against the
-- version they started on.

update public.qualification_forms
set draft_schema = jsonb_set(
      jsonb_set(
        draft_schema,
        '{questions}',
        (
          select jsonb_agg(
            case
              when question->>'id' = 'timeline' then
                jsonb_set(question, '{options}', '[
                  {"id":"asap","label":"As soon as possible","value":"asap"},
                  {"id":"few_weeks","label":"In the next few weeks","value":"few_weeks"},
                  {"id":"next_30_days","label":"Next 30 days","value":"next_30_days"},
                  {"id":"1_3_months","label":"1-3 months out","value":"1_3_months"},
                  {"id":"unsure","label":"Still figuring that out","value":"unsure"}
                ]'::jsonb)
              when question->>'id' = 'invest' then
                jsonb_set(question, '{options}', '[
                  {"id":"15k_plus","label":"$15,000+","value":"15k_plus"},
                  {"id":"10_15k","label":"$10,000 - $15,000","value":"10_15k"},
                  {"id":"5_10k","label":"$5,000 - $10,000","value":"5_10k"},
                  {"id":"3_5k","label":"$3,000 - $5,000","value":"3_5k"},
                  {"id":"1_3k","label":"$1,000 - $3,000","value":"1_3k"},
                  {"id":"no_cash","label":"No available cash to invest","value":"no_cash"}
                ]'::jsonb)
              else question
            end
            order by ordinality
          )
          from jsonb_array_elements(draft_schema->'questions')
            with ordinality as t(question, ordinality)
        )
      ),
      '{version}',
      to_jsonb(1)
    ),
    updated_at = now()
where id = 'a1b2c3d4-0000-4000-8000-000000000001';

insert into public.qualification_form_versions (
  id, form_id, version_number, schema_snapshot,
  question_count, normalized_roles, published_by, published_at
)
select
  'a1b2c3d4-0000-4000-8000-000000000003',
  f.id,
  2,
  f.draft_schema,
  jsonb_array_length(f.draft_schema->'questions'),
  v.normalized_roles,
  v.published_by,
  now()
from public.qualification_forms f
join public.qualification_form_versions v
  on v.id = 'a1b2c3d4-0000-4000-8000-000000000002'
where f.id = 'a1b2c3d4-0000-4000-8000-000000000001'
on conflict (id) do nothing;

update public.qualification_forms
set current_published_version_id = 'a1b2c3d4-0000-4000-8000-000000000003',
    updated_at = now()
where id = 'a1b2c3d4-0000-4000-8000-000000000001';
