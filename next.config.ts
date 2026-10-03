import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { securityHeaders } from "./src/lib/security-headers";
import { FUNNEL_REDIRECTS } from "./src/lib/content/funnel-redirects";
import { ADMIN_ANALYTICS_REDIRECTS } from "./src/lib/admin/analytics-redirects";

const legacyLeadRedirects = [
  {
    source: "/booking-website",
    destination: "/contact?source_path=/booking-website",
  },
  {
    source: "/booking-organicmisc",
    destination: "/contact?source_path=/booking-organicmisc",
  },
  {
    source: "/booking-ltf",
    destination: "/contact?source_path=/booking-ltf",
  },
  {
    source: "/booking-reactivation-scraper",
    destination: "/contact?source_path=/booking-reactivation-scraper",
  },
  {
    source: "/booking-podcast",
    destination: "/contact?source_path=/booking-podcast",
  },
  {
    source: "/location-eligibility",
    destination: "/contact?source_path=/location-eligibility",
  },
  {
    source: "/build-income-with-vending",
    destination: "/contact?source_path=/build-income-with-vending",
  },
  {
    source: "/vending-blueprint",
    destination: "/vending-route-blueprint?source_path=/vending-blueprint",
  },
  {
    source: "/join",
    destination: "/contact?source_path=/join",
  },
  {
    source: "/vending-training",
    destination: "/contact?source_path=/vending-training",
  },
] as const;

