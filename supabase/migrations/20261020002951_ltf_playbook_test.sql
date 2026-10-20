-- LTF V2: the $5 First Location Playbook, sold through Stripe Checkout on our
-- own pages (plans/ltf-v2-pdf-ab). Replaces the GHL playbook course funnel.
-- Written only by server code with the service role; RLS on with no policies
-- so anon/auth roles read nothing.

-- One row per visitor who reached the offer. The conversion denominator.
create table if not exists public.ltf_visitors (
  visitor_id uuid primary key,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  -- Link unfurlers and crawlers: tracked (so the page renders) but left out of the report.
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);

-- Funnel steps per visitor. Unique per visitor + kind so reloads count once.
create table if not exists public.ltf_events (
  visitor_id uuid not null references public.ltf_visitors (visitor_id),
  kind text not null check (kind in ('offer_view', 'checkout_start')),
  created_at timestamptz not null default now(),
  primary key (visitor_id, kind)
);

-- One row per Stripe Checkout Session.
create table if not exists public.ltf_orders (
  id uuid primary key default gen_random_uuid(),
  -- Stripe Checkout Session id (cs_...). One session = one order.
  external_id text not null unique,
  visitor_id uuid references public.ltf_visitors (visitor_id),
  utm_source text,
  utm_campaign text,
  -- Stripe hosted checkout URL while the session is open (reused on repeat clicks).
  checkout_url text,
  checkout_expires_at timestamptz,
  email text,
  name text,
  -- Collected by Stripe Checkout so the sales team can reach buyers.
  phone text,
  amount_cents integer,
  fee_cents integer,
  currency text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sending', 'sent', 'failed')),
  delivery_error text,
  -- Random download token, minted with the order. Only a paid, unrefunded order
  -- serves the PDF, so a token on an unpaid order unlocks nothing.
  access_token text not null unique,
  payment_intent_id text,
  payment_failures integer not null default 0,
  refunded_cents integer not null default 0,
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ltf_orders_visitor_idx on public.ltf_orders (visitor_id);
create index if not exists ltf_orders_payment_intent_idx on public.ltf_orders (payment_intent_id);
-- Emails are stored lower-case by the server.
create index if not exists ltf_orders_email_idx on public.ltf_orders (email);

alter table public.ltf_visitors enable row level security;
alter table public.ltf_events enable row level security;
alter table public.ltf_orders enable row level security;

-- Private bucket for the PDF. Served only through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('ltf-playbook', 'ltf-playbook', false)
on conflict (id) do nothing;

-- One-row funnel summary for /admin/analytics/ltf-test. Bots left out of visitors.
create or replace view public.ltf_report
with (security_invoker = true) as
select
  (select count(*) from public.ltf_visitors v where not v.is_bot) as visitors,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'offer_view') as offer_views,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'checkout_start') as checkout_starts,
  (select count(*) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as buyers,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'refunded') as refunds,
  (select coalesce(sum(o.amount_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as gross_cents,
  (select coalesce(sum(o.fee_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as fee_cents,
  (select coalesce(sum(o.refunded_cents), 0) from public.ltf_orders o) as refunded_cents,
  (select coalesce(sum(o.payment_failures), 0) from public.ltf_orders o) as payment_failures,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and o.delivery_status = 'failed') as delivery_failures,
  (select count(*) from public.ltf_orders o where o.download_count > 0) as buyers_downloaded;

-- Safe to re-run: adds phone if the table was created before it was added.
alter table public.ltf_orders add column if not exists phone text;
