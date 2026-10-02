import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config security posture", () => {
  it("does not advertise the framework in X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("only optimizes images from hosts something actually uses", () => {
    const hosts = (nextConfig.images?.remotePatterns ?? []).map((pattern) =>
      "hostname" in pattern ? pattern.hostname : "",
    );
    // Shared multi-tenant buckets removed in the security pass: any customer
    // of the platform can upload there, and nothing in src references them.
    expect(hosts).not.toContain("assets.cdn.filesafe.space");
    expect(hosts).not.toContain("storage.googleapis.com");
  });

  it("scopes the YouTube thumbnail host to /vi/**", () => {
    const youtube = (nextConfig.images?.remotePatterns ?? []).find(
      (pattern) => "hostname" in pattern && pattern.hostname === "i.ytimg.com",
    );
    expect(youtube).toMatchObject({ pathname: "/vi/**" });
  });
});
