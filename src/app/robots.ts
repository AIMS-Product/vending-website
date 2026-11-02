import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        // Filter combinations (57,200 of them) and CTA attribution URLs are the
        // same page as their canonical. Without this they eat the crawl budget.
        "/case-studies?",
        "/contact?*source_path=",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
