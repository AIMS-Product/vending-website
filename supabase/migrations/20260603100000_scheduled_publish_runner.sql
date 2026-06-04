alter table public.seo_pages
  add column if not exists scheduled_publish_attempts integer not null default 0,
  add column if not exists scheduled_publish_last_attempt_at timestamptz,
  add column if not exists scheduled_publish_locked_at timestamptz;

alter table public.seo_pages
  drop constraint if exists seo_pages_scheduled_publish_attempts_check,
  add constraint seo_pages_scheduled_publish_attempts_check
    check (scheduled_publish_attempts >= 0);

create index if not exists seo_pages_scheduled_publish_due_idx
  on public.seo_pages (
    scheduled_publish_at,
    scheduled_publish_attempts,
    scheduled_publish_locked_at
  )
  where scheduled_publish_status = 'scheduled';
