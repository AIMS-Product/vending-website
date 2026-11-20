import { describe, expect, it } from "vitest";
import { normalizeBrandedPageTitle, pageTitle } from "./metadata-titles";

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

describe("pageTitle", () => {
  it("lets the template add the brand to a short title", () => {
    expect(pageTitle("90 Day Vending Route Roadmap | Vendingpreneurs")).toBe(
      "90 Day Vending Route Roadmap",
    );
  });

  it("never adds the brand to a title that already names it", () => {
    expect(pageTitle("Vendingpreneurs Reviews")).toEqual({
      absolute: "Vendingpreneurs Reviews",
    });
    expect(pageTitle("Vendingpreneurs")).toEqual({
      absolute: "Vendingpreneurs",
    });
  });

  it("drops the suffix from a title over 45 characters", () => {
    const long = "90-Day Vending Machine Business Blueprint Extra";
    expect(pageTitle(`${long} | VendingPreneurs`)).toEqual({ absolute: long });
  });
});
