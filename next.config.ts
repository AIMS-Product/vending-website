import type { NextConfig } from "next";

const legacyLeadRedirects = [
  {
    source: "/booking-website",
    destination: "/apply?source_path=/booking-website",
  },
  {
    source: "/booking-organicmisc",
    destination: "/apply?source_path=/booking-organicmisc",
  },
  {
    source: "/booking-ltf",
    destination: "/apply?source_path=/booking-ltf",
  },
  {
    source: "/booking-reactivation-scraper",
    destination: "/apply?source_path=/booking-reactivation-scraper",
  },
  {
    source: "/booking-podcast",
    destination: "/apply?source_path=/booking-podcast",
  },
  {
    source: "/location-eligibility",
    destination: "/apply?source_path=/location-eligibility",
  },
  {
    source: "/build-income-with-vending",
    destination: "/apply?source_path=/build-income-with-vending",
  },
  {
    source: "/vending-blueprint",
    destination: "/vending-route-blueprint?source_path=/vending-blueprint",
  },
  {
    source: "/join",
    destination: "/apply?source_path=/join",
  },
  {
    source: "/vending-training",
    destination: "/apply?source_path=/vending-training",
  },
] as const;

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      ...legacyLeadRedirects.map(({ source, destination }) => ({
        source,
        destination,
        permanent: true,
      })),
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
    ],
  },
};

export default nextConfig;
