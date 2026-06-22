export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "https://www.vendingpreneurs.com"
).replace(/\/$/, "");

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
