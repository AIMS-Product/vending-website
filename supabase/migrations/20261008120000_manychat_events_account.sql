-- ManyChat runs one page per Instagram account (Mike, Anthony), each with its
-- own API key. Events carry the account so enrichment uses the right key and
-- the Instagram DM funnel splits per account. Every row before this migration
-- came from Mike's page (the only key that existed), hence the default.
-- Subscriber ids are page-scoped (one person on both pages has two ids), so
-- the primary key is unchanged.
alter table public.manychat_events
  add column if not exists account text not null default 'mike'
    check (account in ('mike', 'anthony'));

create index if not exists manychat_events_day_account_idx
  on public.manychat_events (day, account);
