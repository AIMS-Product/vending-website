import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { staticRoutes } from "@/lib/content/site-routes";
import {
  listIndexableProcessSlugs,
  processSectionIsHeldBack,
} from "@/lib/content/process";
import { listIndexableSolutionSlugs } from "@/lib/content/solutions";
import { listPublishedSlugs } from "@/lib/services/news";
import { listPublishedCaseStudySlugs } from "@/lib/services/case-studies";
import { listSitemapSeoPages } from "@/lib/services/seo-page-public";

export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified only where a real edit date exists (/resources pages).
  // Stamping every URL with the request time taught Google to ignore it.
  const now = new Date();
  // One failed content read must not 500 the whole sitemap for crawlers:
  // log it and drop only that source; static routes always go out.
  const [news, caseStudies, seoPages] = await Promise.allSettled([
    listPublishedSlugs(),
    listPublishedCaseStudySlugs(),
    listSitemapSeoPages(),
  ]);
  const slugs = valueOrEmpty("news", news);
  const caseStudySlugs = valueOrEmpty("case-studies", caseStudies);
  const resourcePages = valueOrEmpty("seo-pages", seoPages);

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...slugs.map((slug) => ({
      url: absoluteUrl(`/news/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...caseStudySlugs.map((slug) => ({
      url: absoluteUrl(`/case-studies/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...listIndexableSolutionSlugs().map((slug) => ({
      url: absoluteUrl(`/solutions/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // The /process index lives here rather than in `staticRoutes`: that list
    // also feeds the chatbot's route map, and a section held back from search
    // should not be recommended in chat either.
    ...(processSectionIsHeldBack
      ? []
      : [
          {
            url: absoluteUrl("/process"),
            changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        ]),
    ...listIndexableProcessSlugs().map((slug) => ({
      url: absoluteUrl(`/process/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...resourcePages.map((page) => ({
      url: absoluteUrl(page.route_path),
      lastModified: validDateOrFallback(page.updated_at, now),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

function validDateOrFallback(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function valueOrEmpty<T>(source: string, result: PromiseSettledResult<T[]>) {
  if (result.status === "fulfilled") return result.value;
  console.error(
    `sitemap: ${source} read failed, omitting its URLs`,
    result.reason,
  );
  return [];
}
