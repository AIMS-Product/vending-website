-- $5 Playbook report: a 100% off promo order (code PLAYBOOKTEST) is not a buyer.
-- Before this, the two $0 test orders from 10-20 showed as "Paid buyers" and
-- inflated conversion. Buyers, revenue and downloads now count orders that
-- charged money; $0 orders get their own column (appended: a view can only
-- gain columns at the end). Delivery failures still count every paid order.
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
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as buyers,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'refunded' and o.amount_cents > 0) as refunds,
  (select coalesce(sum(o.amount_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as gross_cents,
  (select coalesce(sum(o.fee_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as fee_cents,
  (select coalesce(sum(o.refunded_cents), 0) from public.ltf_orders o) as refunded_cents,
  (select coalesce(sum(o.payment_failures), 0) from public.ltf_orders o) as payment_failures,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and o.delivery_status = 'failed') as delivery_failures,
  (select count(*) from public.ltf_orders o
     where o.download_count > 0 and o.amount_cents > 0) as buyers_downloaded,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and coalesce(o.amount_cents, 0) = 0) as free_orders;
