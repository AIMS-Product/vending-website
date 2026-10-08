-- Instagram DM history, backfilled from ManyChat and joined to Close leads.
--
-- ManyChat cannot list its contacts and its Instagram contacts carry no email
-- or phone, so history is rebuilt one lead at a time
-- (scripts/manychat-backfill.mjs): each Close lead on an Instagram funnel, or
-- who booked through a setter's DM link, is looked up by the ManyChat id in
-- that link and by name, and every candidate is scored on independent
-- evidence (scripts/lib/manychat-match.mjs).
--
-- Every outcome is stored, not just the good ones, so the audit can see what
-- was left out and why. Readers count `level = 'confirmed'` only; anything
-- else is shown as unmatched, never as a DM.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- manychat_events.

create table if not exists public.manychat_contacts (
  account             text not null check (account in ('mike', 'anthony')),
  subscriber_id       text not null,
  ig_username         text,
  name                text,
  subscribed_at       timestamptz,
  last_interaction_at timestamptz,
  -- The keyword the contact commented or DM'd (Mike's OptinKeyword field).
  optin_keyword       text,
  tags                jsonb not null default '[]'::jsonb,
  custom_fields       jsonb not null default '[]'::jsonb,
  fetched_at          timestamptz not null default now(),
  primary key (account, subscriber_id)
);

create table if not exists public.manychat_lead_matches (
  close_lead_id   text primary key,
  level           text not null check (level in (
                    'confirmed', 'single', 'ambiguous', 'conflict', 'after')),
  -- Null unless one contact was picked (confirmed or single).
  account         text check (account in ('mike', 'anthony')),
  subscriber_id   text,
  -- Evidence on the picked contact: link, name, handle, tag.
  signals         text[] not null default '{}',
  -- Every candidate considered, with its own evidence and level.
  candidates      jsonb not null default '[]'::jsonb,
  -- Bumped when the rules in manychat-match.mjs change, so old rows can be redone.
  rules_version   int not null,
  matched_at      timestamptz not null default now(),
  check ((level in ('confirmed', 'single')) = (subscriber_id is not null))
);

create index if not exists manychat_lead_matches_confirmed_idx
  on public.manychat_lead_matches (account, subscriber_id)
  where level = 'confirmed';

alter table public.manychat_contacts enable row level security;
alter table public.manychat_lead_matches enable row level security;

comment on table public.manychat_contacts is
  'ManyChat contacts per Instagram account, fetched by the backfill for Close leads. Service-role only.';
comment on table public.manychat_lead_matches is
  'Close lead -> ManyChat contact, with evidence. Count level = confirmed only; other levels are kept for audit.';
