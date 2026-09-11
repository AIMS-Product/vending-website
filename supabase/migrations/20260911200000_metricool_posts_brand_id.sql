-- Which Metricool brand (blogId) reported the post. The account has three
-- brands (Vendingpreneurs, Mike Hoffmann, Anthony Kolodziej); the person
-- brands write owner-prefixed sources (mike-ig, anthony-li) into the spine.
-- Null on rows written before brands were tracked.
alter table public.metricool_posts
  add column if not exists brand_id text;

comment on column public.metricool_posts.brand_id is
  'Metricool blogId that reported the post. Vendingpreneurs 6626386, Mike 6633336, Anthony 6633345.';
