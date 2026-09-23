import { describe, expect, it } from "vitest";
import { __testing } from "./CalendlyBookingRedirect";

const { isEventScheduled, inviteeUriOf, DESTINATION } = __testing;

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

describe("CalendlyBookingRedirect invitee id", () => {
  const uri = "https://api.calendly.com/scheduled_events/ev-1/invitees/inv-1";

  it("reads the invitee URI Calendly sends with a confirmed booking", () => {
    expect(
      inviteeUriOf(
        message("https://calendly.com", {
          event: "calendly.event_scheduled",
          payload: { event: { uri: "x" }, invitee: { uri } },
        }),
      ),
    ).toBe(uri);
  });

  it("returns null rather than throwing on odd payloads", () => {
    for (const data of [
      { event: "calendly.event_scheduled" },
      { event: "calendly.event_scheduled", payload: null },
      { event: "calendly.event_scheduled", payload: { invitee: 42 } },
      { event: "calendly.event_scheduled", payload: { invitee: { uri: 7 } } },
      {
        event: "calendly.event_scheduled",
        payload: { invitee: { uri: "x".repeat(301) } },
      },
    ]) {
      expect(inviteeUriOf(message("https://calendly.com", data))).toBeNull();
    }
  });
});
