import { describe, expect, it, vi } from "vitest";
import { preCallVideos } from "@/lib/content/pre-call-resources";

const hero = preCallVideos[0];
const second = preCallVideos[1];

const bookings = [
  {
    id: "b-engaged",
    inviteeName: "Sam Rivera",
    inviteeEmail: "sam@x.com",
    startAt: "2026-09-25T15:00:00Z",
    canceled: false,
    leadSubmissionId: "lead-1",
  },
  {
    id: "b-cold",
    inviteeName: "Dana Cole",
    inviteeEmail: "dana@x.com",
    startAt: "2026-09-24T15:00:00Z",
    canceled: false,
    leadSubmissionId: "lead-2",
  },
  {
    id: "b-nosession",
    inviteeName: "Kim Lee",
    inviteeEmail: "kim@x.com",
    startAt: "2026-09-23T15:00:00Z",
    canceled: false,
    leadSubmissionId: null,
  },
];

const views = [
  {
    vp_session_id: "vp-1",
    embed_id: hero.embedId,
    max_percent: 100,
    duration_seconds: 120,
    last_seen_at: "2026-09-21T10:00:00Z",
  },
  {
    vp_session_id: "vp-1",
    embed_id: second.embedId,
    max_percent: 50,
    duration_seconds: 60,
    last_seen_at: "2026-09-21T11:00:00Z",
  },
];

vi.mock("@/lib/services/call-credit-data", () => ({
  buildCallCreditReport: async () => ({
    rows: bookings,
    summary: {},
    connected: true,
    since: "",
  }),
}));
vi.mock("@/lib/services/pre-call-engagement", () => ({
  loadLeadFacts: async () =>
    new Map([
      ["lead-1", { sessionId: "vp-1", closeLeadId: null }],
      ["lead-2", { sessionId: "vp-2", closeLeadId: null }],
    ]),
  loadEngagementBySession: async () => new Map(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ in: async () => ({ data: views, error: null }) }),
    }),
  }),
}));

const { getVideoEngagementReport } = await import("./video-engagement-report");

describe("getVideoEngagementReport", () => {
  it("separates engaged, cold, and can't-tell", async () => {
    const report = await getVideoEngagementReport({
      now: new Date("2026-09-21T12:00:00Z"),
    });

    expect(report.bookedCount).toBe(3);
    expect(report.watcherCount).toBe(1);
    // Booked, we have a session, they opened nothing — the call list.
    expect(report.coldCount).toBe(1);
    // Booked with no session: silence, not a zero.
    expect(report.unknownCount).toBe(1);
  });

  it("reports furthest point as time, not as time spent", async () => {
    const report = await getVideoEngagementReport({
      now: new Date("2026-09-21T12:00:00Z"),
    });
    const sam = report.people.find((p) => p.name === "Sam Rivera");

    // 100% of 120s + 50% of 60s = 150s. A rewatch would not add to this.
    expect(sam?.secondsReached).toBe(150);
    expect(sam?.videosStarted).toBe(2);
    expect(sam?.videosMostlyWatched).toBe(1);
    expect(sam?.deepest?.label).toBe(hero.label);
  });

  it("puts the engaged above the cold", async () => {
    const report = await getVideoEngagementReport({
      now: new Date("2026-09-21T12:00:00Z"),
    });
    expect(report.people[0].name).toBe("Sam Rivera");
  });

  it("builds a per-video drop-off that only counts booked prospects", async () => {
    const report = await getVideoEngagementReport({
      now: new Date("2026-09-21T12:00:00Z"),
    });
    const top = report.videos.find((v) => v.embedId === hero.embedId);

    expect(top?.started).toBe(1);
    expect(top?.reached100).toBe(1);
    expect(
      report.videos.find((v) => v.embedId === second.embedId)?.reached75,
    ).toBe(0);
    // Every video on the page appears, including the untouched ones.
    expect(report.videos).toHaveLength(preCallVideos.length);
  });
});
