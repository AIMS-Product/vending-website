-- Post-cutover: Studio must be able to retire ANY public URL, not only builder
-- pages. The previous shape required two segments ('/{prefix}/{rest}'), which
-- rejected exactly the common case after the Webflow migration — a retired
-- one-segment legacy URL like '/old-offer'. The insert failed on the CHECK, so
-- the redirect silently never saved.
--
-- Non-destructive by construction: the new predicate is strictly weaker. Every
-- path matching '^/[a-z0-9]+(-[a-z0-9]+)*/[^?#]+' also matches '^/[^?#]+$'
-- (both require a leading slash and forbid '?' and '#'), so ADD CONSTRAINT
-- revalidation cannot fail and no existing row is touched.
--
-- The source must still be root-relative and free of a query string or
-- fragment, since the proxy matches on pathname alone. Which paths are
-- *sensible* sources (not '/', not /admin, /auth, /api, /_next, not an asset)
-- stays enforced app-side in normalizeSourcePath, where a rejection can carry
-- an explanatory message instead of a constraint violation.

alter table public.redirects
  drop constraint if exists redirects_source_path_check,
  add constraint redirects_source_path_check
    check (source_path ~ '^/[^?#]+$');

comment on constraint redirects_source_path_check on public.redirects is
  'Shape-only: any root-relative path with no query or fragment. Which paths are valid redirect sources is enforced app-side in normalizeSourcePath.';
