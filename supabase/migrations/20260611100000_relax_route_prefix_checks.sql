-- S6b (issue I6/R3-2): relax the route-prefix CHECK constraints from a
-- hardcoded five-prefix allowlist to shape-only checks, so pages and
-- redirects published under admin-configured custom prefixes (stored in
-- page_builder_route_prefixes, added in 20260611090000) can persist.
--
-- Non-destructive by construction: each statement only drops and recreates a
-- CHECK constraint with a strictly weaker predicate.
--   * Old seo_pages_route_prefix_check allowed exactly the five defaults —
--     all of which match '^/[a-z0-9]+(-[a-z0-9]+)*$'.
--   * Old seo_pages_route_path_check required '^/(five)/[a-z0-9]+(-[a-z0-9]+)*'
--     — a subset of the new shape with the alternation replaced by the same
--     prefix shape.
--   * Old redirects_source_path_check required '^/(five)/[^?#]+' — likewise a
--     subset of the new shape.
-- Every existing row that satisfied the old constraint therefore satisfies
-- the new one, so ADD CONSTRAINT revalidation cannot fail and no data is
-- touched. Membership in the configured prefix list is enforced app-side
-- (admin actions look up page_builder_route_prefixes before any write).

alter table public.seo_pages
  drop constraint if exists seo_pages_route_prefix_check,
  add constraint seo_pages_route_prefix_check
    check (route_prefix ~ '^/[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.seo_pages
  drop constraint if exists seo_pages_route_path_check,
  add constraint seo_pages_route_path_check
    check (route_path ~ '^/[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*');

alter table public.redirects
  drop constraint if exists redirects_source_path_check,
  add constraint redirects_source_path_check
    check (source_path ~ '^/[a-z0-9]+(-[a-z0-9]+)*/[^?#]+');

comment on constraint seo_pages_route_prefix_check on public.seo_pages is
  'Shape-only: one lowercase kebab-case segment. Allowed prefixes are governed by page_builder_route_prefixes.';

comment on constraint seo_pages_route_path_check on public.seo_pages is
  'Shape-only: /{prefix}/{slug} in lowercase kebab-case. Prefix membership is enforced app-side.';

comment on constraint redirects_source_path_check on public.redirects is
  'Shape-only: /{prefix}/{rest} where prefix is lowercase kebab-case. Prefix membership is enforced app-side.';
