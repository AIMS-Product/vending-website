import { FUNNEL_REDIRECTS } from "@/lib/content/funnel-redirects";

/** Old funnel URL -> the page it now renders, so a redirect keeps one history. */
const REDIRECT_DESTINATIONS: ReadonlyMap<string, string> = new Map(
  FUNNEL_REDIRECTS.map((redirect) => [
    redirect.source,
    // The destination carries `?source_path=`; the page is what precedes it.
    redirect.destination.split("?")[0] ?? redirect.destination,
  ]),
);

/**
 * The funnel a path belongs to: query stripped, lowercased, trailing slash
 * removed, then folded through FUNNEL_REDIRECTS to the page it now renders.
 *
 * A redirected URL is folded into the page it now renders, because that is
 * what the visitor saw. Leaving them apart splits one funnel's history in
 * half on the day the redirect shipped: GA4 records the destination (it sees
 * the final URL) while the lead keeps `source_path` of the old one, so visits
 * and leads would land in different rows and every rate on both would be
 * wrong.
 *
 * Pure and dependency-light on purpose: the server funnel report and the
 * browser-side PostHog stamp both use it, so one definition of "which page"
 * serves both sides of the vp_session_id seam.
 */
export function canonicalFunnelPath(
  path: string | null | undefined,
): string | null {
  const raw = path?.trim();
  if (!raw) return null;
  // GA4 landing pages arrive with the query string attached.
  const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
  const lowered = withoutQuery.toLowerCase();
  const normalised =
    lowered.length > 1 && lowered.endsWith("/")
      ? lowered.replace(/\/+$/, "")
      : lowered;
  if (!normalised.startsWith("/")) return null;
  return REDIRECT_DESTINATIONS.get(normalised) ?? normalised;
}
