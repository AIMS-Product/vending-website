import { flattenBlocks } from "@/lib/page-builder/blocks";
import { parseStructuredDataSettings } from "@/lib/page-builder/structured-data-settings";
import { pagePathForSlug } from "@/lib/page-builder/page-paths";
import { absoluteUrl } from "@/lib/site";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

export function buildResourcePageStructuredDataGraphs(page: PublishedSeoPage) {
  const settings = parseStructuredDataSettings(page.structured_data_settings);
  const blocks = flattenBlocks(page.published_content);
  const routePrefix = page.route_prefix || "/resources";
  const routePath = page.route_path || pagePathForSlug(page.slug, routePrefix);
  const faqItems = blocks.flatMap((block) =>
    block.type === "faq"
      ? block.props.items.filter((item) => item.question && item.answer)
      : [],
  );
  const graphs: unknown[] = [];

  if (settings.breadcrumb) {
    graphs.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: routePrefixBreadcrumbName(routePrefix),
          item: absoluteUrl(routePrefix),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: page.title,
          item: absoluteUrl(routePath),
        },
      ],
    });
  }

  if (settings.faq && faqItems.length > 0) {
    graphs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return graphs;
}

const routePrefixLabels: Record<string, string> = {
  "/blog": "Blog",
  "/landing": "Landing Pages",
  "/resources": "Resources",
  "/solutions": "Solutions",
  "/videos": "Videos",
};

function routePrefixBreadcrumbName(routePrefix: string) {
  return (
    routePrefixLabels[routePrefix] ??
    routePrefix
      .replace(/^\//, "")
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}
