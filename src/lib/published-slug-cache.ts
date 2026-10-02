import {
  hasPublishedCaseStudySlug,
  listPublishedCaseStudySlugs,
} from "@/lib/services/case-studies";
import { hasPublishedPostSlug, listPublishedSlugs } from "@/lib/services/news";
import {
  hasPublishedSeoPagePath,
  listPublishedSeoPageRoutePaths,
} from "@/lib/services/seo-page-public";

/**
 * Short-lived "this slug is published" sets for the proxy.
 *
 * The proxy runs before the CDN cache, so a per-request existence query put a
 * Supabase round trip in front of every prerendered /news, /case-studies and
 * /resources view. Published keys are loaded whole (one column, one query) and
 * checked in memory for TTL_MS.
 *
 * Only POSITIVE answers are served from memory. A key that is not in the set
 * always falls through to the original per-key query, so a page published a
 * moment ago is never 404'd by a stale set, and every 404 decision and error
 * path (news: false, case studies: fail open, builder pages: throw) is
 * byte-identical to the uncached check. The one staleness is an unpublished
 * page still passing the proxy for up to TTL_MS, the same window the ISR page
 * itself (`revalidate = 60`) is already served from.
 */
const TTL_MS = 60_000;

type KeySet = { expiresAt: number; keys: Set<string> };

export type PublishedKeyCheck = {
  has: (key: string, now?: number) => Promise<boolean>;
  reset: () => void;
};

export function createPublishedKeyCheck(
  loadPublishedKeys: () => Promise<string[]>,
  checkOne: (key: string) => Promise<boolean>,
): PublishedKeyCheck {
  let cache: KeySet | null = null;
  let inflight: Promise<KeySet> | null = null;

  async function load(now: number): Promise<KeySet> {
    try {
      const keys = new Set(await loadPublishedKeys());
      return { expiresAt: now + TTL_MS, keys };
    } catch (error) {
      // Never fatal: an empty set just means every key takes the direct query.
      console.error("published key set load failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return { expiresAt: now + TTL_MS, keys: new Set() };
    }
  }

  async function currentSet(now: number): Promise<KeySet> {
    if (cache && cache.expiresAt > now) return cache;
    // Share one load between concurrent requests on a cold or expired set.
    inflight ??= load(now)
      .then((fresh) => {
        cache = fresh;
        return fresh;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return {
    async has(key, now = Date.now()) {
      const set = await currentSet(now);
      if (set.keys.has(key)) return true;
      return checkOne(key);
    },
    reset() {
      cache = null;
      inflight = null;
    },
  };
}

const newsSlugs = createPublishedKeyCheck(
  listPublishedSlugs,
  hasPublishedPostSlug,
);
const caseStudySlugs = createPublishedKeyCheck(
  listPublishedCaseStudySlugs,
  hasPublishedCaseStudySlug,
);
const seoPagePaths = createPublishedKeyCheck(
  listPublishedSeoPageRoutePaths,
  hasPublishedSeoPagePath,
);

export const hasPublishedPostSlugCached = (slug: string) => newsSlugs.has(slug);
export const hasPublishedCaseStudySlugCached = (slug: string) =>
  caseStudySlugs.has(slug);
export const hasPublishedSeoPagePathCached = (routePath: string) =>
  seoPagePaths.has(routePath);

/** Test seam. */
export function resetPublishedSlugCaches() {
  newsSlugs.reset();
  caseStudySlugs.reset();
  seoPagePaths.reset();
}
