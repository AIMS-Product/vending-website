import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The redirect is a client component with an effect; server rendering it
// produces nothing, so stub it with a marker to prove CalendlyEmbed mounts it.
// That wiring is the whole reason the redirect works everywhere at once: every
// booking surface on the site renders its calendar through CalendlyEmbed, so if
// this ever stops being true, bookers stop reaching /pre-call-resources.
vi.mock("./CalendlyBookingRedirect", () => ({
  CalendlyBookingRedirect: () =>
    createElement("div", { "data-testid": "booking-redirect" }),
}));

const { CalendlyEmbed } = await import("./CalendlyEmbed");
const { __testing: frame } = await import("./CalendlyFrame");

describe("CalendlyEmbed", () => {
  const url =
    "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery";

  it("mounts the post-booking redirect alongside the calendar", () => {
    const html = renderToStaticMarkup(createElement(CalendlyEmbed, { url }));
    expect(html).toContain('data-testid="booking-redirect"');
    expect(html).toMatch(/<iframe[^>]+src="https:\/\/calendly\.com\//);
  });

  it("marks the frame as an inline embed so Calendly posts booking events", () => {
    // Without embed_domain Calendly never messages the parent page and the
    // redirect can never fire, however correct the listener is.
    const html = renderToStaticMarkup(createElement(CalendlyEmbed, { url }));
    expect(html).toContain("embed_domain=");
    expect(html).toContain("embed_type=Inline");
  });

  it("shows the loading layer until Calendly reports in", () => {
    const html = renderToStaticMarkup(createElement(CalendlyEmbed, { url }));
    expect(html).toContain("Loading available times");
  });
});

// The iframe's first load event fires ~3s in, before Calendly redirects and
// paints (~8s), so the layer clears only on a message from Calendly itself.
describe("CalendlyFrame loading layer", () => {
  const msg = (origin: string, data: unknown) => ({ origin, data });

  it("clears on any calendly.* message from calendly.com", () => {
    expect(
      frame.isCalendlyMessage(
        msg("https://calendly.com", { event: "calendly.page_height" }),
      ),
    ).toBe(true);
    expect(
      frame.isCalendlyMessage(
        msg("https://calendly.com", { event: "calendly.event_type_viewed" }),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "another origin",
      "https://calendly.com.evil.test",
      { event: "calendly.x" },
    ],
    ["plain http", "http://calendly.com", { event: "calendly.x" }],
    ["a non-calendly event", "https://calendly.com", { event: "other" }],
    ["a string payload", "https://calendly.com", "calendly.page_height"],
    ["no payload", "https://calendly.com", null],
  ])("ignores %s", (_label, origin, data) => {
    expect(frame.isCalendlyMessage(msg(origin, data))).toBe(false);
  });

  it("keeps a fallback long enough to outlast Calendly's redirect", () => {
    expect(frame.LOADING_LAYER_MAX_MS).toBeGreaterThanOrEqual(12_000);
  });

  it("no longer clears the layer on the iframe's load event", () => {
    const source = readFileSync(
      new URL("./CalendlyFrame.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/onLoad=/);
    expect(source).toContain('removeEventListener("message"');
    expect(source).toContain("clearTimeout(timer)");
  });
});
