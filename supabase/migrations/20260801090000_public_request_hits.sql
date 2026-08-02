-- Rate limiting for the public, unauthenticated entry points (lead forms,
-- qualification intake, attribution events).
--
-- One row per accepted attempt. The limiter counts rows in a short sliding
-- window for the same IP or the same email, so a flood from one source is
-- capped whether the attacker varies the address or the network path.
--
-- RETENTION: rows are deleted 24 hours after they are written. Nothing here is
-- used for analytics — a request older than the longest window (10 minutes)
-- can never affect a decision, and the extra day exists only so an abuse
-- report can be investigated the next morning. The Close sync cron
-- (`/api/admin/close-sync/run`, every 2 minutes) does the pruning; there is no
-- separate scheduled job to configure.
--
-- PII: `ip` is a request IP and `email_hash` is a SHA-256 of the lowercased
-- submitted address, never the address itself. The table therefore holds no
-- readable contact details.
--
-- NOT YET APPLIED. Run this in the Supabase SQL editor before the limiter can
-- do anything — `checkPublicRateLimit` fails open, so until then every request
-- is allowed exactly as it is today.

create table if not exists public.public_request_hits (
  id bigserial primary key,
  action text not null,
  ip text,
  email_hash text,
  occurred_at timestamptz not null default now()
);

-- The limiter's only read: recent rows for one action, filtered to an IP or an
-- email hash. The prune deletes by occurred_at, which this also serves.
create index if not exists public_request_hits_action_occurred_at_idx
  on public.public_request_hits (action, occurred_at desc);
create index if not exists public_request_hits_ip_idx
  on public.public_request_hits (ip, occurred_at desc)
  where ip is not null;
create index if not exists public_request_hits_email_hash_idx
  on public.public_request_hits (email_hash, occurred_at desc)
  where email_hash is not null;

-- Written and read only by the service role, same as close_sync_events. RLS on
-- with no policies means no anon or authenticated client can reach it at all.
alter table public.public_request_hits enable row level security;

comment on table public.public_request_hits is
  'Sliding-window rate-limit counters for public lead endpoints. Pruned to 24 hours by the Close sync cron.';
