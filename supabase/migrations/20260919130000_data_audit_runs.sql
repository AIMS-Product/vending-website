-- The nightly self-audit's record. One row per check per run: what we stored,
-- what the source system said, and the verdict. Kept as history so a number
-- that starts drifting is visible on the day it starts, not a month later.
create table if not exists public.data_audit_runs (
  id           bigserial primary key,
  run_at       timestamptz not null default now(),
  check_id     text not null,
  label        text not null,
  window_label text not null,
  source_name  text not null,
  -- Null where the check asserts rather than compares, or where a side
  -- reported nothing. Never zero-filled: not observed is not zero.
  ours         numeric,
  source       numeric,
  diff_pct     numeric,
  status       text not null
    check (status in ('pass', 'warn', 'fail', 'skipped', 'error')),
  detail       text not null
);

create index if not exists data_audit_runs_run_at_idx
  on public.data_audit_runs (run_at desc);

create index if not exists data_audit_runs_check_idx
  on public.data_audit_runs (check_id, run_at desc);

alter table public.data_audit_runs enable row level security;

comment on table public.data_audit_runs is
  'One row per data-audit check per run. status fail = a stored number disagrees with its source system; skipped/error = the source could not be reached, which is never treated as agreement.';
