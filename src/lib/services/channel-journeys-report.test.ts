import { describe, expect, it } from "vitest";
import {
  buildChannelJourneys,
  type JourneyLeadRow,
} from "./channel-journeys-report";
import type { ChannelJourney } from "@/lib/content/channel-journeys";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const WINDOW = { start: "2026-09-01", end: "2026-09-18" };

let seed = 0;
function lead(overrides: Partial<JourneyLeadRow> = {}): JourneyLeadRow {
  seed += 1;
  return {
    id: `lead-${seed}`,
    email: `person${seed}@prospect.com`,
    full_name: "Real Person",
    created_at: "2026-09-05T09:00:00.000Z",
    source_path: "/booking-youtube",
    utm_source: "youtube",
    utm_medium: null,
    metadata: {},
    call_booked_at: null,
    closed_won_at: null,
    closed_won_value: null,
    ...overrides,
  };
}

const YOUTUBE: ChannelJourney = {
  key: "youtube",
  label: "YouTube",
  channels: ["YouTube"],
  steps: [
    { key: "seen", kind: "reach", metric: "impressions", label: "Video seen" },
    { key: "page", kind: "page", paths: ["/booking-youtube"], label: "Page" },
    { key: "lead", kind: "lead", label: "Lead" },
    { key: "booked", kind: "booked", label: "Booked" },
    { key: "showed", kind: "showed", label: "Showed" },
    { key: "won", kind: "won", label: "Won" },
  ],
};

function build(
  input: Partial<Parameters<typeof buildChannelJourneys>[0]> = {},
) {
  return buildChannelJourneys({
    leads: [],
    visits: [],
    reach: [],
    webinars: [],
    shows: [],
    sessions: [],
    window: WINDOW,
    now: NOW,
    journeys: [YOUTUBE],
    ...input,
  });
}

const stepOf = (report: ReturnType<typeof buildChannelJourneys>, key: string) =>
  report.lanes[0]?.steps.find((step) => step.key === key);

