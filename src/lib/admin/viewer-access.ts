/**
 * The admin paths a read-only `viewer` may open. This is the single list the
 * UI reads from — the nav in AdminShell and every in-page link check both
 * consult it, so there is no second copy to drift out of step.
 *
 * It is presentation only. Access is enforced by `requireAdmin()` (deny) and
 * `requireReadAccess()` (allow) inside the pages themselves; hiding a link is
 * not access control. This list exists so the UI matches what the gate does.
 *
 * Matching is exact on purpose. A child route added under one of these paths
 * later is hidden from viewers until someone adds it here deliberately, which
 * keeps deny the default — `/admin/bookings/some-lead` inheriting access from
 * `/admin/bookings` is exactly the accident this prevents.
 */
const VIEWER_READABLE_PATHS: ReadonlySet<string> = new Set([
  "/admin",
  "/admin/analytics",
  "/admin/goals",
  "/admin/bookings",
  "/admin/attribution",
]);

export function isViewerReadableHref(href: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return VIEWER_READABLE_PATHS.has(path);
}
