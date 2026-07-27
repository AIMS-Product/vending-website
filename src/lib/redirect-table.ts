import {
  listBuilderRedirects,
  type BuilderRedirect,
} from "@/lib/services/seo-page-public";

/**
 * In-memory view of the admin-managed `redirects` table for the proxy.
 *
 * The proxy matcher admits every public path so an editor can retire any URL
 * from Studio without a deploy. Querying Supabase per request would put a round
 * trip in front of the home page and the apply funnel, so the whole table (tens
 * of rows) is cached and matched in memory instead. Fluid Compute reuses
 * instances, so a warm instance answers with zero round trips and a cold one
 * pays a single query. A newly saved redirect goes live within TTL_MS.
 */
const TTL_MS = 60_000;

type RedirectCache = {
  expiresAt: number;
  bySourcePath: Map<string, BuilderRedirect>;
};

let cache: RedirectCache | null = null;

/** Test seam — also used when a caller knows the table just changed. */
export function resetRedirectTableCache() {
  cache = null;
}

async function loadRedirects(now: number) {
  const rows = await listBuilderRedirects();
  const bySourcePath = new Map(rows.map((row) => [row.source_path, row]));
  cache = { expiresAt: now + TTL_MS, bySourcePath };
  return bySourcePath;
}

/**
 * The redirect configured for `path`, or null. A lookup failure is never fatal:
 * the site keeps serving the requested page rather than 500ing on a redirect
 * table that could not be read.
 */
export async function lookupRedirectForPath(
  path: string,
  now: number = Date.now(),
): Promise<BuilderRedirect | null> {
  try {
    const bySourcePath =
      cache && cache.expiresAt > now
        ? cache.bySourcePath
        : await loadRedirects(now);
    return bySourcePath.get(path) ?? null;
  } catch (error) {
    console.error("lookupRedirectForPath failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}
