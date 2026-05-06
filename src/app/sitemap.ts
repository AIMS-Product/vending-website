import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { listPublishedSlugs } from "@/lib/services/news";
import { listSitemapSeoPages } from "@/lib/services/seo-page-public";

const staticRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/case-studies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/news", priority: 0.7, changeFrequency: "weekly" },
  { path: "/apply", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
] as const;

export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [slugs, resourcePages] = await Promise.all([
    listPublishedSlugs(),
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
    ...resourcePages.map((page) => ({
      url: absoluteUrl(`/resources/${page.slug}`),
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
