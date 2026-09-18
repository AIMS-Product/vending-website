import { canonicalFunnelPath } from "@/lib/analytics/canonical-path";
import type { AttributionSession } from "@/lib/attribution-session";
import {
  isBookingFunnelPath,
  isFunnelChromePath,
} from "@/lib/content/booking-funnel-routes";
import { getLegacyLeadRoute } from "@/lib/content/legacy-routes";

export type PageGroup =
  | "funnel"
  | "post_conversion"
  | "lead_magnet"
  | "legacy_lead"
  | "content"
  | "admin";

const LEAD_MAGNET_PATHS: ReadonlySet<string> = new Set([
  "/resources/roadmap",
  "/resources/finance-templates",
  "/newsletter",
]);

const POST_CONVERSION_PATHS: ReadonlySet<string> = new Set([
  "/pre-call-resources",
  "/resources/roadmap-thank-you",
  "/resources/finance-templates-thank-you",
]);

/**
 * Coarse page bucket stamped on every PostHog event so funnels and replay
 * filters can say "funnel pages" without listing ten paths that drift the day
 * a page is added. Driven by the same registries the site itself uses.
 */
export function pageGroupFor(pathname: string): PageGroup {
  const path = canonicalFunnelPath(pathname) ?? pathname;
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (isBookingFunnelPath(path)) return "funnel";
  if (isFunnelChromePath(path) || POST_CONVERSION_PATHS.has(path)) {
    return "post_conversion";
  }
  if (LEAD_MAGNET_PATHS.has(path)) return "lead_magnet";
  if (getLegacyLeadRoute(path.slice(1))) return "legacy_lead";
  return "content";
}

/**
 * The page a visitor is "on" for funnel purposes, computed the way the lead
 * form computes `source_path` (src/lib/lead-attribution.ts): an explicit
 * `?source_path=` (or `?source=`) from a redirect wins, else the page itself,
 * both folded through FUNNEL_REDIRECTS. PostHog and `lead_submissions` must
 * agree on this value or every rate joined across the seam is wrong.
 */
export function sourcePathFor(url: URL): string {
  const explicit =
    url.searchParams.get("source_path") ?? url.searchParams.get("source");
  return (
    canonicalFunnelPath(explicit) ??
    canonicalFunnelPath(url.pathname) ??
    url.pathname
  );
}

export type EventContextInput = {
  url: URL;
  session: AttributionSession | null;
  environment: string;
  /** Properties PostHog already put on the event; never overwritten. */
  existing?: Record<string, unknown>;
};

/**
 * Properties stamped on every PostHog event. `vp_session_id` is the join key
 * to lead_submissions / lead_page_views; `source_path` matches the lead row;
 * `vp_utm_*` is the session's latest-touch attribution (what the lead row will
 * carry), kept apart from PostHog's own per-visit `utm_*`, which is only filled
 * in as a fallback when PostHog saw none on this event.
 */
export function eventContext(input: EventContextInput) {
  const { url, session, environment, existing } = input;
  return compact({
    vp_session_id: session?.vp_session_id,
    source_path: sourcePathFor(url),
    page_group: pageGroupFor(url.pathname),
    environment,
    utm_source: existing?.utm_source ? undefined : session?.utm_source,
    vp_utm_source: session?.utm_source,
    vp_utm_medium: session?.utm_medium,
    vp_utm_campaign: session?.utm_campaign,
    vp_utm_term: session?.utm_term,
    vp_utm_content: session?.utm_content,
    vp_paid_platform: session?.paid_platform,
    vp_first_landing_path: session?.first_landing_path,
    vp_latest_landing_path: session?.latest_landing_path,
  });
}

function compact(record: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}
