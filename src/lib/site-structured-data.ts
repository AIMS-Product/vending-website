import { absoluteUrl } from "@/lib/site";
import { socialLinks } from "@/lib/content/nav";
import { applyVsl } from "@/lib/content/apply-page";

/**
 * Sitewide Organization + WebSite JSON-LD, rendered once from the root
 * layout. This is the machine-readable entity anchor behind Knowledge Panel,
 * logo-in-search, and AI-answer citations.
 *
 * Deliberately absent (2026-08-31 SEO audit, reports/seo-audit-2026-08-31/):
 *   - contactPoint: the support phone numbers are not published anywhere
 *     on-site; schema must not claim what the pages don't show.
 *   - founder/Person: the About page doesn't name the founder yet.
 *   - SearchAction: no site search exists.
 * Facebook and X are excluded from sameAs on purpose — see nav.ts.
 */
export function siteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: "Vendingpreneurs",
        url: absoluteUrl("/"),
        logo: absoluteUrl("/brand/wordmark.png"),
        sameAs: socialLinks.map((link) => link.href),
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl("/"),
        name: "Vendingpreneurs",
        publisher: { "@id": absoluteUrl("/#organization") },
      },
    ],
  };
}

export type Breadcrumb = { name: string; path: string };

/** BreadcrumbList for a content page: pass crumbs root-first, current page last. */
export function breadcrumbStructuredData(crumbs: readonly Breadcrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map(
      (crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      }),
    ),
  };
}

/**
 * VideoObject for the founder VSL on /contact (the one indexable page that
 * renders it — /book-now and the booking-* variants are noindex).
 */
export function applyVslStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${applyVsl.watchLabel} — Vendingpreneurs`,
    description: applyVsl.caption[0].text,
    thumbnailUrl: [
      `https://i.ytimg.com/vi/${applyVsl.youtubeId}/maxresdefault.jpg`,
    ],
    uploadDate: applyVsl.publishedAt,
    embedUrl: `https://www.youtube-nocookie.com/embed/${applyVsl.youtubeId}`,
    contentUrl: `https://www.youtube.com/watch?v=${applyVsl.youtubeId}`,
    url: absoluteUrl("/contact"),
    publisher: {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: "Vendingpreneurs",
      url: absoluteUrl("/"),
    },
  };
}
