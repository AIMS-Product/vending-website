import type { NextConfig } from "next";

const leadRedirectSources = [
  "/booking-meta",
  "/booking-ltf",
  "/booking-youtube",
  "/booking-website",
  "/booking-organicmisc",
  "/booking-podcast",
  "/booking-reactivation-email",
  "/booking-reactivation-scraper",
  "/booking-ig",
  "/booking-linkedin",
  "/booking-x",
  "/booking-internal-ltf",
  "/booking-passivepreneurs",
  "/booking-partner",
  "/booking-tiktok",
  "/booking-vendingpreneurs-training",
  "/schedule-your-call-ig",
  "/book-your-call",
  "/start",
  "/location-eligibility",
  "/vending-blueprint",
  "/start-your-route-ak-ig",
  "/start-your-route-ak-tt",
  "/start-my-vending-business",
  "/build-income-with-vending",
  "/vending-route-blueprint",
  "/test-leadscore-a",
  "/vending-business-blueprint",
  "/join",
  "/apply-vendingpreneurs",
  "/vending-training",
] as const;

const nextConfig: NextConfig = {
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
    ],
  },
  async redirects() {
    return [
      {
        source: "/about-us",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/business",
        destination: "/about",
        permanent: true,
      },
      ...leadRedirectSources.map((source) => ({
        source,
        destination: `/apply?source_path=${encodeURIComponent(source)}`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
