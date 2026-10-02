import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config redirects", () => {
  it("sends /home-v2 to / as a permanent (308) redirect", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/home-v2",
      destination: "/",
      permanent: true,
    });
  });

  it("sends /apply to /contact as a permanent redirect", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/apply",
      destination: "/contact",
      permanent: true,
    });
  });
});
