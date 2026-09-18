/**
 * Next's built-in trailing-slash 308 is switched off (`skipTrailingSlashRedirect`
 * in next.config.ts) because the PostHog reverse proxy under /api/ph has to
 * accept `/e/`, `/s/` and `/flags/` exactly as posthog-js sends them. Public
 * pages still need one canonical URL each, so the proxy performs the same 308
 * with this helper. `/api/*` is outside the proxy matcher and is left alone.
 */
export function trailingSlashRedirectPath(pathname: string): string | null {
  if (pathname.length < 2 || !pathname.endsWith("/")) return null;
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}
