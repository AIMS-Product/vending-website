import { describe, expect, it } from "vitest";
import {
  anthonyBookingCopy,
  bookingPages,
  mikeBookingCopy,
  resolveBookingCopy,
} from "./booking-pages";
import { applyFaq, applyHero, applyVsl } from "./apply-page";

// Locks the social-ad booking pages (Kody's sheet rows 51-54): the right
// persona and — safety-critical — the right calendar per page. A wrong Calendly
// books a lead onto the wrong call lane.
describe("bookingPages config", () => {
  const TOP =
    "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";
  const GENERAL =
    "https://calendly.com/d/cxfn-hh2-h8g/vendingpreneurs-consultation";

  it("defines exactly the four flagged new pages", () => {
    expect(Object.keys(bookingPages).sort()).toEqual([
      "booking-ak-b5",
      "booking-ak-t5",
      "booking-b5-socials",
      "booking-t5-socials",
    ]);
  });

  it.each([
    ["booking-t5-socials", "mike", TOP],
    ["booking-b5-socials", "mike", GENERAL],
    ["booking-ak-t5", "anthony", TOP],
    ["booking-ak-b5", "anthony", GENERAL],
  ] as const)(
    "routes %s to the right persona + calendar",
    (slug, persona, calendly) => {
      const config = bookingPages[slug];
      expect(config.persona).toBe(persona);
      expect(config.calendlyUrl).toBe(calendly);
      expect(config.path).toBe(`/${slug}`);
    },
  );

  it("sends t5 pages to the top-closer calendar and b5 to the general one", () => {
    expect(bookingPages["booking-t5-socials"].calendlyUrl).toBe(
      bookingPages["booking-ak-t5"].calendlyUrl,
    );
    expect(bookingPages["booking-b5-socials"].calendlyUrl).toBe(
      bookingPages["booking-ak-b5"].calendlyUrl,
    );
    expect(bookingPages["booking-t5-socials"].calendlyUrl).not.toBe(
      bookingPages["booking-b5-socials"].calendlyUrl,
    );
  });
});

describe("resolveBookingCopy", () => {
  it("keeps the frozen Mike copy for the default persona", () => {
    const copy = resolveBookingCopy(bookingPages["booking-t5-socials"]);
    expect(copy.heroBody).toBe(mikeBookingCopy.heroBody);
    expect(copy.vsl).toEqual(mikeBookingCopy.vsl);
    expect(copy.faqItems).toEqual(applyFaq.items);
    expect(copy.vsl.caption.map((s) => s.text).join("")).toContain(
      "Mike Hoffmann",
    );
  });

  // These four pages carry paid traffic and were deliberately cut loose from
  // apply-page.ts when Kody rewrote the contact funnel on 2026-08-10. If someone
  // re-points them at the shared copy, ad spend starts landing on a hero nobody
  // approved for it — so assert the divergence, not just the strings.
  it.each(["booking-t5-socials", "booking-ak-t5"] as const)(
    "does not inherit the contact funnel rewrite (%s)",
    (slug) => {
      const copy = resolveBookingCopy(bookingPages[slug]);
      expect(copy.heroHeadline).not.toBe(applyHero.headline);
      expect(copy.heroHeadline).not.toContain("$5-$60k");
      expect(copy.heroEyebrow).not.toBe(applyHero.eyebrow);
      expect(copy.heroSubheadline.highlight).toBe("$1–$5,000/mo");
      expect(copy.vsl.caption).not.toEqual(applyVsl.caption);
    },
  );

  it("swaps in Anthony's hero, VSL, and experience answer", () => {
    const copy = resolveBookingCopy(bookingPages["booking-ak-t5"]);
    expect(copy.heroBody).toBe(anthonyBookingCopy.heroBody);
    expect(copy.heroBody).toContain("Anthony");
    expect(copy.vsl.youtubeId).toBe("ksvldfarH-U");
    expect(copy.vsl.videoHref).toBe("https://youtu.be/ksvldfarH-U");
    expect(copy.vsl.watchLabel).toBe("Watch Anthony's story");
    expect(copy.vsl.caption.map((s) => s.text).join("")).toContain(
      "Anthony Kolodziej",
    );

    const experience = copy.faqItems.find(
      (item) => item.q === "Do I need experience?",
    );
    expect(experience?.a).toBe(
      "No. Anthony and most members started with none.",
    );
  });

  it("changes only the experience FAQ answer for Anthony (others intact)", () => {
    const copy = resolveBookingCopy(bookingPages["booking-ak-b5"]);
    for (const item of copy.faqItems) {
      if (item.q === "Do I need experience?") continue;
      const original = applyFaq.items.find((i) => i.q === item.q);
      expect(item.a).toBe(original?.a);
    }
  });
});
