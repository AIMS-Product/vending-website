import { describe, expect, it } from "vitest";
import type { CallCreditRow } from "@/lib/services/call-credit";
import { buildPreCallBriefing, coldBookings } from "./pre-call-briefing";
import type { PreCallEngagement } from "./pre-call-engagement";

const NOW = new Date("2026-09-21T12:00:00Z");

function call(
  overrides: Partial<CallCreditRow> & { id: string },
): CallCreditRow {
  return {
    inviteeName: "Sam Rivera",
    inviteeEmail: "sam@example.com",
    calendar: "Lane 1",
    startAt: "2026-09-22T15:00:00Z",
    bookedAt: "2026-09-20T09:00:00Z",
    canceled: false,
    credit: { who: "Ari", kind: "calendly_tracking", evidence: "utm_term" },
    chat: null,
    leadSubmissionId: "lead-1",
    closeSetter: null,
    ...overrides,
  } as CallCreditRow;
}

const watched: PreCallEngagement = {
  watchedCount: 3,
  totalVideos: 15,
  finishedCount: 2,
  videos: [],
  lastSeenAt: "2026-09-20T10:00:00Z",
};

describe("buildPreCallBriefing", () => {
  it("keeps only upcoming calls, soonest first", () => {
    const rows = buildPreCallBriefing({
      rows: [
        call({ id: "later", startAt: "2026-09-25T15:00:00Z" }),
        call({ id: "past", startAt: "2026-09-20T15:00:00Z" }),
        call({ id: "soon", startAt: "2026-09-21T18:00:00Z" }),
      ],
      sessionByLead: new Map(),
      engagementBySession: new Map(),
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(["soon", "later"]);
  });

  it("drops canceled calls and anything past the horizon", () => {
    const rows = buildPreCallBriefing({
      rows: [
        call({ id: "canceled", canceled: true }),
        call({ id: "far", startAt: "2026-11-01T15:00:00Z" }),
        call({ id: "keep" }),
      ],
      sessionByLead: new Map(),
      engagementBySession: new Map(),
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(["keep"]);
  });

  it("attaches engagement through the lead's session id", () => {
    const [row] = buildPreCallBriefing({
      rows: [call({ id: "a" })],
      sessionByLead: new Map([["lead-1", "vp-1"]]),
      engagementBySession: new Map([["vp-1", watched]]),
      now: NOW,
    });

    expect(row.engagement.watchedCount).toBe(3);
    expect(row.unknownSession).toBe(false);
  });

  it("separates a booking with no session id from one that watched nothing", () => {
    const [noSession, nothingWatched] = buildPreCallBriefing({
      rows: [
        call({
          id: "a",
          leadSubmissionId: null,
          startAt: "2026-09-21T13:00:00Z",
        }),
        call({
          id: "b",
          leadSubmissionId: "lead-2",
          startAt: "2026-09-21T14:00:00Z",
        }),
      ],
      sessionByLead: new Map([["lead-2", "vp-2"]]),
      engagementBySession: new Map(),
      now: NOW,
    });

    expect(noSession.unknownSession).toBe(true);
    expect(nothingWatched.unknownSession).toBe(false);
    expect(nothingWatched.engagement.watchedCount).toBe(0);
  });
});

describe("buildPreCallBriefing with sessions resolved per booking", () => {
  it("attaches engagement to a booking that has no lead row", () => {
    // A webinar attendee booked on /start: no lead row, but the booking itself
    // was linked to the browser that made it.
    const [row] = buildPreCallBriefing({
      rows: [call({ id: "webinar", leadSubmissionId: null })],
      sessionByBooking: new Map([["webinar", "vp-9"]]),
      engagementBySession: new Map([["vp-9", watched]]),
      now: NOW,
    });

    expect(row.unknownSession).toBe(false);
    expect(row.engagement.watchedCount).toBe(3);
  });

  it("treats a booking missing from the map as no session", () => {
    const [row] = buildPreCallBriefing({
      rows: [call({ id: "a" })],
      sessionByBooking: new Map(),
      engagementBySession: new Map([["vp-1", watched]]),
      now: NOW,
    });

    expect(row.unknownSession).toBe(true);
  });
});

describe("coldBookings", () => {
  it("is the outreach list: watched nothing, and we would know if they had", () => {
    const briefing = buildPreCallBriefing({
      rows: [
        call({
          id: "engaged",
          leadSubmissionId: "lead-1",
          startAt: "2026-09-21T13:00:00Z",
        }),
        call({
          id: "cold",
          leadSubmissionId: "lead-2",
          startAt: "2026-09-21T14:00:00Z",
        }),
        call({
          id: "unknown",
          leadSubmissionId: null,
          startAt: "2026-09-21T15:00:00Z",
        }),
      ],
      sessionByLead: new Map([
        ["lead-1", "vp-1"],
        ["lead-2", "vp-2"],
      ]),
      engagementBySession: new Map([["vp-1", watched]]),
      now: NOW,
    });

    expect(coldBookings(briefing).map((r) => r.id)).toEqual(["cold"]);
  });
});
