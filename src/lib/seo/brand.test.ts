import { describe, expect, it } from "vitest";
import { isBrandQuery } from "./brand";

describe("isBrandQuery", () => {
  it("matches the brand however it is spelled or spaced", () => {
    for (const query of [
      "vendingpreneurs",
      "vending preneurs",
      "vendingprenuers",
      "Vendingpreneurs review",
      "vendingpreneurs login",
      "mike hoffman vending machine",
      "mike hoffmann",
      "modern amenities vending",
    ]) {
      expect(isBrandQuery(query), query).toBe(true);
    }
  });

  it("leaves generic vending searches alone", () => {
    for (const query of [
      "vending machine items",
      "how to start a vending machine business",
      "vending machine permit texas",
      "anthony kolodziej",
    ]) {
      expect(isBrandQuery(query), query).toBe(false);
    }
  });
});
