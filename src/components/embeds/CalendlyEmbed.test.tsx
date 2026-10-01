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

  it("clears when Calendly reports the event type is on screen", () => {
    expect(
      frame.isCalendlyMessage(
        msg("https://calendly.com", { event: "calendly.event_type_viewed" }),
      ),
    ).toBe(true);
  });

  it("clears on a scheduler-sized page_height", () => {
    expect(
      frame.isCalendlyMessage(
        msg("https://calendly.com", {
          event: "calendly.page_height",
          payload: { height: "602px" },
        }),
      ),
    ).toBe(true);
  });

  // Calendly's redirect page posts these 1-2s before the calendar paints;
  // clearing on them showed an empty tint box.
  it.each(["26px", "2px", undefined])(
    "does not clear on the redirect page's page_height %s",
    (height) => {
      expect(
        frame.isCalendlyMessage(
          msg("https://calendly.com", {
            event: "calendly.page_height",
            payload: height === undefined ? undefined : { height },
          }),
        ),
      ).toBe(false);
    },
  );

  it.each([
    [
      "another origin",
      "https://calendly.com.evil.test",
      { event: "calendly.event_type_viewed" },
    ],
    [
      "plain http",
      "http://calendly.com",
      { event: "calendly.event_type_viewed" },
    ],
    ["a non-calendly event", "https://calendly.com", { event: "other" }],
    ["a string payload", "https://calendly.com", "calendly.page_height"],
    [
      "another origin's event_type_viewed",
      "https://calendly.com.evil.test",
      { event: "calendly.event_type_viewed" },
    ],
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

// The fixed iframe height left 80-150px of dead tint under Calendly's month
// view on phones, so a real page_height sizes the frame.
describe("CalendlyFrame height", () => {
  const pageHeight = (height: unknown, origin = "https://calendly.com") => ({
    origin,
    data: { event: "calendly.page_height", payload: { height } },
  });

  it("takes the scheduler's reported height", () => {
    expect(frame.schedulerHeight(pageHeight("602px"))).toBe(602);
  });

  it("ignores the redirect page's 26px report", () => {
    expect(frame.schedulerHeight(pageHeight("26px"))).toBeNull();
  });

  it("ignores heights from any other origin", () => {
    expect(
      frame.schedulerHeight(pageHeight("602px", "https://evil.test")),
    ).toBeNull();
  });

  it("ignores events that are not page_height", () => {
    expect(
      frame.schedulerHeight({
        origin: "https://calendly.com",
        data: {
          event: "calendly.event_type_viewed",
          payload: { height: "602px" },
        },
      }),
    ).toBeNull();
  });

  // hideDetails="phone": the reported height left ~120px of blank white
  // under the month on a 390px phone, so it is trimmed but never below 520.
  it("trims the phone date picker's height by 80px", () => {
    expect(frame.appliedHeight(602, true)).toBe(522);
  });

  it("never shrinks the phone frame below 520px", () => {
    expect(frame.appliedHeight(560, true)).toBe(520);
  });

  it("applies the reported height unchanged off the phone branch", () => {
    expect(frame.appliedHeight(602, false)).toBe(602);
    expect(frame.appliedHeight(null, true)).toBeNull();
  });

  it("applies the height as an inline style, not by mutating props", () => {
    const source = readFileSync(
      new URL("./CalendlyFrame.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /style=\{height === null \? undefined : \{ height: `\$\{height\}px` \}\}/,
    );
  });
});
