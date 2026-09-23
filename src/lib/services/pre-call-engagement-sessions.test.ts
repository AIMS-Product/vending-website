import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { mergeEngagement, resolveBookingSessions, summariseEngagement } =
  await import("./pre-call-engagement");

const URI = "https://api.calendly.com/scheduled_events/ev-1/invitees/inv-1";
const URI_2 = "https://api.calendly.com/scheduled_events/ev-2/invitees/inv-2";

function links(pairs: [string, string][]) {
  const sessionByInvitee = new Map(pairs);
  const inviteesBySession = new Map<string, string[]>();
  for (const [uri, session] of pairs) {
    inviteesBySession.set(session, [
      ...(inviteesBySession.get(session) ?? []),
      uri,
    ]);
  }
  return { sessionByInvitee, inviteesBySession };
}

const booking = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  leadSubmissionId: null as string | null,
  inviteeUri: URI as string | null,
  inviteeEmail: "wes@x.com" as string | null,
  ...over,
});

describe("resolveBookingSessions", () => {
  it("names a webinar booker through the booking link when there is no lead row", () => {
    // The defect this closes: 10 of 18 browsers watching on 2026-09-23 came
    // from the webinar booking page, had no site lead row, and read as
    // "No session" even though the same browser had just booked.
    const sessions = resolveBookingSessions(
      [booking()],
      new Map(),
      links([[URI, "vp-webinar"]]),
    );
    expect(sessions.get("b1")).toEqual(["vp-webinar"]);
  });

  it("keeps the lead row's session and adds the booking's own browser", () => {
    // Form on a laptop, booked and watched on a phone: both are theirs, so
    // their watching is the union. Taking one would put a watcher on the
    // call list.
    const sessions = resolveBookingSessions(
      [booking({ leadSubmissionId: "lead-1" })],
      new Map([["lead-1", { sessionId: "vp-form", closeLeadId: null }]]),
      links([[URI, "vp-phone"]]),
    );
    expect(sessions.get("b1")).toEqual(["vp-form", "vp-phone"]);
  });

  it("does not list the same browser twice", () => {
    const sessions = resolveBookingSessions(
      [booking({ leadSubmissionId: "lead-1" })],
      new Map([["lead-1", { sessionId: "vp-1", closeLeadId: null }]]),
      links([[URI, "vp-1"]]),
    );
    expect(sessions.get("b1")).toEqual(["vp-1"]);
  });

  it("ignores a browser that booked for two different people", () => {
    // A setter or a family member booking several people from one browser:
    // whatever that browser watched would otherwise be credited to all.
    const sessions = resolveBookingSessions(
      [
        booking(),
        booking({ id: "b2", inviteeUri: URI_2, inviteeEmail: "other@x.com" }),
      ],
      new Map(),
      links([
        [URI, "vp-shared"],
        [URI_2, "vp-shared"],
      ]),
    );
    expect(sessions.size).toBe(0);
  });

  it("keeps a browser that booked twice for the same person", () => {
    const sessions = resolveBookingSessions(
      [
        booking(),
        booking({ id: "b2", inviteeUri: URI_2, inviteeEmail: "WES@x.com" }),
      ],
      new Map(),
      links([
        [URI, "vp-1"],
        [URI_2, "vp-1"],
      ]),
    );
    expect(sessions.get("b1")).toEqual(["vp-1"]);
    expect(sessions.get("b2")).toEqual(["vp-1"]);
  });

  it("drops a link whose other booking is outside the window, since it cannot be checked", () => {
    const sessions = resolveBookingSessions(
      [booking()],
      new Map(),
      links([
        [URI, "vp-1"],
        [URI_2, "vp-1"],
      ]),
    );
    expect(sessions.size).toBe(0);
  });

  it("leaves a booking with neither route out, so it reads as no session", () => {
    const sessions = resolveBookingSessions(
      [booking(), booking({ id: "b2", inviteeUri: null })],
      new Map(),
      links([]),
    );
    expect(sessions.size).toBe(0);
  });
});

describe("mergeEngagement", () => {
  it("keeps the furthest point per video across browsers", () => {
    const laptop = summariseEngagement([
      { embed_id: "a", max_percent: 25, last_seen_at: "2026-09-23T01:00:00Z" },
    ]);
    const phone = summariseEngagement([
      { embed_id: "a", max_percent: 100, last_seen_at: "2026-09-23T02:00:00Z" },
      { embed_id: "b", max_percent: 50, last_seen_at: "2026-09-23T02:05:00Z" },
    ]);
    const merged = mergeEngagement([laptop, phone]);

    expect(merged.watchedCount).toBe(2);
    expect(merged.videos.find((v) => v.embedId === "a")?.percent).toBe(100);
    expect(merged.finishedCount).toBe(1);
  });
});