describe("buildChannelJourneys", () => {
  it("scopes each step to the lane's channel", () => {
    const report = build({
      leads: [lead(), lead({ utm_source: "google", source_path: "/contact" })],
      visits: [
        {
          day: "2026-09-05",
          landing_page: "/booking-youtube",
          utm_source: "youtube",
          utm_campaign: null,
          sessions: 500,
        },
        {
          day: "2026-09-05",
          landing_page: "/booking-youtube",
          utm_source: "google",
          utm_campaign: null,
          sessions: 900,
        },
      ],
    });

    expect(stepOf(report, "page")?.count).toBe(500);
    expect(stepOf(report, "lead")?.count).toBe(1);
    expect(stepOf(report, "lead")?.rate).toBeCloseTo(0.2);
  });

  it("marks a rate that divides two different measurement systems", () => {
    const report = build({
      leads: [lead()],
      reach: [
        {
          day: "2026-09-05",
          channel: "YouTube",
          source: "youtube",
          medium: null,
          impressions: 10_000,
          clicks: null,
        },
      ],
      visits: [
        {
          day: "2026-09-05",
          landing_page: "/booking-youtube",
          utm_source: "youtube",
          utm_campaign: null,
          sessions: 500,
        },
      ],
    });

    // Platform impressions over GA4 sessions: real drop-off shape, not a rate.
    expect(stepOf(report, "page")?.crossSystem).toBe(true);
    // GA4 sessions over our own lead table is also cross-system, but our own
    // lead over our own booked is not.
    expect(stepOf(report, "booked")?.crossSystem).toBe(false);
  });

  it("skips an unmeasured step rather than dividing by it", () => {
    // Nothing reported impressions, so the page step must divide by nothing
    // at all rather than by zero.
    const report = build({
      leads: [lead()],
      visits: [
        {
          day: "2026-09-05",
          landing_page: "/booking-youtube",
          utm_source: "youtube",
          utm_campaign: null,
          sessions: 500,
        },
      ],
    });

    expect(stepOf(report, "seen")?.count).toBeNull();
    expect(stepOf(report, "page")?.rate).toBeNull();
    // The lead step still divides by the page, not by the missing one above it.
    expect(stepOf(report, "lead")?.rate).toBeCloseTo(0.2);
  });

  it("reports leads the lane does not claim instead of absorbing them", () => {
    const report = build({
      leads: [
        lead(),
        lead({ source_path: "/contact" }),
        lead({ source_path: "/contact" }),
      ],
    });

    const lane = report.lanes[0]!;
    expect(stepOf(report, "lead")?.count).toBe(1);
    expect(lane.leadsOffMap).toBe(2);
    expect(lane.offMapPaths).toEqual([{ path: "/contact", leads: 2 }]);
  });

  it("names channels that produced leads and have no lane", () => {
    const report = build({
      leads: [lead({ utm_source: "linkedin", source_path: "/contact" })],
    });

    expect(report.unmappedChannels).toEqual([
      { channel: "LinkedIn", leads: 1 },
    ]);
  });

  it("keeps a call nobody has held yet out of the showed step", () => {
    const booked = lead({ call_booked_at: "2026-09-05T09:00:00.000Z" });
    const held = lead({ call_booked_at: "2026-09-05T09:00:00.000Z" });

    const report = build({
      leads: [booked, held],
      shows: [
        {
          email: booked.email,
          first_sales_call_booked_date: "2026-09-24",
          first_call_show_up: null,
        },
        {
          email: held.email,
          first_sales_call_booked_date: "2026-09-08",
          first_call_show_up: "Yes",
        },
      ],
    });

    expect(stepOf(report, "booked")?.count).toBe(2);
    expect(stepOf(report, "showed")?.count).toBe(1);
    expect(stepOf(report, "showed")?.caveat).toContain("not held yet");
  });

  it("stops the page step where GA4 stops", () => {
    const report = build({
      leads: [lead()],
      visits: [
        {
          day: "2026-09-05",
          landing_page: "/booking-youtube",
          utm_source: "youtube",
          utm_campaign: null,
          sessions: 100,
        },
      ],
    });

    expect(report.visitsThrough).toBe("2026-09-05");
    expect(stepOf(report, "page")?.count).toBe(100);
  });

  it("folds a redirected page into the lane that now renders it", () => {
    const journey: ChannelJourney = {
      ...YOUTUBE,
      channels: ["Instagram"],
      steps: [
        {
          key: "page",
          kind: "page",
          paths: ["/booking-t5-socials"],
          label: "Landers",
        },
        { key: "lead", kind: "lead", label: "Lead" },
      ],
    };

    const report = build({
      journeys: [journey],
      leads: [
        lead({ utm_source: "instagram", source_path: "/booking-b5-socials" }),
      ],
    });

    expect(report.lanes[0]?.steps.find((s) => s.key === "lead")?.count).toBe(1);
    expect(report.lanes[0]?.leadsOffMap).toBe(0);
  });

  it("excludes internal leads unless asked for them", () => {
    const rows = [lead({ email: "adam@modern-amenities.com" }), lead()];
    expect(
      build({ leads: rows }).lanes[0]?.steps.find((s) => s.key === "lead")
        ?.count,
    ).toBe(1);
    expect(
      build({ leads: rows, includeInternal: true }).lanes[0]?.steps.find(
        (s) => s.key === "lead",
      )?.count,
    ).toBe(2);
  });
});

describe("cross-system rates", () => {
  it("drops a cross-system rate that exceeds 100%", () => {
    // GHL counted 100 email clicks, GA4 counted 150 sessions on the page.
    // 150% of clickers did not arrive; the two systems count different things.
    const journey: ChannelJourney = {
      key: "newsletter",
      label: "Newsletter",
      channels: ["Newsletter"],
      steps: [
        { key: "clicked", kind: "reach", metric: "clicks", label: "Clicked" },
        { key: "page", kind: "page", paths: ["/"], label: "Home" },
      ],
    };

    const report = buildChannelJourneys({
      leads: [],
      visits: [
        {
          day: "2026-09-05",
          landing_page: "/",
          utm_source: "newsletter",
          utm_campaign: null,
          sessions: 150,
        },
      ],
      reach: [
        {
          day: "2026-09-05",
          channel: "Newsletter",
          source: "newsletter",
          medium: "email",
          impressions: null,
          clicks: 100,
        },
      ],
      webinars: [],
      shows: [],
      sessions: [],
      window: WINDOW,
      now: NOW,
      journeys: [journey],
    });

    const page = report.lanes[0]?.steps.find((step) => step.key === "page");
    expect(page?.count).toBe(150);
    expect(page?.crossSystem).toBe(true);
    expect(page?.rate).toBeNull();
  });

  it("keeps a same-system rate above 100% visible, because it is a real defect", () => {
    // Both sides from our own tables. If this ever exceeds 100% something is
    // genuinely wrong and hiding it would hide the bug.
    const report = buildChannelJourneys({
      leads: [],
      visits: [],
      reach: [],
      webinars: [],
      shows: [],
      sessions: [],
      window: WINDOW,
      now: NOW,
      journeys: [YOUTUBE],
    });
    expect(
      report.lanes[0]?.steps.find((s) => s.key === "lead")?.rate,
    ).toBeNull();
  });
});
