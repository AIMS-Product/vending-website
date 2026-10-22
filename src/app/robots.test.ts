import { describe, expect, it } from "vitest";
import robots from "./robots";
import { absoluteUrl } from "@/lib/site";

describe("robots", () => {
  it("points crawlers at the sitemap and keeps /admin/ out", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    expect(result.sitemap).toBe(absoluteUrl("/sitemap.xml"));
    expect(rules).toContainEqual(
      expect.objectContaining({
        userAgent: "*",
        disallow: expect.arrayContaining(["/admin/"]),
      }),
    );
  });
});
