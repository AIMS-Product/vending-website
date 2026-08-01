/**
 * Response security headers applied to every route.
 *
 * Deliberately excludes `Content-Security-Policy`. The public site loads a long
 * tail of third-party tags (Meta Pixel, HubSpot, ClickMagick, Vidalytics,
 * Wisepops, ManyChat, RightMessage, GA4) plus YouTube and Calendly frames, so an
 * enforcing CSP written blind would break production. Adding one needs a
 * `Content-Security-Policy-Report-Only` rollout measured against real traffic
 * first — tracked as a follow-up, not something to guess at.
 *
 * `preload` is also left off HSTS on purpose: submitting to the preload list is
 * effectively irreversible and is a domain-owner decision, not a code one.
 */
export const securityHeaders = [
  {
    // The qualification session token travels in the URL path
    // (`/qualify/<token>`) and is the only credential for reading a lead's
    // answers or completing their session. Without this, every outbound link
    // click and third-party subresource leaks it in the Referer header.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // /admin/settings/users renders role-change and remove-access controls as
    // plain server-action forms. Framing them cross-origin allows a UI-redress
    // attack against a signed-in super admin.
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Nothing in this app uses these; denying them limits what an injected
    // third-party tag can reach for.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
] as const;
