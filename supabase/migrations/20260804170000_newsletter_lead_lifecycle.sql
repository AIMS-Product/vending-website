-- Newsletter subscribers are captured contacts, not sales-qualified leads.
-- Add explicit lifecycle/event values so reporting and Close sync preserve
-- that distinction. Existing rows and values remain valid.

alter table public.lead_submissions
  drop constraint if exists lead_submissions_lifecycle_status_check;

alter table public.lead_submissions
  add constraint lead_submissions_lifecycle_status_check
  check (
    lifecycle_status in (
      'contact_captured',
      'qualification_pending',
      'qualification_stale',
      'qualified',
      'qualification_expired',
      'newsletter_subscribed'
    )
  );

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
      'manual_retry'
    )
  );
