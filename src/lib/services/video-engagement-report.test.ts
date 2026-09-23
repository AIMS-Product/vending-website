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
  // Booked before tracking began, but opened a video after it did, with the
  // call still ahead of them. Real: one of the first three watchers on prod
  // booked three days before recording started and had a call the next day.
  {
    id: "b-old-watcher",
    inviteeName: "Michelle Early",
    inviteeEmail: "michelle@x.com",
    startAt: "2026-09-22T19:30:00Z",
    bookedAt: "2026-09-18T00:27:00Z",
    canceled: false,
    leadSubmissionId: "lead-4",
  },
  // A webinar attendee: booked on /start, never filled a site form, so no
  // lead row. The booking link is the only route to their browser.
  {
    id: "b-webinar",
    inviteeName: "Wes Binar",
    inviteeEmail: "wes@x.com",
    startAt: "2026-09-26T15:00:00Z",
    bookedAt: "2026-09-21T22:30:00Z",
    canceled: false,
    leadSubmissionId: null,
    inviteeUri: "https://api.calendly.com/scheduled_events/ev-5/invitees/inv-5",
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
  {
    vp_session_id: "vp-4",
    embed_id: hero.embedId,
    max_percent: 80,
    duration_seconds: 120,
    last_seen_at: "2026-09-21T22:40:00Z",
  },
  {
    vp_session_id: "vp-5",
    embed_id: second.embedId,
    max_percent: 25,
    duration_seconds: 60,
    last_seen_at: "2026-09-21T22:45:00Z",
  },
];

// Close's mirror. Sam's first call was the 25th, so it matches his booking;
// Dana's first call was an earlier one in August, so this booking is not it.
const mirror = new Map([
  [
    "sam@x.com",
    [
      {
        email: "sam@x.com",
        first_sales_call_booked_date: "2026-09-25",
        first_call_show_up: "yes",
      },
    ],
  ],
  [
    "dana@x.com",
    [
      {
        email: "dana@x.com",
        first_sales_call_booked_date: "2026-08-02",
        first_call_show_up: "no",
      },
    ],
  ],
]);

