import { cache } from "react";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";

/**
 * Per-request memoisation for the builder catch-all. `generateMetadata` and the
 * page component both resolve the route prefix list and the published page for
 * the same URL; React `cache()` makes the second call reuse the first's read
 * within one render pass. It never outlives the request, so nothing can go
 * stale.
 */
export const listRoutePrefixesOnce = cache(() => listRoutePrefixes());

export const getPublishedSeoPageByPathOnce = cache((routePath: string) =>
  getPublishedSeoPageByPath(routePath),
);
