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

/** The 1200x630 brand card served from `app/opengraph-image.png`. */
export const defaultOgImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: siteName,
} as const;

/**
 * Open Graph block for a static marketing page. Next merges metadata
 * shallowly, so a page that sets only `title` inherits the layout's
 * `openGraph` unchanged and every share unfurls as the homepage. Each page
 * passes its own title, description and canonical path so `og:url` and
 * `og:title` match the page being shared.
 *
 * `images` is explicit on purpose: the file-based `opengraph-image.png`
 * attaches only to routes that inherit the layout's openGraph, so a page that
 * sets its own openGraph would otherwise ship with no og:image at all.
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
    images: [defaultOgImage],
  };
}
