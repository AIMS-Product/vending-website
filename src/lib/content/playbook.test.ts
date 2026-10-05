import { describe, expect, it } from "vitest";
import {
  GHL_CHECKOUT_URL,
  GHL_EMBED_CHECKOUT_URL,
  PLAYBOOK_CHECKOUT_PATH,
  PRICE,
  checkoutFrameHeight,
  checkoutHref,
  isCheckoutComplete,
  embedCheckoutSrc,
  fallbackCheckoutHref,
  finalOffer,
  host,
  opportunityQuotes,
  playbookHref,
  stories,
} from "./playbook";

describe("playbook offer", () => {
  it("keeps the $199 to $67 price", () => {
    expect(PRICE.anchor).toBe("$199");
    expect(PRICE.today).toBe("$67");
  });

  it("points every buy link at our checkout page, never email in the URL", () => {
    expect(checkoutHref()).toBe(PLAYBOOK_CHECKOUT_PATH);
    expect(checkoutHref({ utm_source: "fb", email: "a@b.co" })).toBe(
      `${PLAYBOOK_CHECKOUT_PATH}?utm_source=fb`,
    );
  });

  it("embeds the GHL order-form step and falls back to the full GHL checkout", () => {
    expect(embedCheckoutSrc()).toBe(GHL_EMBED_CHECKOUT_URL);
    const src = embedCheckoutSrc({ utm_source: "fb", email: "a@b.co" });
    expect(src.startsWith(`${GHL_EMBED_CHECKOUT_URL}?`)).toBe(true);
    expect(new URL(src).origin).toBe("https://webinar.vendingpreneurs.com");
    expect(new URL(src).searchParams.get("email")).toBeNull();
    expect(fallbackCheckoutHref({ utm_source: "fb" })).toBe(
      `${GHL_CHECKOUT_URL}?utm_source=fb`,
    );
  });

  it("carries UTMs and the name, never email or phone (PII stays out of URLs)", () => {
    const url = new URL(
      embedCheckoutSrc({
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
      embedCheckoutSrc({ gclid: "g1", gbraid: "b1", wbraid: "w1" }),
    );
    expect(url.searchParams.get("gclid")).toBe("g1");
    expect(url.searchParams.get("gbraid")).toBe("b1");
    expect(url.searchParams.get("wbraid")).toBe("w1");
  });

  it("keeps the price and income copy verbatim from GHL (legal copy)", () => {
    expect(PRICE.anchor).toBe("$199");
    expect(PRICE.save).toBe("Save $132.00 today");
    expect(finalOffer.price).toBe("$67 Only");
    expect(opportunityQuotes.map((q) => q.quote)).toEqual([
      "“We have 45 locations, 77 machines, and did $98,000 last month…”",
      "“With just 4 locations, I’m doing $25,000 a month in revenue…”",
      "“In a few months, I went from zero experience to $5K profit a month!”",
    ]);
  });

  it("teaser link keeps the query on /playbook", () => {
    expect(playbookHref({ utm_campaign: "c" })).toBe(
      "/playbook?utm_campaign=c",
    );
    expect(playbookHref()).toBe("/playbook");
  });

  it("drops a name that is really an email or phone", () => {
    const name = (full_name: string) =>
      new URL(embedCheckoutSrc({ full_name })).searchParams.get("full_name");
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

describe("checkoutFrameHeight", () => {
  const ok = { type: "vp-checkout-height", height: 812.4 };
  it("reads the height from the GHL embed", () => {
    expect(checkoutFrameHeight("https://webinar.vendingpreneurs.com", ok)).toBe(
      813,
    );
  });
  it("ignores other origins, shapes and silly heights", () => {
    expect(checkoutFrameHeight("https://evil.example", ok)).toBeNull();
    expect(
      checkoutFrameHeight("https://webinar.vendingpreneurs.com", "812"),
    ).toBeNull();
    expect(
      checkoutFrameHeight("https://webinar.vendingpreneurs.com", {
        type: "x",
        height: 800,
      }),
    ).toBeNull();
    expect(
      checkoutFrameHeight("https://webinar.vendingpreneurs.com", {
        ...ok,
        height: 99999,
      }),
    ).toBeNull();
    expect(
      checkoutFrameHeight("https://webinar.vendingpreneurs.com", {
        ...ok,
        height: Number.NaN,
      }),
    ).toBeNull();
  });
});

describe("isCheckoutComplete", () => {
  const msg = { type: "vp-checkout-complete" };
  it("accepts our hosts and the page's own origin", () => {
    expect(
      isCheckoutComplete(
        "https://www.vendingpreneurs.com",
        "https://vendingpreneurs.com",
        msg,
      ),
    ).toBe(true);
    expect(
      isCheckoutComplete(
        "https://vendingpreneurs.com",
        "https://x.vercel.app",
        msg,
      ),
    ).toBe(true);
    expect(
      isCheckoutComplete("https://x.vercel.app", "https://x.vercel.app", msg),
    ).toBe(true);
  });
  it("rejects other origins and shapes", () => {
    expect(
      isCheckoutComplete(
        "https://evil.example",
        "https://vendingpreneurs.com",
        msg,
      ),
    ).toBe(false);
    expect(
      isCheckoutComplete(
        "https://www.vendingpreneurs.com",
        "https://vendingpreneurs.com",
        { type: "x" },
      ),
    ).toBe(false);
    expect(
      isCheckoutComplete(
        "https://www.vendingpreneurs.com",
        "https://vendingpreneurs.com",
        null,
      ),
    ).toBe(false);
  });
});