vi.mock("@/lib/services/call-credit-data", () => ({
  buildCallCreditReport: async () => ({
    rows: bookings,
    summary: {},
    connected: true,
    since: "",
  }),
}));
vi.mock("@/lib/services/calendly-booking-sessions", async (importActual) => ({
  ...(await importActual<
    typeof import("@/lib/services/calendly-booking-sessions")
  >()),
  loadBookingLinks: async () => ({
    sessionByInvitee: new Map([
      ["https://api.calendly.com/scheduled_events/ev-5/invitees/inv-5", "vp-5"],
    ]),
    inviteesBySession: new Map([
      [
        "vp-5",
        ["https://api.calendly.com/scheduled_events/ev-5/invitees/inv-5"],
      ],
    ]),
  }),
}));
vi.mock("@/lib/services/video-engagement-outcomes", async (importActual) => ({
  ...(await importActual<
    typeof import("@/lib/services/video-engagement-outcomes")
  >()),
  loadFirstCallMirror: async () => mirror,
}));
vi.mock("@/lib/services/pre-call-engagement", async (importActual) => ({
  ...(await importActual<
    typeof import("@/lib/services/pre-call-engagement")
  >()),
  loadLeadFacts: async () =>
    new Map([
      ["lead-1", { sessionId: "vp-1", closeLeadId: null }],
      ["lead-2", { sessionId: "vp-2", closeLeadId: null }],
      ["lead-3", { sessionId: "vp-3", closeLeadId: null }],
      ["lead-4", { sessionId: "vp-4", closeLeadId: null }],
    ]),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      // Both reads filter on VIDEO_VIEWS_TRUSTED_FROM with .gte().
      select: () => ({
        in: () => ({ gte: async () => ({ data: views, error: null }) }),
        gte: () => ({
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
  }),
}));

const { getVideoEngagementReport } = await import("./video-engagement-report");

describe("getVideoEngagementReport", () => {
  it("separates engaged, cold, can't-tell and not-yet-tracked", async () => {
    const report = await getVideoEngagementReport({ now: NOW });

    expect(report.bookedCount).toBe(6);
    expect(report.watcherCount).toBe(3);
    expect(report.coldCount).toBe(1);
    // Booked with no session: silence, not a zero.
    expect(report.unknownCount).toBe(1);
    // Booked in August, before anything recorded: also silence.
    expect(report.predatesTrackingCount).toBe(1);
    expect(report.trackingStartedAt).toBe(TRACKING_START);
  });

  it("decomposes the window exactly, with no bucket counted twice", async () => {
    // The defect this guards: "can't tell" counted every session-less booking
    // in the window, including the thousands that predate tracking, so the
    // strip showed 3,038 booked against 3,025 before-tracking and 2,362
    // can't-tell — three buckets summing well past the total. A reader cannot
    // tell which number to trust when they cannot both be true.
    const report = await getVideoEngagementReport({ now: NOW });

    expect(report.watcherCount + report.coldCount + report.unknownCount).toBe(
      report.people.length,
    );
    expect(report.people.length + report.predatesTrackingCount).toBe(
      report.bookedCount,
    );
  });

  it("never puts a pre-tracking booking on the call list", async () => {
    // The defect this guards: an August call rendered "None" and was counted
    // as watched-nothing, so a rep would chase someone for not doing something
    // nobody was recording. There is no earlier data to recover, anywhere.
    // It is counted, so the gap is visible, but never listed as a row.
    const report = await getVideoEngagementReport({ now: NOW });

    expect(report.people.find((p) => p.name === "Pat Older")).toBeUndefined();
    expect(report.predatesTrackingCount).toBe(1);
    expect(report.coldCount).toBe(1);
    expect(
      report.people.find((p) => p.name === "Dana Cole")?.predatesTracking,
    ).toBe(false);
  });

  it("tells a booking with no session apart from one that watched nothing", async () => {
    // The defect this guards: both render as a blank, so a rep phones someone
    // whose watching we simply had no way to see. "No session" and "opened
    // nothing" are different answers and only one of them is a reason to call.
    const report = await getVideoEngagementReport({ now: NOW });

    expect(report.people.find((p) => p.name === "Kim Lee")?.hasSession).toBe(
      false,
    );
    expect(report.people.find((p) => p.name === "Dana Cole")?.hasSession).toBe(
      true,
    );
    // Kim is listed but never counted as cold: the call list is only people we
    // were actually watching.
    expect(report.coldCount).toBe(1);
  });

  it("keeps someone who booked before tracking and watched after it", async () => {
    // The defect this guards: bounding the query by the tracking start date
    // made 90 days cheap by deleting everyone who booked earlier — including
    // the watchers among them. Most calls on the books were set before
    // recording began, so that is the row a rep needs most, and it vanished
    // while the page still looked correct.
    const report = await getVideoEngagementReport({ now: NOW });
    const michelle = report.people.find((p) => p.name === "Michelle Early");

    expect(michelle?.predatesTracking).toBe(false);
    expect(michelle?.videosStarted).toBe(1);
    expect(michelle?.upcoming).toBe(true);
    expect(report.watcherCount).toBe(3);
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

    expect(top?.started).toBe(2);
    expect(
      report.videos.find((v) => v.embedId === second.embedId)?.started,
    ).toBe(2);
    expect(top?.reached100).toBe(1);
    expect(
      report.videos.find((v) => v.embedId === second.embedId)?.reached75,
    ).toBe(0);
    expect(report.videos).toHaveLength(preCallVideos.length);
  });

  it("names a webinar booker with no lead row through the booking link", async () => {
    // The defect this closes: 10 of the 18 browsers watching on 2026-09-23
    // came from the webinar booking page with no site lead row, and every one
    // read "No session" while the same browser had just booked.
    const report = await getVideoEngagementReport({ now: NOW });
    const wes = report.people.find((p) => p.name === "Wes Binar");

    expect(wes?.hasSession).toBe(true);
    expect(wes?.videosStarted).toBe(1);
    expect(report.linksAvailable).toBe(true);
  });

  it("counts tracked people as exactly opened + watched nothing + can't tell", async () => {
    const report = await getVideoEngagementReport({ now: NOW });
    expect(report.trackedCount).toBe(
      report.watcherCount + report.coldCount + report.unknownCount,
    );
    expect(report.trackedCount).toBe(report.people.length);
  });

  it("reads Close's show answer only onto the booking that is the first call", async () => {
    // The defect this guards: Close's show field is about the FIRST sales
    // call. Dana's first call was in August; reading its "no" onto this
    // booking would report a no-show for a call nobody logged.
    const report = await getVideoEngagementReport({
      now: new Date("2026-09-28T12:00:00Z"),
    });
    const sam = report.people.find((p) => p.name === "Sam Rivera");
    const dana = report.people.find((p) => p.name === "Dana Cole");

    expect(sam?.firstCall).toBe("held");
    expect(dana?.firstCall).toBe("notFirstCall");
    expect(report.showUp).toEqual({
      connected: true,
      watched: { held: 1, noShow: 0 },
      watchedNothing: { held: 0, noShow: 0 },
    });
  });
});
