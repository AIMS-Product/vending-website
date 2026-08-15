import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every asset on this site is local, so there are no remote image patterns.
 * The headers are the same baseline the Vendingpreneurs app ships, minus the
 * CSP — this app loads no third-party script, so there is nothing to allow.
 */
const nextConfig: NextConfig = {
  // This app sits inside the vending-website repo, whose root carries its own
  // lockfile and `src/`. Without pinning the root, Turbopack walks up to that
  // lockfile and tries to compile the Vendingpreneurs instrumentation files.
  turbopack: { root: here },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
