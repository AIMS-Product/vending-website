/**
 * The admin paths a read-only `viewer` may open. This is the single list the
 * UI reads from — the nav in AdminShell and every in-page link check both
 * consult it, so there is no second copy to drift out of step.
 *
 * It is presentation only. Access is enforced by `requireAdmin()` (deny) and
 * `requireReadAccess()` (allow) inside the pages themselves; hiding a link is
 * not access control. This list exists so the UI matches what the gate does.
 *
 * A viewer may read the whole studio. What stays shut is everything that
 * writes: the autosaving editors (`/admin/pages/[id]`, `/admin/news/[id]`,
 * `/admin/case-studies/[id]` and the three `new` pages) mutate on mount, so
 * opening them read-only would fire writes that fail; `/admin/settings/users`
 * is the staff roster and role control; `/admin/reset-password` would let a
 * shared account change its own password out from under everyone.
 *
 * Matching is exact on purpose. A child route added under one of these paths
 * later is hidden from viewers until someone adds it here deliberately, which
 * keeps deny the default — a future `/admin/bookings/export` inheriting access
 * from `/admin/bookings` is exactly the accident this prevents.
 */
const VIEWER_READABLE_PATHS: ReadonlySet<string> = new Set([
  "/admin",
  "/admin/analytics",
  "/admin/attribution",
  "/admin/bookings",
  "/admin/case-studies",
  "/admin/chatbot",
  "/admin/chatbot/conversations",
  "/admin/chatbot/insights",
  "/admin/chatbot/settings",
  // The reporting glossary and last night's source checks. A viewer reading a
  // number anywhere else in the studio is exactly who needs to know whether it
  // currently agrees with the system that owns it.
  "/admin/data",
  "/admin/forms",
  "/admin/goals",
  "/admin/leads",
  "/admin/libraries",
  "/admin/links",
  "/admin/links/coverage",
  "/admin/media",
  "/admin/news",
  "/admin/pages",
  "/admin/pages/block-preview-audit",
  "/admin/pages/redirects",
  "/admin/popups",
  "/admin/settings/routes",
  "/admin/team",
]);

export function isViewerReadableHref(href: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return VIEWER_READABLE_PATHS.has(path);
}
