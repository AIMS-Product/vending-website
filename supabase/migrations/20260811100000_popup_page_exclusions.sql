-- Popup page targeting gains an exclusion list and an explicit homepage
-- decision (Kody, 2026-08-11).
--
-- Why the homepage needs its own columns: targeting matches with
-- `pathname.includes(pattern)`, and every path on the site contains "/". A
-- substring rule therefore cannot select the homepage or avoid it — typing "/"
-- into the include box silently matched every page. These booleans carry that
-- decision instead, and only affect the path "/".
--
-- Apply via the Management API query endpoint, never `supabase db push`
-- (remote migration history is drifted — see
-- .claude/specs/2026-08-07-popups-slice-3-admin.md).
--
-- Backwards compatible by construction: both defaults reproduce today's
-- behaviour for every existing row, so this can be applied before the deploy
-- that reads the columns.

alter table public.popups
  add column if not exists exclude_url_patterns text[] not null default '{}',
  add column if not exists include_homepage boolean not null default false,
  add column if not exists exclude_homepage boolean not null default false;

comment on column public.popups.exclude_url_patterns is
  'Path substrings this popup never shows on. Beats target_url_patterns. The /admin and conversion-surface exclusions stay in code and always win.';

comment on column public.popups.include_homepage is
  'Show on "/" even though target_url_patterns lists specific pages. Ignored when target_url_patterns is empty, which already means every page.';

comment on column public.popups.exclude_homepage is
  'Never show on "/". Beats include_homepage and an empty target_url_patterns.';
