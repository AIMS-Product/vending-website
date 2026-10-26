-- Apple Wallet pass web service: which iPhones hold which webinar pass, so the
-- reminder cron can tell them to refresh. No PII: the serial is
-- vp_<room start ms>_<GHL contact id>, the push token is Apple's opaque token.
-- Written only by server code with the service role; RLS on with no policies.
create table if not exists public.apple_wallet_registrations (
  device_library_id text not null,
  serial_number text not null,
  push_token text not null,
  room_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (device_library_id, serial_number)
);

create index if not exists apple_wallet_registrations_room_start_idx
  on public.apple_wallet_registrations (room_start);

alter table public.apple_wallet_registrations enable row level security;
