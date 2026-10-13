-- The company MTD dashboard's population (2026-10-13): it counts only leads
-- owned by the Lane 1 roster and leaves out other brands' leads. Mirroring
-- both fields lets us show the same cut and prove it matches.
alter table public.close_lead_funnel
  add column if not exists lead_owner text,
  add column if not exists business_line text;
