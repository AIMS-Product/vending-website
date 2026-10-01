-- Let the outbox carry "subscribe this lead to the Kit newsletter".
-- Full list, so applying this alone is enough whether or not 20260922120000
-- (ghl_forward) was ever run. Safe to run twice.
--
-- NOT YET APPLIED. Until it is, queueKitSubscribe's insert violates the CHECK
-- and is swallowed (logged): signups still save, they just do not reach Kit.

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
      'ghl_forward',
      'kit_subscribe'
    )
  );
