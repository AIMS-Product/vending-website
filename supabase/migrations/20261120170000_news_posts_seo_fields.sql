-- SEO title and meta description per news post (Unlimited Content SEO doc,
-- item 2). Additive and nullable: existing rows keep NULL and the site falls
-- back to the post title and a trimmed excerpt. Lengths (60 / 160) are
-- enforced in the admin editor, not here.
alter table public.news_posts
  add column if not exists seo_title text,
  add column if not exists meta_description text;
