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
});
