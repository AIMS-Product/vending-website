import { describe, expect, it } from "vitest";
import {
  classifyEventType,
  mappingReviewState,
  EVENT_TYPE_ENTRIES,
} from "@/lib/services/calendly-event-class";
import {
  attributeBooking,
  attributionFor,
  BOOKED_METRICS,
  dayKeyIn,
  readBookedMetric,
  UNATTRIBUTED_LABEL,
  type BookingRow,
  type FunnelRow,
} from "@/lib/services/booked-metrics";

/** A booking made at 6pm Eastern on 9/14, which is 9/15 in UTC. */
function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    inviteeEmail: "buyer@example.com",
    status: "booked",
    eventName: "Vendingpreneurs Consultation Call",
    eventTypeUri:
      "https://api.calendly.com/event_types/5603d7cc-ca99-4192-a11e-a55b186ce61d",
    bookedAt: "2026-09-14T18:00:00.000Z",
    eventStartAt: "2026-09-16T15:00:00.000Z",
    utmSource: null,
    ...overrides,
  };
}

function funnel(overrides: Partial<FunnelRow> = {}): FunnelRow {
  return {
    email: "buyer@example.com",
    funnel: "Website",
    firstSalesCallBookedDate: null,
    ...overrides,
  };
}

describe("the mapping", () => {
  it("classifies every event type it lists, by URI or by name", () => {
    for (const entry of EVENT_TYPE_ENTRIES) {
      for (const uri of entry.eventTypeUris) {
        const result = classifyEventType(uri, entry.name);
        expect(result.reviewed).toBe(true);
        expect(result.class).toBe(entry.class);
      }
    }
  });

  it("lets the name decide when one URI was renamed across classes", () => {
    // f6b52602 carries both `30 Minute Meeting` and `VendHub | VendScout Demo`.
    // A URI that cannot pin one class must not silently pick the last one read.
    const uri =
      "https://api.calendly.com/event_types/f6b52602-3747-4754-bbd9-016f534634ee";
    expect(classifyEventType(uri, "30 Minute Meeting").class).toBe("internal");
    expect(classifyEventType(uri, "VendHub | VendScout Demo").class).toBe(
      "other_brand",
    );
    // With no name to go on, it is unreviewed rather than a guess.
    expect(classifyEventType(uri, null).reviewed).toBe(false);
  });

  it("falls back to the exact name when the URI is new", () => {
    // A second host adding the same calendar produces an unseen URI. One name
    // in production already spans 18 of them.
    const result = classifyEventType(
      "https://api.calendly.com/event_types/00000000-0000-0000-0000-000000000000",
      "Vendingpreneurs Consultation Call",
    );
    expect(result).toMatchObject({
      reviewed: true,
      class: "new",
      matchedBy: "name",
    });
  });

  it("absorbs the known misspelling rather than dropping it", () => {
    expect(classifyEventType(null, "Vendingprenuers Consultation").class).toBe(
      "new",
    );
  });

  it("refuses to guess at an event type nobody has classified", () => {
    const result = classifyEventType(
      null,
      "Vendingpreneurs Brand New Calendar",
    );
    expect(result.reviewed).toBe(false);
    expect(result.class).toBeNull();
  });

  // The regressions that made this module necessary. Each of these was counted
  // as a new sales call by at least one of the three regexes it replaces.
  it.each([
    ["30 Minute Meeting", "internal"],
    ["One-off meeting", "internal"],
    ["New Meeting", "internal"],
    ["60 Minute Meeting", "internal"],
    ["VendHub Consultation Call", "other_brand"],
    ["Acquisition Ace Strategy Call", "other_brand"],
    ["AI Operator Collective Consult Call", "other_brand"],
    ["Vendingpreneurs Onboarding Call", "onboarding"],
    ["Vendingpreneurs Rescheduled Call", "reschedule"],
    ["Vendingpreneurs Next Steps Call", "follow_up"],
  ])("does not count %s as a new sales call", (name, expected) => {
    expect(classifyEventType(null, name).class).toBe(expected);
  });

  it("reports how much of the mapping is still a draft", () => {
    const state = mappingReviewState();
    expect(state.total).toBe(EVENT_TYPE_ENTRIES.length);
    expect(state.reviewed + state.draft).toBe(state.total);
  });
});