// WordPress-era blog URLs (pre-2026-07-27 cutover) that hard-404ed with no
// redirect — recovered from the Wayback CDX index during the 2026-08-31 SEO
// audit (reports/seo-audit-2026-08-31/). Grouped by the live article that
// covers the same topic; everything else lands on the /news index.
// These run before filesystem routes: never publish a new post at one of
// these slugs, or the redirect will shadow it.
const legacyNewsRedirects: ReadonlyArray<{
  sources: readonly string[];
  destination: string;
}> = [
  {
    // Location, placement, and installation topics.
    sources: [
      "/news/best-vending-machines-schools-offices-gyms",
      "/news/vending-machine-locator-high-earning-spots",
      "/news/vending-machine-locator-services-faqs",
      "/news/vending-machine-placement-2",
      "/news/vending-machine-placement-2-c6bb6",
      "/news/vending-machine-installation-checklist",
      "/news/what-to-check-before-installing-a-vending-machine",
    ],
    destination: "/news/best-vending-locations",
  },
  {
    // Mentorship/program-evaluation topics.
    sources: [
      "/news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program",
      "/news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own",
      "/news/vending-machine-business-course-mentorship-guide",
    ],
    destination: "/news/top-5-questions-vending-entrepreneurship-program",
  },
  {
    // Product-selection topics.
    sources: [
      "/news/seasonal-vending-machine-ideas",
      "/news/eco-friendly-zero-waste-vending-machines",
    ],
    destination:
      "/news/top-10-profitable-products-to-stock-in-your-vending-machine",
  },
  {
    // No close live equivalent: send to the article index rather than 404.
    // Never add an article Google still ranks here (a redirect to an index
    // is a soft 404); republish it instead. The 9 restored 2026-09-28 held
    // ~53K impressions before the cutover.
    sources: [
      "/news/7-myths-about-vending-machine-business",
      // No news_posts row survived the cutover import; keep until rewritten.
      "/news/finance-first-vending-machines-without-loans",
      "/news/vending-business-for-complete-beginners",
      "/news/vending-machine-innovation-5",
      "/news/vending-machine-insights-5",
      "/news/vending-machine-success-3",
      "/news/vending-machine-success-3-8b515",
      "/news/vending-machine-tips-4",
      "/news/vending-machine-trends-4",
    ],
    destination: "/news",
  },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework on every response.
  poweredByHeader: false,
  // /admin/data renders REPORTING.md, the reporting glossary, so the page and
  // the file cannot drift apart. Nothing imports it, so nothing traces it into
  // the bundle: without this the read succeeds locally and fails in
  // production. `src/lib/services/data-trust.ts` says the same thing.
  outputFileTracingIncludes: {
    "/admin/data": ["./REPORTING.md"],
  },
  // PostHog reverse proxy: same-origin, so ad blockers and the CSP see our
  // own traffic. posthog-js posts to `/e/`, `/s/`, `/flags/` with a trailing
  // slash, which Next's built-in 308 would turn into a redirect, hence
  // skipTrailingSlashRedirect. Public pages keep their trailing-slash 308 in
  // src/proxy.ts (trailingSlashRedirectPath).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/ph/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/api/ph/array/:path*",
          destination: "https://us-assets.i.posthog.com/array/:path*",
        },
        {
          source: "/api/ph/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
  async redirects() {
    return [
      // Admin analytics consolidation (2026-10): the overview, goals page
      // and fifteen analytics tabs folded into one dashboard. A redirect
      // keeps the query, so only tabs with their own page are matched; any
      // other ?tab= simply lands on the dashboard, which ignores it.
      ...ADMIN_ANALYTICS_REDIRECTS,
      {
        source: "/login",
        destination: "/admin/login",
        permanent: false,
      },
      {
        source: "/business",
        destination: "/about",
        permanent: true,
      },
      // Retired duplicate pages — keep their URLs alive via 301 to canonicals.
      {
        source: "/about-us",
        destination: "/about",
        permanent: true,
      },
      // The v2 design was promoted to the homepage. A real 308 here (not a
      // redirect() inside a page, which streams as a 200 meta refresh).
      {
        source: "/home-v2",
        destination: "/",
        permanent: true,
      },
      // The apply funnel now lives at /contact — keep the old slug alive.
      {
        source: "/apply",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      // News consolidation — three older location posts now fold into the
      // /news/best-vending-locations pillar. Their DB rows are archived so the
      // canonical URL is the only one that renders.
      ...[
        "/news/best-vending-locations-1",
        "/news/best-vending-locations-1-f15cf",
        "/news/how-to-choose-the-perfect-location-for-vending-machine",
      ].map((source) => ({
        source,
        destination: "/news/best-vending-locations",
        permanent: true,
      })),
      ...legacyLeadRedirects.map(({ source, destination }) => ({
        source,
        destination,
        permanent: true,
      })),
      // Retired funnel URLs from the migration sheet.
      ...FUNNEL_REDIRECTS.map(({ source, destination }) => ({
        source,
        destination,
        permanent: true,
      })),
      ...legacyNewsRedirects.flatMap(({ sources, destination }) =>
        sources.map((source) => ({ source, destination, permanent: true })),
      ),
      // WordPress-era funnel/tool pages recovered from the same Wayback pull.
      {
        source: "/booking-referral",
        destination: "/contact?source_path=/booking-referral",
        permanent: true,
      },
      {
        source: "/booking-webinar",
        destination: "/contact?source_path=/booking-webinar",
        permanent: true,
      },
      {
        source: "/vending-route-builder",
        destination:
          "/vending-route-blueprint?source_path=/vending-route-builder",
        permanent: true,
      },
      // Legacy WordPress sitemap path — point crawlers at the real one.
      {
        source: "/wp-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Supabase Storage — used for News CMS cover images and embedded media.
      {
        protocol: "https",
        hostname: "aacisvhkmsaabqdvdmmf.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Webflow CDN — temporarily allowed during the News migration so we
      // can paste original article cover URLs while content is rewritten.
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
      // YouTube thumbnail CDN — /apply VSL facade, case studies, masterclass
      // replay. Every caller reads `/vi/<id>/<name>.jpg`, so nothing else on
      // the host is optimized on our bill.
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
      // Community wins board — win photos mirrored onto the wins site, and the
      // Mighty avatars its feed points at. Both render in the wins preview on
      // /pre-call-resources.
      {
        protocol: "https",
        hostname: "wins.vendingpreneurs.com",
      },
      {
        protocol: "https",
        hostname: "media2-production.mightynetworks.com",
      },
    ],
  },
};

const shouldUploadSentrySourceMaps = Boolean(
  (process.env.CI || process.env.VERCEL) &&
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !shouldUploadSentrySourceMaps,
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
