-- Post-submit qualification builder foundation.
--
-- Security model:
--   * Public visitors never access these tables directly. Server actions use
--     service-role clients to create leads, sessions, answers, and sync events.
--   * Browser-visible qualification URLs use opaque tokens whose hashes are
--     stored here; raw tokens, lead IDs, and email addresses are not embedded in
--     lookup columns.
--   * Authenticated app admins can inspect and operate the records through the
--     existing app_users / is_app_admin boundary.
--   * No anon policies exist for qualification answers or Close sync events.

alter table public.lead_submissions
  add column if not exists lifecycle_status text not null default 'contact_captured'
    check (
      lifecycle_status in (
        'contact_captured',
        'qualification_pending',
        'qualification_stale',
        'qualified',
        'qualification_expired'
      )
    ),
  add column if not exists qualification_summary jsonb not null default '{}'::jsonb,
  add column if not exists latest_qualification_form_id uuid,
  add column if not exists latest_qualification_form_version_id uuid,
  add column if not exists latest_qualification_session_id uuid,
  add column if not exists latest_qualification_started_at timestamptz,
  add column if not exists latest_qualification_completed_at timestamptz,
  add column if not exists close_lead_id text,
  add column if not exists close_contact_id text,
  add column if not exists close_sync_status text
    check (
      close_sync_status is null
      or close_sync_status in (
        'pending',
        'retrying',
        'synced',
        'failed',
        'dead_letter',
        'needs_review'
      )
    ),
  add column if not exists close_sync_attempt_count integer not null default 0
    check (close_sync_attempt_count >= 0),
  add column if not exists close_sync_next_retry_at timestamptz,
  add column if not exists close_sync_last_attempted_at timestamptz,
  add column if not exists close_sync_synced_at timestamptz,
  add column if not exists close_sync_last_error text;

