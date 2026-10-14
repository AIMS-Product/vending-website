-- Funnel and owner on every registry link, so the UTM master sheet can retire.
--
-- The funnel belongs to the link, not to its utm_source: the same `newsletter`
-- source sends people to the Internal Webinar on one link and the VSL on
-- another. Values come from Close's "Funnel Name DEAL (Opp)" choices
-- (src/lib/analytics/funnel-names.ts); the app validates, the column stays text
-- so a new Close choice never needs a migration.
--
-- funnel_set_by records who decided: an admin email, `sheet` (the old Google
-- Sheet), `close` (what Close recorded for the people the link brought in) or
-- `rule` (youtube -> YouTube, google cpc -> Google Ads).
alter table public.marketing_links
  add column if not exists funnel_name text,
  add column if not exists funnel_set_by text,
  add column if not exists owner text;

create index if not exists marketing_links_funnel_idx
  on public.marketing_links (funnel_name);

comment on column public.marketing_links.funnel_name is
  'Close Funnel Name this link feeds (Internal Webinar, VSL, Meta Ads, ...). Null = not yet assigned.';
comment on column public.marketing_links.owner is
  'Whose link it is (Mike, Anthony, a setter). Free text.';
