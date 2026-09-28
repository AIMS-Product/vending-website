-- SEO command center, slices 4 and 5: the 63-piece content plan and the task
-- system Kody's 7 triggers write into.
--
-- A piece counts as published when a /resources/{slug} page is live in the
-- page builder; that is read at display time, so `status` here only tracks
-- the stages before it (and refreshing after). Service-role only.

create table if not exists public.seo_content_pieces (
  id                text primary key,
  hub               integer not null check (hub between 1 and 7),
  title             text not null,
  slug              text not null,
  primary_keyword   text not null,
  priority          text not null default 'P3'
    check (priority in ('P1', 'P2', 'P3')),
  sequence_week     integer,
  status            text not null default 'planned'
    check (status in ('planned', 'drafting', 'in_review', 'verify_needed',
                      'scheduled', 'published', 'refreshing')),
  draft_file        text,
  verify_flags      integer not null default 0,
  word_count        integer,
  last_refreshed_at timestamptz,
  notes             text,
  updated_at        timestamptz not null default now()
);

create index if not exists seo_content_pieces_slug_idx
  on public.seo_content_pieces (slug);

create table if not exists public.seo_tasks (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
    check (type in ('publish', 'refresh', 'optimize_ctr', 'add_links',
                    'aeo_pairing', 'verify_facts', 'technical', 'outreach',
                    'roadmap', 'optimize')),
  piece_id    text,
  url         text,
  -- The keyword or query a trigger fired on, when it fired on one.
  subject     text,
  title       text not null,
  detail      text,
  trigger_code integer check (trigger_code between 1 and 7),
  evidence    jsonb not null default '{}'::jsonb,
  priority    text not null default 'medium'
    check (priority in ('urgent', 'high', 'medium', 'low')),
  -- Roadmap phase for type = 'roadmap' (Foundation, Content engine, ...).
  phase       text,
  owner       text,
  due_date    date,
  status      text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'dismissed')),
  created_by  text not null default 'user'
    check (created_by in ('system', 'user', 'seed')),
  -- Search Console numbers for the page when the task was marked done, and
  -- 14 and 28 days after, filled by the weekly trigger job.
  metrics_at_done jsonb,
  metrics_after_14 jsonb,
  metrics_after_28 jsonb,
  seed_key    text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz,
  constraint seo_tasks_title_len check (length(title) <= 300)
);

-- One open task per trigger per page or keyword: the weekly job updates the
-- evidence on it instead of opening a duplicate.
create unique index if not exists seo_tasks_open_trigger_idx
  on public.seo_tasks (trigger_code, coalesce(url, ''), coalesce(subject, ''))
  where trigger_code is not null and status in ('open', 'in_progress');

create index if not exists seo_tasks_status_idx
  on public.seo_tasks (status, due_date);

alter table public.seo_content_pieces enable row level security;
alter table public.seo_tasks enable row level security;
