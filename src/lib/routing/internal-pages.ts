/**
 * Internal test pages that exist for the team on preview and local builds and
 * must not answer on the public domain: the staging page index and the
 * "form -> Calendly" demo. Both stay reachable everywhere except production.
 */
const INTERNAL_PAGE_PATHS: ReadonlySet<string> = new Set([
  "/qa-links",
  "/demo/book-a-call",
]);

/** True on the production deployment (Vercel sets VERCEL_ENV per deploy). */
export function isProductionDeployment(
  env: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return env === "production";
}

/**
 * True when `pathname` is an internal test page and this is production. The
 * proxy uses it to return a real 404 (a page-level notFound() streams as 200
 * under the root loading.tsx boundary); the pages call it as a second guard.
 */
export function isHiddenInternalPage(
  pathname: string,
  env: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return isProductionDeployment(env) && INTERNAL_PAGE_PATHS.has(pathname);
}
