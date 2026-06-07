-- Remove unused author schema after author pages and bylines were retired.

alter table public.seo_pages
  drop column if exists author_id;

alter table public.news_posts
  drop column if exists author;

drop table if exists public.page_builder_authors cascade;
