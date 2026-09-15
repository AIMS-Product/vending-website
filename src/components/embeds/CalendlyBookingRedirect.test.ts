import { describe, expect, it } from "vitest";
import { __testing } from "./CalendlyBookingRedirect";

const { isEventScheduled, DESTINATION } = __testing;

function message(origin: string, data: unknown): MessageEvent {
  return { origin, data } as MessageEvent;
}

describe("CalendlyBookingRedirect origin guard", () => {
  it("accepts a confirmed booking from Calendly", () => {
    expect(
      isEventScheduled(
        message("https://calendly.com", { event: "calendly.event_scheduled" }),
      ),
    ).toBe(true);
  });

  it("accepts Calendly subdomains", () => {
    expect(
      isEventScheduled(
        message("https://assets.calendly.com", {
          event: "calendly.event_scheduled",
        }),
      ),
    ).toBe(true);
  });

  // The guard is the security boundary: message events arrive from any frame,
  // so a look-alike origin must not be able to navigate our visitors.
  it.each([
    "https://calendly.com.evil.test",
    "https://evilcalendly.com",
    "https://calendly.evil.com",
    "http://calendly.com",
    "https://widget.manychat.com",
  ])("rejects %s", (origin) => {
    expect(
      isEventScheduled(message(origin, { event: "calendly.event_scheduled" })),
    ).toBe(false);
  });

  it("ignores Calendly's other lifecycle events", () => {
    for (const event of [
      "calendly.profile_page_viewed",
      "calendly.event_type_viewed",
      "calendly.date_and_time_selected",
    ]) {
      expect(isEventScheduled(message("https://calendly.com", { event }))).toBe(
        false,
      );
    }
  });

  it("survives junk payloads", () => {
    for (const data of [null, undefined, "scheduled", 42, []]) {
      expect(isEventScheduled(message("https://calendly.com", data))).toBe(
        false,
      );
    }
  });

  it("sends bookers to the pre-call resources page", () => {
    expect(DESTINATION).toBe("/pre-call-resources");
  });
});
