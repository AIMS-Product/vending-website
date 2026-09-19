# Waiting on a hand-applied migration

The Supabase CLI is not linked in this repo, so these run in the SQL editor
(Supabase → SQL editor → paste → Run). Both are safe to run twice.

Paste this whole block:

```sql
-- 1. Thank-you page visits (20260912110000). Without it the nightly GA4 sync
-- logs "N rows failed to write" every night and the thank-you column is blank.
alter table public.channel_daily
  add column if not exists thankyou_visits integer;

-- 2. The nightly audit's history (20260919130000). Without it the audit still
-- runs and still alerts, but the EOD/EOW email says "unverified" because it
-- cannot read the night's verdicts back.
create table if not exists public.data_audit_runs (
  id           bigserial primary key,
  run_at       timestamptz not null default now(),
  check_id     text not null,
  label        text not null,
  window_label text not null,
  source_name  text not null,
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
```

Then re-run the audit so the first verdicts are stored:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.vendingpreneurs.com/api/admin/data-audit/run
```
