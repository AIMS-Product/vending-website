/**
 * Canonical origin. Vercel injects VERCEL_PROJECT_PRODUCTION_URL once a
 * domain is attached, so previews get their own absolute URLs and production
 * gets mikehoffmann.co without another env var to remember.
 */
const fromEnv =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);

export const siteUrl = fromEnv ?? "https://mikehoffmann.co";
