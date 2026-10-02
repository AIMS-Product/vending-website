import { describe, expect, it } from "vitest";
import { isHiddenInternalPage, isProductionDeployment } from "./internal-pages";

describe("isHiddenInternalPage", () => {
  it("hides the internal pages on production", () => {
    expect(isHiddenInternalPage("/qa-links", "production")).toBe(true);
    expect(isHiddenInternalPage("/demo/book-a-call", "production")).toBe(true);
  });

  it("keeps them reachable on preview, development and unset env", () => {
    for (const env of ["preview", "development", undefined]) {
      expect(isHiddenInternalPage("/qa-links", env)).toBe(false);
      expect(isHiddenInternalPage("/demo/book-a-call", env)).toBe(false);
    }
  });

  it("never hides a public page", () => {
    expect(isHiddenInternalPage("/about", "production")).toBe(false);
    expect(isHiddenInternalPage("/demo", "production")).toBe(false);
    expect(isHiddenInternalPage("/", "production")).toBe(false);
  });
});

describe("isProductionDeployment", () => {
  it("is true only for production", () => {
    expect(isProductionDeployment("production")).toBe(true);
    expect(isProductionDeployment("preview")).toBe(false);
    expect(isProductionDeployment(undefined)).toBe(false);
  });
});
