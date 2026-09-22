-- Let the outbox carry a "forward this lead to a partner's GoHighLevel" job.
--
-- WeScale runs paid traffic for Vendingpreneurs and works the leads in their
-- own GHL sub-account. Both submit paths (services/leads.ts and
-- services/qualification-intake.ts) already enqueue here, so this queue is the
-- one place both of them share: the forward gets the existing claim/CAS,
-- backoff and dead-lettering rather than a second outbox.
--
-- A ghl_forward event never touches Close. sync.ts keeps it out of
-- writesLeadSyncState, so an outage on their side cannot mark our leads
-- close_sync_status = failed.
--
-- The list below is the full set, including warm_reply_activity from
-- 20260825130000 — applying this file alone is enough whether or not that one
-- was ever run.
--
-- NOT YET APPLIED. Run this in the Supabase SQL editor before setting
-- WESCALE_GHL_WEBHOOK_URL (or WESCALE_GHL_TOKEN). Until it is applied the
-- insert violates the CHECK below, which is why the enqueue is gated on those
-- env vars AND swallows its own errors: a lead submit must never fail over a
-- partner hand-off.

alter table public.close_sync_events
  drop constraint if exists close_sync_events_event_type_check;

alter table public.close_sync_events
  add constraint close_sync_events_event_type_check
  check (
    event_type in (
      'lead_create_or_update',
      'qualification_enrichment',
      'newsletter_enrichment',
      'stale_follow_up_task',
      'manual_retry',
      'warm_reply_activity',
      'ghl_forward'
    )
  );
