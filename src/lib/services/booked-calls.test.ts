import { describe, expect, it } from "vitest";
import {
  buildBookedCalls,
  isFirstCall,
  recentWeekStarts,
  weekStartOf,
  type BookingRow,
} from "@/lib/services/booked-calls";

function booking(over: Partial<BookingRow> = {}): BookingRow {
  return {
    inviteeEmail: "a@x.com",
    status: "booked",
    eventName: "Vendingpreneurs Consultation Call",
    bookedAt: "2026-09-09T15:00:00.000Z",
    createdAt: "2026-09-09T15:00:00.000Z",
    ...over,
  };
}

describe("isFirstCall", () => {
  it("keeps first calls and drops the later-stage names on the live calendar", () => {
    for (const name of [
      "Vendingpreneurs Consultation Call",
      "Vending Route Advisory Call",
      "New Vendingpreneur Strategy Call",
      "Vending Accelerator Call",
    ]) {
      expect(isFirstCall(name)).toBe(true);
    }
    for (const name of [
      "Vendingpreneurs Momentum - Next Steps",
      "Vendingpreneurs Onboarding Call",
      "Vendingpreneurs Rescheduled Call",
      "Vendingpreneurs Follow-Up",
      "30 Minute Meeting",
      "New Meeting",
      "Route Planning Call",
    ]) {
      expect(isFirstCall(name)).toBe(false);
    }
  });
});

describe("weekStartOf", () => {
  it("snaps to Monday, and a Monday is its own week", () => {
    expect(weekStartOf("2026-09-14")).toBe("2026-09-14");
    expect(weekStartOf("2026-09-20")).toBe("2026-09-14");
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07");
  });
});

describe("recentWeekStarts", () => {
  it("ends with the week in progress, oldest first", () => {
    expect(recentWeekStarts("2026-09-16", 3)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });
});

describe("buildBookedCalls", () => {
  const weekStarts = ["2026-09-07", "2026-09-14"];

  it("dates a booking by Calendly's booked-at, not by when we mirrored it", () => {
    // The row was imported during the 09-14 week; the call was booked in the
    // 09-07 week. The week it belongs to is the week it was booked.
    const report = buildBookedCalls({
      bookings: [
        booking({
          bookedAt: "2026-09-09T15:00:00.000Z",
          createdAt: "2026-09-14T19:05:00.000Z",
        }),
      ],
      funnels: [{ email: "a@x.com", funnel: "YouTube" }],
      weekStarts,
    });
    expect(report.weeks[0]).toMatchObject({
      weekStart: "2026-09-07",
      marketing: 1,
      byFunnel: [{ funnel: "YouTube", booked: 1 }],
    });
    expect(report.weeks[1].marketing).toBe(0);
  });

  it("splits reactivation out and never counts it as marketing", () => {
    const report = buildBookedCalls({
      bookings: [
        booking({ inviteeEmail: "a@x.com" }),
        booking({ inviteeEmail: "b@x.com" }),
      ],
      funnels: [
        { email: "a@x.com", funnel: "Reactivation Scrapers" },
        { email: "b@x.com", funnel: "Website" },
      ],
      weekStarts,
    });
    expect(report.weeks[0]).toMatchObject({
      marketing: 1,
      reactivationSeen: 1,
      byFunnel: [{ funnel: "Website", booked: 1 }],
    });
  });

  it("leaves a canceled booking out rather than reporting a number we cannot trust", () => {
    const report = buildBookedCalls({
      bookings: [booking(), booking({ status: "canceled" })],
      funnels: [{ email: "a@x.com", funnel: "Instagram" }],
      weekStarts,
    });
    expect(report.weeks[0]).toMatchObject({ marketing: 1 });
    expect(report.weeks[0]).not.toHaveProperty("canceled");
  });

  it("ignores later-stage calls entirely", () => {
    const report = buildBookedCalls({
      bookings: [
        booking({ eventName: "Vendingpreneurs Onboarding Call" }),
        booking({ eventName: "Vendingpreneurs Next Steps Call" }),
      ],
      funnels: [{ email: "a@x.com", funnel: "Website" }],
      weekStarts,
    });
    expect(report.weeks[0]).toMatchObject({ marketing: 0 });
  });

  it("names a booking with no Close lead rather than dropping it", () => {
    const report = buildBookedCalls({
      bookings: [
        booking({
          inviteeEmail: "new@x.com",
          bookedAt: "2026-09-15T15:00:00.000Z",
        }),
      ],
      funnels: [],
      weekStarts,
    });
    expect(report.weeks[1].byFunnel).toEqual([
      { funnel: "Not in Close yet", booked: 1 },
    ]);
    expect(report.notInCloseYet).toBe(1);
  });

  it("leaves a week with no bookings at zero rather than absent", () => {
    const report = buildBookedCalls({
      bookings: [],
      funnels: [],
      weekStarts,
    });
    expect(report.weeks.map((week) => week.weekStart)).toEqual(weekStarts);
    expect(report.weeks.every((week) => week.marketing === 0)).toBe(true);
  });
});
