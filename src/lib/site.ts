import type { Metadata } from "next";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "https://www.vendingpreneurs.com"
).replace(/\/$/, "");

export const siteName = "Vendingpreneurs";

export const siteDescription =
  "Mentorship, tools, and exclusive discounts to launch and scale a profitable vending machine business.";

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}

/**
 * Open Graph block for a static marketing page. Next merges metadata
 * shallowly, so a page that sets only `title` inherits the layout's
 * `openGraph` unchanged and every share unfurls as the homepage. Each page
 * passes its own title, description and canonical path so `og:url` and
 * `og:title` match the page being shared. The image comes from
 * `app/opengraph-image.png`.
 */
export function pageOpenGraph(
  title: string,
  description: string,
  path: string,
): NonNullable<Metadata["openGraph"]> {
  return {
    title,
    description,
    siteName,
    url: path,
    type: "website",
  };
}
