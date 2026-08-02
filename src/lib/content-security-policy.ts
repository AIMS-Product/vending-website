/**
 * Content-Security-Policy, shipped in REPORT-ONLY mode.
 *
 * The site loads a long tail of marketing tags, several of which load further
 * scripts of their own at runtime. An enforcing policy written from reading the
 * source would break production the first time one of them reached a host
 * nobody wrote down. So this ships as `Content-Security-Policy-Report-Only`:
 * browsers evaluate it, report what it would have blocked to
 * `/api/csp-report`, and block nothing.
 *
 * Promoting it to enforcing is a deliberate later step, and it needs two
 * things first:
 *
 *  1. A quiet report log across real traffic — any host reported here that is
 *     legitimate belongs in the lists below before the switch.
 *  2. Nonces on the inline tag bootstraps, which is what lets `'unsafe-inline'`
 *     come out of `script-src`. Until then this policy cannot catch injected
 *     inline script; what it does catch is any *host* the page contacts that
 *     is not on this list, which is the part nobody currently knows.
 */

/** Tag loaders, each named by the tag that needs it. */
const SCRIPT_HOSTS = [
  "https://www.googletagmanager.com", // GTM + GA4 loader
  "https://connect.facebook.net", // Meta Pixel
  "https://cm.vendingpreneurs.ai", // ClickMagick
  "https://cdn.idpixel.app", // idpixel identity resolution
  "https://js.hs-scripts.com", // HubSpot
  "https://js.hsforms.net",
  "https://js.hscollectedforms.net",
  "https://js.hs-analytics.net",
  "https://js.hs-banner.net",
  "https://fast.vidalytics.com", // Vidalytics player
  "https://t.rightmessage.com", // RightMessage personalization
  "https://widget.manychat.com", // ManyChat
  "https://mccdn.me",
  "https://wisepops.net", // Wisepops
  "https://assets.calendly.com", // Calendly embed
] as const;

/** Where the tags above report back to, plus our own Supabase and Sentry. */
const CONNECT_HOSTS = [
  "https://*.supabase.co",
  "https://*.ingest.sentry.io",
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://connect.facebook.net",
  "https://www.facebook.com",
  "https://cm.vendingpreneurs.ai",
  "https://cdn.idpixel.app",
  "https://*.hubspot.com",
  "https://*.hs-scripts.com",
  "https://fast.vidalytics.com",
  "https://*.vidalytics.com",
  "https://t.rightmessage.com",
  "https://*.rightmessage.com",
  "https://*.manychat.com",
  "https://mccdn.me",
  "https://wisepops.net",
  "https://*.wisepops.com",
  "https://calendly.com",
  "https://*.calendly.com",
] as const;

/** Everything the page is allowed to put in an iframe. */
const FRAME_HOSTS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://calendly.com",
  "https://*.calendly.com",
  "https://www.googletagmanager.com", // GTM noscript iframe
  "https://www.facebook.com", // Meta Pixel fallback
  "https://fast.vidalytics.com",
  "https://widget.manychat.com",
] as const;

export const CSP_REPORT_PATH = "/api/csp-report";

const DIRECTIVES: Array<[string, string[]]> = [
  ["default-src", ["'self'"]],
  // 'unsafe-inline' covers the tag bootstraps in TrackingScripts and Next's own
  // hydration inline scripts; 'unsafe-eval' is what GTM's preview mode and
  // several of the players need. Both come out once the bootstraps are nonced.
  [
    "script-src",
    ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...SCRIPT_HOSTS],
  ],
  // RightMessage injects a <style> element on load, and Tailwind's runtime
  // style attributes are inline by construction.
  ["style-src", ["'self'", "'unsafe-inline'", "https://assets.calendly.com"]],
  // Tracking pixels are 1x1 images from hosts that change without notice, and
  // an image cannot execute. `https:` here is deliberate, not an oversight.
  ["img-src", ["'self'", "data:", "blob:", "https:"]],
  ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
  ["connect-src", ["'self'", ...CONNECT_HOSTS]],
  ["frame-src", ["'self'", ...FRAME_HOSTS]],
  ["media-src", ["'self'", "blob:", "https:"]],
  ["worker-src", ["'self'", "blob:"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  // Server actions post to this origin only. Nothing here submits a form
  // cross-origin — Calendly and HubSpot both render inside an iframe.
  ["form-action", ["'self'"]],
  // Mirrors the X-Frame-Options header for browsers that prefer CSP.
  ["frame-ancestors", ["'self'"]],
  ["report-uri", [CSP_REPORT_PATH]],
];

export const contentSecurityPolicyReportOnly = DIRECTIVES.map(
  ([directive, sources]) => `${directive} ${sources.join(" ")}`,
).join("; ");