describe("the day boundary", () => {
  it("uses the business timezone, not UTC", () => {
    // 2026-09-14T23:30Z is still 7:30pm on the 14th in Eastern.
    expect(dayKeyIn("2026-09-14T23:30:00.000Z", "America/New_York")).toBe(
      "2026-09-14",
    );
    expect(dayKeyIn("2026-09-14T23:30:00.000Z", "UTC")).toBe("2026-09-14");
    // 2026-09-15T02:00Z is 10pm on the 14th in Eastern. This is the gap that
    // made the spec's "35" and the business day's "33" different numbers.
    expect(dayKeyIn("2026-09-15T02:00:00.000Z", "America/New_York")).toBe(
      "2026-09-14",
    );
    expect(dayKeyIn("2026-09-15T02:00:00.000Z", "UTC")).toBe("2026-09-15");
  });

  it("counts an evening booking on the business day it was made", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [booking({ bookedAt: "2026-09-15T02:00:00.000Z" })],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
  });

  it("returns null, never zero, for a metric with no source here", () => {
    const result = readBookedMetric("capacityTotalMeetingsBooked", {
      bookings: [],
      funnels: [],
      day: "2026-09-14",
    });
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toBeTruthy();
  });
});

describe("new calls booked (D)", () => {
  it("counts only new business calls", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [
        booking(),
        booking({
          eventTypeUri: null,
          eventName: "Vendingpreneurs Next Steps Call",
        }),
        booking({
          eventTypeUri: null,
          eventName: "Vendingpreneurs Onboarding Call",
        }),
        booking({ eventTypeUri: null, eventName: "30 Minute Meeting" }),
        booking({ eventTypeUri: null, eventName: "VendHub Consultation Call" }),
      ],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
  });

  it("excludes Lane 2 and says how many it removed", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [
        booking({ inviteeEmail: "a@example.com" }),
        booking({ inviteeEmail: "b@example.com" }),
      ],
      funnels: [
        funnel({ email: "a@example.com", funnel: "Website" }),
        funnel({ email: "b@example.com", funnel: "Reactivation Scrapers" }),
      ],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
    expect(result.coverage.laneTwoExcluded).toBe(1);
  });

  it("keeps Reactivation Email, which is marketing and not Lane 2", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [booking()],
      funnels: [funnel({ funnel: "Reactivation Email" })],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
    expect(result.coverage.laneTwoExcluded).toBe(0);
  });

  it("holds out unreviewed event types instead of counting them as new", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [
        booking(),
        booking({ eventTypeUri: null, eventName: "Some Brand New Calendar" }),
      ],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
    expect(result.coverage.unreviewed).toBe(1);
    expect(result.coverage.unreviewedNames).toEqual([
      "Some Brand New Calendar",
    ]);
  });

  it("never dates a booking by our row-insert time", () => {
    // A backfilled row with no Calendly timestamp once produced "1,899 booked
    // today". It must be undatable, not today's.
    const result = readBookedMetric("newBookedOn", {
      bookings: [booking({ bookedAt: null })],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(0);
    expect(result.coverage.undatable).toBe(1);
  });

  it("counts a booking whose call lands on another day", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [booking({ eventStartAt: "2026-10-06T15:00:00.000Z" })],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
  });

  it("includes a booking cancelled since it was made", () => {
    const result = readBookedMetric("newBookedOn", {
      bookings: [booking({ status: "canceled" })],
      funnels: [funnel()],
      day: "2026-09-14",
    });
    expect(result.value).toBe(1);
  });
});

