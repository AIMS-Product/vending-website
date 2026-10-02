import { describe, expect, it } from "vitest";
import { accelerator, finalCta, hero } from "./home";

// /apply 308-redirects to /contact, so a CTA that points at it costs every
// click a round trip. Link the destination directly.
describe("home CTAs", () => {
  it.each([
    ["hero", hero.cta],
    ["accelerator", accelerator.cta],
    ["finalCta", finalCta.cta],
  ])("%s links straight to /contact", (_name, cta) => {
    expect(cta.href).toBe("/contact");
  });

  it("does not end a button label with a question mark", () => {
    for (const cta of [hero.cta, accelerator.cta, finalCta.cta]) {
      expect(cta.label.endsWith("?")).toBe(false);
    }
  });
});
