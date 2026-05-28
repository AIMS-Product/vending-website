import { describe, expect, it } from "vitest";
import { normalizeBrandedPageTitle } from "./metadata-titles";

describe("normalizeBrandedPageTitle", () => {
  it("removes a single trailing Vendingpreneurs brand suffix", () => {
    expect(normalizeBrandedPageTitle("Z Test SEO | Vendingpreneurs")).toBe(
      "Z Test SEO",
    );
  });

  it("leaves unbranded titles unchanged", () => {
    expect(normalizeBrandedPageTitle("Apply")).toBe("Apply");
  });

  it("preserves an all-brand title instead of returning an empty string", () => {
    expect(normalizeBrandedPageTitle("Vendingpreneurs")).toBe(
      "Vendingpreneurs",
    );
  });
});