describe("the metrics that are not D", () => {
  const input = {
    bookings: [
      booking({ inviteeEmail: "a@example.com" }),
      booking({
        inviteeEmail: "b@example.com",
        eventTypeUri: null,
        eventName: "Vendingpreneurs Next Steps Call",
      }),
      booking({
        inviteeEmail: "c@example.com",
        eventTypeUri: null,
        eventName: "Vendingpreneurs Rescheduled Call",
        eventStartAt: "2026-09-14T19:00:00.000Z",
      }),
    ],
    funnels: [
      funnel({
        email: "a@example.com",
        firstSalesCallBookedDate: "2026-09-14",
      }),
      funnel({
        email: "b@example.com",
        firstSalesCallBookedDate: "2026-09-16",
      }),
    ],
    day: "2026-09-14",
  };

  it("counts every booking made today for allBookedOn (C)", () => {
    expect(readBookedMetric("allBookedOn", input).value).toBe(3);
  });

  it("separates follow-ups (E) from reschedules", () => {
    expect(readBookedMetric("followUpBookedOn", input).value).toBe(1);
    expect(readBookedMetric("rescheduleBookedOn", input).value).toBe(1);
  });

  it("counts same-day fills for bookedTodayLandingToday (F)", () => {
    expect(readBookedMetric("bookedTodayLandingToday", input).value).toBe(1);
  });

  it("reads firstCallsOnCalendar (A) from the scheduled date, not the booking", () => {
    expect(readBookedMetric("firstCallsOnCalendar", input).value).toBe(1);
  });

  it("drops cancelled meetings from allMeetingsOnCalendar (B)", () => {
    const value = readBookedMetric("allMeetingsOnCalendar", {
      ...input,
      bookings: [
        booking({ eventStartAt: "2026-09-14T19:00:00.000Z" }),
        booking({
          eventStartAt: "2026-09-14T20:00:00.000Z",
          status: "canceled",
        }),
      ],
    }).value;
    expect(value).toBe(1);
  });

  it("attaches a definition to every metric it can return", () => {
    for (const key of Object.keys(BOOKED_METRICS) as Array<
      keyof typeof BOOKED_METRICS
    >) {
      const result = readBookedMetric(key, input);
      expect(result.metric.definition.length).toBeGreaterThan(20);
      expect(result.metric.label).not.toBe("Booked");
      expect(result.asOf).toBe("2026-09-14");
    }
  });
});

describe("attribution", () => {
  const funnels = new Map<string, string | null>([
    ["known@example.com", "YouTube"],
  ]);

  it("prefers the Close funnel over the UTM", () => {
    expect(
      attributeBooking(
        { inviteeEmail: "known@example.com", utmSource: "google" },
        funnels,
      ),
    ).toMatchObject({ label: "YouTube", via: "close-funnel" });
  });

  it("falls back to the UTM when there is no Close lead", () => {
    expect(
      attributeBooking(
        { inviteeEmail: "new@example.com", utmSource: "google" },
        funnels,
      ),
    ).toMatchObject({ label: "google", via: "utm" });
  });

  it("says unattributed rather than going blank", () => {
    const result = attributeBooking(
      { inviteeEmail: "new@example.com", utmSource: null },
      funnels,
    );
    expect(result.label).toBe(UNATTRIBUTED_LABEL);
    expect(result.via).toBe("none");
  });

  it("resolves outbound bookings that never carried a UTM", () => {
    // The point of joining on email first: these have no UTM by design.
    const split = attributionFor({
      bookings: [
        booking({ inviteeEmail: "a@example.com", utmSource: null }),
        booking({ inviteeEmail: "b@example.com", utmSource: null }),
      ],
      funnels: [
        funnel({ email: "a@example.com", funnel: "Reactivation Scrapers" }),
        funnel({ email: "b@example.com", funnel: "YouTube" }),
      ],
      day: "2026-09-14",
    });
    expect(split).toEqual([
      { label: "Reactivation Scrapers", via: "close-funnel", booked: 1 },
      { label: "YouTube", via: "close-funnel", booked: 1 },
    ]);
  });
});

describe("dayKeyIn caching", () => {
  const ZONES = ["America/New_York", "UTC", "Australia/Sydney"];
  const SAMPLES = [
    "2026-09-14T23:30:00.000Z",
    "2026-09-15T02:00:00.000Z",
    "2026-01-01T04:59:59.999Z",
    "2026-07-04T12:00:00.000Z",
    "2025-12-31T23:59:59.000Z",
  ];

  it("matches toLocaleDateString for every zone, twice over", () => {
    for (const zone of ZONES) {
      for (const iso of SAMPLES) {
        const expected = new Date(iso).toLocaleDateString("en-CA", {
          timeZone: zone,
        });
        // Twice: the second read comes from the cache and must not drift.
        expect(dayKeyIn(iso, zone)).toBe(expected);
        expect(dayKeyIn(iso, zone)).toBe(expected);
      }
    }
  });

  it("keeps null for the unparseable and the absent", () => {
    expect(dayKeyIn(null, "UTC")).toBeNull();
    expect(dayKeyIn("not a date", "UTC")).toBeNull();
    expect(dayKeyIn("not a date", "UTC")).toBeNull();
  });
});
