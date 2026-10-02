/**
 * Permanent redirects for admin URLs retired by the analytics consolidation
 * (2026-10). Bookmarks and the EOD email's links keep working.
 *
 * A redirect passes the query string through, so a rule whose destination is
 * /admin/analytics must never match /admin/analytics itself: it would loop.
 * Old tabs without a page of their own need no rule; the dashboard ignores
 * an unknown `tab`.
 */

type Redirect = {
  source: string;
  destination: string;
  statusCode: 301;
  has?: Array<{ type: "query"; key: string; value: string }>;
};

const tab = (value: string, destination: string): Redirect => ({
  source: "/admin/analytics",
  has: [{ type: "query", key: "tab", value }],
  destination,
  statusCode: 301,
});

export const ADMIN_ANALYTICS_REDIRECTS: Redirect[] = [
  { source: "/admin", destination: "/admin/analytics", statusCode: 301 },
  {
    source: "/admin/goals",
    destination: "/admin/analytics#bookings",
    statusCode: 301,
  },
  tab("channels", "/admin/analytics/channels"),
  tab("youtube", "/admin/analytics/youtube"),
  tab("video", "/admin/analytics/video"),
  tab("(mom|close)", "/admin/analytics/months"),
];
