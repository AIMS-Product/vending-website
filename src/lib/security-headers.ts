import { contentSecurityPolicyReportOnly } from "./content-security-policy";

/**
 * Response security headers applied to every route.
 *
 * The CSP here is REPORT-ONLY and blocks nothing — see
 * `content-security-policy.ts` for why an enforcing policy cannot be written
 * from source alone, and for what has to happen before it is promoted.
 *
 * `preload` is left off HSTS on purpose: submitting to the preload list is
 * effectively irreversible and is a domain-owner decision, not a code one.
 */
export const securityHeaders = [
  {
    // Report-only: browsers evaluate it, report to /api/csp-report, and allow
    // the request regardless. Promoting this to Content-Security-Policy is a
    // separate, deliberate change.
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
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
