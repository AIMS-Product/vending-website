import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { resolveBookingSessions } = await import("./pre-call-engagement");

const URI = "https://api.calendly.com/scheduled_events/ev-1/invitees/inv-1";

describe("resolveBookingSessions", () => {
  it("names a webinar booker through the booking link when there is no lead row", () => {
    // The defect this closes: 10 of 18 browsers watching on 2026-09-23 came
    // from the webinar booking page, had no site lead row, and read as
    // "No session" even though the same browser had just booked.
    const sessions = resolveBookingSessions(
      [{ id: "b1", leadSubmissionId: null, inviteeUri: URI }],
      new Map(),
      new Map([[URI, "vp-webinar"]]),
    );
    expect(sessions.get("b1")).toBe("vp-webinar");
  });

  it("keeps the lead row's session when both exist, so no existing match moves", () => {
    const sessions = resolveBookingSessions(
      [{ id: "b1", leadSubmissionId: "lead-1", inviteeUri: URI }],
      new Map([["lead-1", { sessionId: "vp-form", closeLeadId: null }]]),
      new Map([[URI, "vp-booking"]]),
    );
    expect(sessions.get("b1")).toBe("vp-form");
  });

  it("falls through to the booking link when the lead row has no session", () => {
    const sessions = resolveBookingSessions(
      [{ id: "b1", leadSubmissionId: "lead-1", inviteeUri: URI }],
      new Map([["lead-1", { sessionId: null, closeLeadId: "lead_x" }]]),
      new Map([[URI, "vp-booking"]]),
    );
    expect(sessions.get("b1")).toBe("vp-booking");
  });

  it("leaves a booking with neither route out, so it reads as no session", () => {
    const sessions = resolveBookingSessions(
      [
        { id: "b1", leadSubmissionId: null, inviteeUri: URI },
        { id: "b2", leadSubmissionId: null },
      ],
      new Map(),
      new Map(),
    );
    expect(sessions.size).toBe(0);
  });
});
