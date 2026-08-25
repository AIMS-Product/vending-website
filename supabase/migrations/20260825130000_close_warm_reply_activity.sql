-- No-book follow-up SLA: allow the outbox to carry a "log an incoming email
-- activity on the Close lead" job.
--
-- Why an activity and not a tag or a custom field: Stephen's smart list
-- "L2 - Warm Reply - TODAY" is a saved search, not a container. Nothing can be
-- pushed into it. It matches leads that have an SMS, Email or Call activity
-- with Direction = Incoming created within one day. A website form or chatbot
-- capture creates a Close lead and contact and logs NO activity, which is
-- exactly why our leads have never appeared there. Only an activity can fix it.
--
-- Direction is not a writable field on Close's POST /activity/email/. It is
-- derived from `status`: `inbox` yields `direction: "incoming"`. See
-- src/lib/close/warm-reply-activity.ts.
--
-- NOT YET APPLIED. Run this in the Supabase SQL editor before setting
-- CLOSE_WARM_REPLY_ACTIVITY_ENABLED=true. Until it is applied, the insert would
-- violate the CHECK below, so the enqueue is gated on that flag AND swallows
-- its own errors: a lead submit must never fail over a follow-up job.

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
      'warm_reply_activity'
    )
  );