create table public.qualification_forms (
  id                           uuid primary key default gen_random_uuid(),
  name                         text not null,
  slug                         text,
  status                       text not null default 'draft'
                               check (status in ('draft', 'published', 'archived')),
  is_default                   boolean not null default false,
  draft_schema                 jsonb not null default '{}'::jsonb,
  current_published_version_id uuid,
  created_by                   uuid references auth.users(id) on delete set null,
  updated_by                   uuid references auth.users(id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create table public.qualification_form_versions (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null
                  references public.qualification_forms(id) on delete cascade,
  version_number  integer not null check (version_number > 0),
  schema_snapshot jsonb not null,
  question_count  integer not null default 0 check (question_count >= 0),
  normalized_roles text[] not null default '{}'::text[],
  published_by    uuid references auth.users(id) on delete set null,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (form_id, version_number)
);

alter table public.qualification_forms
  add constraint qualification_forms_current_version_fk
  foreign key (current_published_version_id)
  references public.qualification_form_versions(id)
  on delete set null;

create table public.qualification_sessions (
  id                           uuid primary key default gen_random_uuid(),
  lead_submission_id           uuid not null
                               references public.lead_submissions(id)
                               on delete cascade,
  form_id                      uuid not null
                               references public.qualification_forms(id)
                               on delete restrict,
  form_version_id              uuid not null
                               references public.qualification_form_versions(id)
                               on delete restrict,
  session_token_hash           text not null unique
                               check (length(session_token_hash) >= 32),
  status                       text not null default 'pending'
                               check (
                                 status in (
                                   'pending',
                                   'in_progress',
                                   'completed',
                                   'stale',
                                   'expired'
                                 )
                               ),
  completion_redirect_path     text,
  source_path                  text,
  landing_path                 text,
  referrer                     text,
  user_agent                   text,
  utm_source                   text,
  utm_medium                   text,
  utm_campaign                 text,
  utm_term                     text,
  utm_content                  text,
  source_page_id               uuid,
  source_page_slug             text,
  source_block_id              text,
  source_cta_tracking_name     text,
  target_keyword               text,
  experiment_key               text,
  variant_key                  text,
  current_question_id          text,
  answer_count                 integer not null default 0 check (answer_count >= 0),
  normalized_summary           jsonb not null default '{}'::jsonb,
  consent_accepted_at          timestamptz,
  consent_question_snapshot    jsonb,
  consent_user_agent           text,
  consent_source_attribution   jsonb not null default '{}'::jsonb,
  stale_at                     timestamptz not null,
  expires_at                   timestamptz not null,
  started_at                   timestamptz,
  completed_at                 timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

alter table public.lead_submissions
  add constraint lead_submissions_latest_qualification_form_fk
  foreign key (latest_qualification_form_id)
  references public.qualification_forms(id)
  on delete set null,
  add constraint lead_submissions_latest_qualification_form_version_fk
  foreign key (latest_qualification_form_version_id)
  references public.qualification_form_versions(id)
  on delete set null,
  add constraint lead_submissions_latest_qualification_session_fk
  foreign key (latest_qualification_session_id)
  references public.qualification_sessions(id)
  on delete set null;

create table public.qualification_answers (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null
                      references public.qualification_sessions(id)
                      on delete cascade,
  lead_submission_id  uuid not null
                      references public.lead_submissions(id)
                      on delete cascade,
  form_version_id     uuid not null
                      references public.qualification_form_versions(id)
                      on delete restrict,
  question_id         text not null,
  question_type       text not null,
  normalized_role     text,
  question_snapshot   jsonb not null,
  option_snapshots    jsonb not null default '[]'::jsonb,
  answer_value        jsonb not null,
  normalized_value    jsonb not null default '{}'::jsonb,
  answered_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (session_id, question_id)
);

create table public.close_sync_events (
  id                  uuid primary key default gen_random_uuid(),
  lead_submission_id  uuid
                      references public.lead_submissions(id)
                      on delete cascade,
  session_id          uuid
                      references public.qualification_sessions(id)
                      on delete cascade,
  event_type          text not null
                      check (
                        event_type in (
                          'lead_create_or_update',
                          'qualification_enrichment',
                          'stale_follow_up_task',
                          'manual_retry'
                        )
                      ),
  status              text not null default 'pending'
                      check (
                        status in (
                          'pending',
                          'retrying',
                          'synced',
                          'failed',
                          'dead_letter',
                          'needs_review'
                        )
                      ),
  dedupe_key          text,
  payload             jsonb not null default '{}'::jsonb,
  close_lead_id       text,
  close_contact_id    text,
  attempt_count       integer not null default 0 check (attempt_count >= 0),
  max_attempts        integer not null default 8 check (max_attempts > 0),
  next_retry_at       timestamptz not null default now(),
  last_attempted_at   timestamptz,
  synced_at           timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (lead_submission_id is not null or session_id is not null)
);

create unique index qualification_forms_slug_idx
  on public.qualification_forms (slug)
  where slug is not null;

create unique index qualification_forms_default_one_idx
  on public.qualification_forms (is_default)
  where is_default;

create index qualification_forms_status_created_idx
  on public.qualification_forms (status, created_at desc);

create index qualification_form_versions_form_idx
  on public.qualification_form_versions (form_id, version_number desc);

create index qualification_form_versions_published_idx
  on public.qualification_form_versions (published_at desc);

create index qualification_sessions_token_hash_idx
  on public.qualification_sessions (session_token_hash);

create index qualification_sessions_lead_idx
  on public.qualification_sessions (lead_submission_id, created_at desc);

create index qualification_sessions_form_version_idx
  on public.qualification_sessions (form_version_id);

create index qualification_sessions_status_idx
  on public.qualification_sessions (status, created_at desc);

create index qualification_sessions_stale_idx
  on public.qualification_sessions (status, stale_at)
  where status in ('pending', 'in_progress');

create index qualification_sessions_expires_idx
  on public.qualification_sessions (status, expires_at)
  where status in ('pending', 'in_progress', 'stale');

create index qualification_sessions_source_variant_idx
  on public.qualification_sessions (
    source_page_id,
    source_block_id,
    experiment_key,
    variant_key,
    created_at desc
  );

create index qualification_answers_session_idx
  on public.qualification_answers (session_id, created_at);

create index qualification_answers_lead_idx
  on public.qualification_answers (lead_submission_id, created_at desc);

create index qualification_answers_form_version_question_idx
  on public.qualification_answers (form_version_id, question_id);

create index close_sync_events_status_next_retry_idx
  on public.close_sync_events (status, next_retry_at, created_at)
  where status in ('pending', 'retrying', 'failed');

create index close_sync_events_lead_idx
  on public.close_sync_events (lead_submission_id, created_at desc);

create index close_sync_events_session_idx
  on public.close_sync_events (session_id, created_at desc);

create index close_sync_events_close_ids_idx
  on public.close_sync_events (close_lead_id, close_contact_id);

create unique index close_sync_events_dedupe_key_idx
  on public.close_sync_events (dedupe_key)
  where dedupe_key is not null;

create index lead_submissions_close_contact_id_idx
  on public.lead_submissions (close_contact_id)
  where close_contact_id is not null;

create index lead_submissions_close_lead_id_idx
  on public.lead_submissions (close_lead_id)
  where close_lead_id is not null;

create index lead_submissions_lifecycle_status_idx
  on public.lead_submissions (lifecycle_status, created_at desc);

create index lead_submissions_qualification_session_idx
  on public.lead_submissions (latest_qualification_session_id)
  where latest_qualification_session_id is not null;

create index lead_submissions_close_sync_status_idx
  on public.lead_submissions (close_sync_status, close_sync_next_retry_at)
  where close_sync_status is not null;

create trigger qualification_forms_set_updated_at
  before update on public.qualification_forms
  for each row execute function public.set_updated_at();

create trigger qualification_sessions_set_updated_at
  before update on public.qualification_sessions
  for each row execute function public.set_updated_at();

create trigger qualification_answers_set_updated_at
  before update on public.qualification_answers
  for each row execute function public.set_updated_at();

create trigger close_sync_events_set_updated_at
  before update on public.close_sync_events
  for each row execute function public.set_updated_at();

create or replace function public.prevent_qualification_form_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'qualification_form_versions are immutable once published';
end;
$$;

create trigger qualification_form_versions_prevent_update
  before update on public.qualification_form_versions
  for each row execute function public.prevent_qualification_form_version_mutation();

create trigger qualification_form_versions_prevent_delete
  before delete on public.qualification_form_versions
  for each row execute function public.prevent_qualification_form_version_mutation();

alter table public.qualification_forms enable row level security;
alter table public.qualification_form_versions enable row level security;
alter table public.qualification_sessions enable row level security;
alter table public.qualification_answers enable row level security;
alter table public.close_sync_events enable row level security;

create policy qualification_forms_admin_all
  on public.qualification_forms
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy qualification_form_versions_admin_all
  on public.qualification_form_versions
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy qualification_sessions_admin_all
  on public.qualification_sessions
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy qualification_answers_admin_all
  on public.qualification_answers
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy close_sync_events_admin_all
  on public.close_sync_events
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
