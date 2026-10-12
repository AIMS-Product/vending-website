-- Dom's Close fields (2026-10-08/11): who booked the call and how the lead
-- entered, so Lane 2 is read from "Booked By", not inferred from the funnel.
alter table public.close_lead_funnel
  add column if not exists booked_by text,
  add column if not exists entry_source text,
  add column if not exists latest_sales_call_booked_date date;

create index if not exists close_lead_funnel_booked_by_idx
  on public.close_lead_funnel (booked_by, first_sales_call_booked_date);
