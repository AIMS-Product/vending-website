import { describe, expect, it } from "vitest";
import {
  GHL_CHECKOUT_URL,
  PRICE,
  checkoutHref,
  finalOffer,
  host,
  playbookHref,
  stories,
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

  it("carries Google Ads click ids (gclid, gbraid, wbraid) to checkout", () => {
    const url = new URL(
      checkoutHref({ gclid: "g1", gbraid: "b1", wbraid: "w1" }),
    );
    expect(url.searchParams.get("gclid")).toBe("g1");
    expect(url.searchParams.get("gbraid")).toBe("b1");
    expect(url.searchParams.get("wbraid")).toBe("w1");
  });

  it("states the saving in whole dollars", () => {
    expect(PRICE.save).toBe("Save $132 today");
  });

  it("teaser link keeps the query on /playbook", () => {
    expect(playbookHref({ utm_campaign: "c" })).toBe(
      "/playbook?utm_campaign=c",
    );
    expect(playbookHref()).toBe("/playbook");
  });

  it("drops a name that is really an email or phone", () => {
    const name = (full_name: string) =>
      new URL(checkoutHref({ full_name })).searchParams.get("full_name");
    expect(name("a@b.com")).toBeNull();
    expect(name("4155551234")).toBeNull();
    expect(name("x".repeat(81))).toBeNull();
    expect(name("Bob")).toBe("Bob");
    expect(name("Mary-Jo O'Neil")).toBe("Mary-Jo O'Neil");
  });

  it("keeps Mike's bio verbatim after the phone-friendly split", () => {
    const bio = host.paragraphs.join(" ");
    expect(bio).toContain(
      "a schedule that wasn't mine. The moment vending stopped being a curiosity",
    );
    expect(bio).toContain(
      "I want to know it still works. Every script, template, and framework",
    );
    expect(bio.split(/(?<=\.) /).length).toBe(14);
    expect(bio.startsWith("I grew up on a family farm in rural Iowa.")).toBe(
      true,
    );
    expect(bio.endsWith("build something that's theirs.")).toBe(true);
  });

  it("highlights a phrase that is really in the final offer title", () => {
    expect(finalOffer.title).toContain(finalOffer.highlight);
  });

  it("drops the story intro that named a card we don't show", () => {
    expect("intro" in stories).toBe(false);
    expect(stories.items.map((s) => s.name)).toEqual([
      "Shannon",
      "Anthony",
      "Jesse",
      "Madison",
    ]);
  });
});
