import { describe, expect, it } from "vitest";
import {
  GHL_CHECKOUT_URL,
  PRICE,
  checkoutHref,
  playbookHref,
} from "./playbook";

describe("playbook offer", () => {
  it("keeps the $199 to $67 price", () => {
    expect(PRICE.anchor).toBe("$199");
    expect(PRICE.today).toBe("$67");
  });

  it("points every buy link at the GHL checkout", () => {
    expect(checkoutHref()).toBe(GHL_CHECKOUT_URL);
    const href = checkoutHref({ utm_source: "fb", email: "a@b.co" });
    expect(href.startsWith(`${GHL_CHECKOUT_URL}?`)).toBe(true);
    expect(new URL(href).origin).toBe("https://webinar.vendingpreneurs.com");
  });

  it("carries UTMs and the name, never email or phone (PII stays out of URLs)", () => {
    const url = new URL(
      checkoutHref({
        utm_source: "fb",
        fbclid: ["x1", "x2"],
        first_name: "Ann",
        last_name: "Lee",
        email: "a@b.co",
        phone: "+15551234567",
        evil: "1",
      }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "fb",
      fbclid: "x1",
      full_name: "Ann Lee",
    });
  });

  it("teaser link keeps the query on /playbook", () => {
    expect(playbookHref({ utm_campaign: "c" })).toBe(
      "/playbook?utm_campaign=c",
    );
    expect(playbookHref()).toBe("/playbook");
  });
});
