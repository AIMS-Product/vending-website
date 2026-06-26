import type { AttributionSession } from "@/lib/attribution-session";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { legacyLeadRoutes } from "@/lib/content/legacy-routes";

export type LeadAttributionLinkContext = {
  sourcePath?: string | null;
  sourcePageId?: string | null;
  sourcePageSlug?: string | null;
  targetKeyword?: string | null;
  sourceBlockId?: string | null;
  sourceCtaTrackingName?: string | null;
  clickedHref?: string | null;
};

const LEGACY_LEAD_PATHS = new Set(legacyLeadRoutes.map((route) => route.path));
const LEAD_DESTINATION_PREFIXES = ["/apply", "/contact", "/qualify"] as const;

const LINK_ATTRIBUTION_FIELDS = [
  "vp_session_id",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "paid_platform",
  "paid_source_key",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_group_id",
  "ad_group_name",
  "group_id",
  "group_name",
  "ad_id",
  "ad_name",
] as const;

export function shouldPreserveLeadAttribution(href: string) {
  const parsed = parseInternalHref(href);
  if (!parsed) return false;
  if (parsed.url.pathname === "/" || parsed.url.pathname.startsWith("/admin")) {
    return false;
  }
  if (LEGACY_LEAD_PATHS.has(parsed.url.pathname as `/${string}`)) return true;
  return LEAD_DESTINATION_PREFIXES.some(
    (prefix) =>
      parsed.url.pathname === prefix ||
      parsed.url.pathname.startsWith(`${prefix}/`),
  );
}

export function appendLeadAttributionToHref({
  href,
  attribution,
  context,
}: {
  href: string;
  attribution?: LeadAttribution | null;
  context?: LeadAttributionLinkContext;
}) {
  const parsed = parseInternalHref(href);
  if (!parsed || !shouldPreserveLeadAttribution(href)) return href;

  for (const field of LINK_ATTRIBUTION_FIELDS) {
    const value = attribution?.[field];
    if (value && !parsed.url.searchParams.has(field)) {
      parsed.url.searchParams.set(field, value);
    }
  }
  appendContext(parsed.url, context);
  return serializeInternalHref(parsed.url);
}

export function appendSessionClickAttributionToHref({
  href,
  session,
  context,
}: {
  href: string;
  session?: AttributionSession | null;
  context?: LeadAttributionLinkContext;
}) {
  const parsed = parseInternalHref(href);
  if (!parsed || !shouldPreserveLeadAttribution(href)) return href;

  if (session?.vp_session_id) {
    parsed.url.searchParams.set("vp_session_id", session.vp_session_id);
  }
  appendContext(parsed.url, {
    ...context,
    clickedHref: context?.clickedHref ?? href,
  });
  return serializeInternalHref(parsed.url);
}

function appendContext(url: URL, context?: LeadAttributionLinkContext) {
  setParam(url, "source_path", context?.sourcePath);
  setParam(url, "source_page_id", context?.sourcePageId);
  setParam(url, "source_page_slug", context?.sourcePageSlug);
  setParam(url, "target_keyword", context?.targetKeyword);
  setParam(url, "source_block_id", context?.sourceBlockId);
  setParam(url, "source_cta_tracking_name", context?.sourceCtaTrackingName);
  setParam(url, "clicked_href", context?.clickedHref);
}

function setParam(url: URL, key: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) url.searchParams.set(key, trimmed);
}

function parseInternalHref(href: string) {
  if (!href || href.startsWith("#")) return null;
  try {
    const url = new URL(href, "https://vendingpreneurs.local");
    if (url.origin !== "https://vendingpreneurs.local") return null;
    return { url };
  } catch {
    return null;
  }
}

function serializeInternalHref(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}
