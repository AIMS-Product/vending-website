-- Thank-you page visits as a spine metric.
--
-- The funnel had no stage between "visited" and "lead": a visit that reached
-- /thank-you, /thank-you-for-applying, /your-call-is-booked or one of the
-- /resources/*-thank-you pages is an observed conversion on our own site, and
-- GA4 can report it per link. Nullable like every other metric, because only
-- the ga4-visits connector observes it and only for sessions that landed on
-- one of those pages.
--
-- This counts on-site confirmations only. A GHL-hosted form or a Calendly
-- confirmation never touches a page of ours, so a channel can have leads with
-- no thank-you visits at all; that is "not observed", not zero.
do $$
begin
  alter table public.channel_daily
    add column if not exists thankyou_visits integer
      check (thankyou_visits is null or thankyou_visits >= 0);
end
$$;
