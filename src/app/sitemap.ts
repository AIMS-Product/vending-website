import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { staticRoutes } from "@/lib/content/site-routes";
import { listSolutionSlugs } from "@/lib/content/solutions";
import { listPublishedSlugs } from "@/lib/services/news";
import { listPublishedCaseStudySlugs } from "@/lib/services/case-studies";
import { listSitemapSeoPages } from "@/lib/services/seo-page-public";

export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [slugs, caseStudySlugs, resourcePages] = await Promise.all([
    listPublishedSlugs(),
    listPublishedCaseStudySlugs(),
    listSitemapSeoPages(),
  ]);

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...slugs.map((slug) => ({
      url: absoluteUrl(`/news/${slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...caseStudySlugs.map((slug) => ({
      url: absoluteUrl(`/case-studies/${slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...listSolutionSlugs().map((slug) => ({
      url: absoluteUrl(`/solutions/${slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
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
