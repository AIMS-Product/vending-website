const SEARCH_ENGINE =
  /^https?:\/\/(www\.|search\.)?(google|bing|duckduckgo|yahoo|ecosia|brave)\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})(\/|$)/i;

/**
 * A lead that arrived from a search engine with no campaign tags. Reads the
 * stored referrer, so it undercounts: browsers can drop it, and a visitor who
 * returns later without one is not counted.
 */
export function isOrganicSearchLead(lead: {
  referrer: string | null;
  utm_source: string | null;
}): boolean {
  return !lead.utm_source && SEARCH_ENGINE.test(lead.referrer?.trim() ?? "");
}
