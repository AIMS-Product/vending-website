import { describe, expect, it, vi } from "vitest";
import { preCallVideos } from "@/lib/content/pre-call-resources";

const hero = preCallVideos[0];
const second = preCallVideos[1];
const TRACKING_START = "2026-09-21T20:49:00Z";
const NOW = new Date("2026-09-21T23:00:00Z");

const bookings = [
  {
    id: "b-engaged",
    inviteeName: "Sam Rivera",
    inviteeEmail: "sam@x.com",
    startAt: "2026-09-25T15:00:00Z",
    bookedAt: "2026-09-21T21:00:00Z",
    canceled: false,
    leadSubmissionId: "lead-1",
  },
  {
    id: "b-cold",
    inviteeName: "Dana Cole",
    inviteeEmail: "dana@x.com",
    startAt: "2026-09-24T15:00:00Z",
    bookedAt: "2026-09-21T22:00:00Z",
    canceled: false,
    leadSubmissionId: "lead-2",
  },
  {
    id: "b-nosession",
    inviteeName: "Kim Lee",
    inviteeEmail: "kim@x.com",
    startAt: "2026-09-23T15:00:00Z",
    bookedAt: "2026-09-21T22:00:00Z",
    canceled: false,
    leadSubmissionId: null,
  },
  // Booked in August, long before anything was recording.
  {
    id: "b-old",
    inviteeName: "Pat Older",
    inviteeEmail: "pat@x.com",
    startAt: "2026-08-25T15:00:00Z",
    bookedAt: "2026-08-20T10:00:00Z",
    canceled: false,
    leadSubmissionId: "lead-3",
  },
];

const views = [
  {
    vp_session_id: "vp-1",
    embed_id: hero.embedId,
    max_percent: 100,
    duration_seconds: 120,
    last_seen_at: "2026-09-21T21:10:00Z",
  },
  {
    vp_session_id: "vp-1",
    embed_id: second.embedId,
    max_percent: 50,
    duration_seconds: 60,
    last_seen_at: "2026-09-21T21:11:00Z",
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
      ["lead-3", { sessionId: "vp-3", closeLeadId: null }],
    ]),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: async () => ({ data: views, error: null }),
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: { first_played_at: TRACKING_START },
            }),
          }),
        }),
      }),
    }),
  }),
}));

const { getVideoEngagementReport } = await import("./video-engagement-report");

describe("getVideoEngagementReport", () => {
  it("separates engaged, cold, can't-tell and not-yet-tracked", async () => {
    const report = await getVideoEngagementReport({ now: NOW });

    expect(report.bookedCount).toBe(4);
    expect(report.watcherCount).toBe(1);
    expect(report.coldCount).toBe(1);
    // Booked with no session: silence, not a zero.
    expect(report.unknownCount).toBe(1);
    // Booked in August, before anything recorded: also silence.
    expect(report.predatesTrackingCount).toBe(1);
    expect(report.trackingStartedAt).toBe(TRACKING_START);
  });

  it("never puts a pre-tracking booking on the call list", async () => {
    // The defect this guards: an August call rendered "None" and was counted
    // as watched-nothing, so a rep would chase someone for not doing something
    // nobody was recording. There is no earlier data to recover, anywhere.
    const report = await getVideoEngagementReport({ now: NOW });
    const pat = report.people.find((p) => p.name === "Pat Older");

    expect(pat?.predatesTracking).toBe(true);
    expect(pat?.videosStarted).toBe(0);
    expect(report.coldCount).toBe(1);
    expect(
      report.people.find((p) => p.name === "Dana Cole")?.predatesTracking,
    ).toBe(false);
  });

  it("reports furthest point as time, not as time spent", async () => {
    const report = await getVideoEngagementReport({ now: NOW });
    const sam = report.people.find((p) => p.name === "Sam Rivera");

    // 100% of 120s + 50% of 60s = 150s. A rewatch would not add to this.
    expect(sam?.secondsReached).toBe(150);
    expect(sam?.videosStarted).toBe(2);
    expect(sam?.videosMostlyWatched).toBe(1);
    expect(sam?.deepest?.label).toBe(hero.label);
  });

  it("puts the engaged above everyone else", async () => {
    const report = await getVideoEngagementReport({ now: NOW });
    expect(report.people[0].name).toBe("Sam Rivera");
  });

  it("builds a per-video drop-off that only counts booked prospects", async () => {
    const report = await getVideoEngagementReport({ now: NOW });
    const top = report.videos.find((v) => v.embedId === hero.embedId);

    expect(top?.started).toBe(1);
    expect(top?.reached100).toBe(1);
    expect(
      report.videos.find((v) => v.embedId === second.embedId)?.reached75,
    ).toBe(0);
    expect(report.videos).toHaveLength(preCallVideos.length);
  });
});
