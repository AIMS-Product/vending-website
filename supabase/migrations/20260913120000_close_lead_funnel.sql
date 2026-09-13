-- Every Close lead that has ever had a first sales call booked, on the exact
-- definition the company's Q4 plan uses: Close custom field "First Sales Call
-- Booked Date", grouped by "Funnel Name DEAL (Opp)". One row per lead, first
-- call only, cancellations included, follow-ups and rebookings excluded.
--
-- This is the booked-call basis the CEO's channel targets are written on, and
-- until now the only place it existed was Databricks (SteelTrap), whose gold
-- projection can lag by days. The dashboard reads Close directly with the same
-- fields so the daily number is fresh, and the monthly totals are checked
-- against SteelTrap so the two never disagree without someone noticing.
--
-- Show-up, status, setter and disposition ride along because they are the
-- outcome side of the same call, and Close carries them for ~90% of booked
-- calls where our own lead table carries them for a third.
create table if not exists public.close_lead_funnel (
  lead_id text primary key,
  display_name text,
  email text,
  funnel text,
  lead_source text,
  marketing_source_type text,
  sales_team_lane text,
  first_sales_call_booked_date date,
  first_call_show_up text,
  status_label text,
  qualified text,
  setter_name text,
  call_disposition text,
  lead_created_at timestamptz,
  lead_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists close_lead_funnel_booked_date_idx
  on public.close_lead_funnel (first_sales_call_booked_date);

create index if not exists close_lead_funnel_funnel_booked_idx
  on public.close_lead_funnel (funnel, first_sales_call_booked_date);

-- Service role only, like every other mirror table: the admin reads it
-- through server code and nothing on the public site touches it.
alter table public.close_lead_funnel enable row level security;

comment on table public.close_lead_funnel is
  'Mirror of Close leads with a First Sales Call Booked Date. One row per lead; the booked-call basis for channel targets. Refreshed hourly by /api/admin/close-lead-funnel-sync/run.';
comment on column public.close_lead_funnel.first_sales_call_booked_date is
  'Close custom field "First Sales Call Booked Date". The lead''s first sales call, whether or not it later cancelled.';
comment on column public.close_lead_funnel.funnel is
  'Close custom field "Funnel Name DEAL (Opp)": Reactivation Scrapers, Internal Webinar, YouTube, Instagram, Website, ...';
comment on column public.close_lead_funnel.first_call_show_up is
  'Close custom field "First Call Show Up (Opp)": Yes, No, or null when nobody logged it.';
