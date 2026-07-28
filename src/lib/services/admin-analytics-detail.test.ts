import { describe, expect, it } from "vitest";
import {
  buildAcquisitionRollup,
  buildPagesRollup,
  buildQualityRollup,
  type AnalyticsLeadRow,
} from "./admin-analytics-detail";

function makeLead(overrides: Partial<AnalyticsLeadRow> = {}): AnalyticsLeadRow {
  return {
    created_at: "2026-07-15T12:00:00.000Z",
    email: "prospect@gmail.com",
    full_name: "Real Prospect",
    source_path: "/booking-meta",
    landing_path: "/",
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    timeline: null,
    budget: null,
    business_stage: null,
    state_region: null,
    lifecycle_status: "contact_captured",
    close_sync_status: null,
    qualification_summary: {},
    latest_qualification_started_at: null,
    latest_qualification_completed_at: null,
    ...overrides,
  };
}

describe("buildAcquisitionRollup", () => {
  it("classifies channel from medium, source, and referrer", () => {
    const rollup = buildAcquisitionRollup(
      [
        makeLead({ email: "a@x.com", utm_medium: "paid_social" }),
        makeLead({ email: "b@x.com", utm_medium: "cpc" }),
        makeLead({ email: "c@x.com", utm_medium: "email" }),
        makeLead({ email: "d@x.com", utm_medium: "organic" }),
        makeLead({ email: "e@x.com", utm_source: "youtube" }),
        makeLead({
          email: "f@x.com",
          referrer: "https://reddit.com/r/vending",
        }),
        makeLead({ email: "g@x.com" }),
      ],
      new Set(),
    );

    const byLabel = Object.fromEntries(
      rollup.channelMix.map((row) => [row.label, row.count]),
    );
    expect(byLabel).toEqual({
      Paid: 2,
      Email: 1,
      "Organic search": 1,
      "Campaign tagged": 1,
      Referral: 1,
      Direct: 1,
    });
  });

  it("breaks leads down by every UTM parameter, not just source", () => {
    const rollup = buildAcquisitionRollup(
      [
        makeLead({
          email: "a@x.com",
          utm_source: "instagram",
          utm_medium: "paid_social",
          utm_campaign: "july_launch",
          utm_term: "vending",
          utm_content: "reel_a",
        }),
      ],
      new Set(),
    );

    expect(rollup.bySource[0]).toEqual({ label: "instagram", count: 1 });
    expect(rollup.byMedium[0]).toEqual({ label: "paid_social", count: 1 });
    expect(rollup.byCampaign[0]).toEqual({ label: "july_launch", count: 1 });
    expect(rollup.byTerm[0]).toEqual({ label: "vending", count: 1 });
    expect(rollup.byContent[0]).toEqual({ label: "reel_a", count: 1 });
  });

  it("scores each campaign on leads, qualified, and booked", () => {
    const rollup = buildAcquisitionRollup(
      [
        makeLead({
          email: "one@x.com",
          utm_campaign: "july",
          utm_source: "instagram",
          lifecycle_status: "qualified",
        }),
        makeLead({
          email: "two@x.com",
          utm_campaign: "july",
          utm_source: "instagram",
        }),
        makeLead({
          email: "three@x.com",
          utm_campaign: "june",
          utm_source: "youtube",
        }),
      ],
      new Set(["one@x.com"]),
    );

    const july = rollup.topCampaigns.find((row) => row.campaign === "july");
    expect(july).toMatchObject({
      source: "instagram",
      leads: 2,
      qualified: 1,
      booked: 1,
      bookingRatePct: 50,
    });
  });
});

describe("buildPagesRollup", () => {
  it("builds a funnel where each step reports drop-off from the one above", () => {
    const rollup = buildPagesRollup(
      [
        makeLead({
          email: "a@x.com",
          latest_qualification_started_at: "2026-07-15T12:00:00.000Z",
          latest_qualification_completed_at: "2026-07-15T12:05:00.000Z",
          lifecycle_status: "qualified",
        }),
        makeLead({
          email: "b@x.com",
          latest_qualification_started_at: "2026-07-15T12:00:00.000Z",
          latest_qualification_completed_at: "2026-07-15T12:05:00.000Z",
          lifecycle_status: "qualified",
        }),
        makeLead({
          email: "c@x.com",
          latest_qualification_started_at: "2026-07-15T12:00:00.000Z",
        }),
        makeLead({ email: "d@x.com" }),
      ],
      new Set(["a@x.com"]),
    );

    const [captured, started, finished, qualified, booked] = rollup.funnel;
    expect(captured).toMatchObject({ count: 4, ofTopPct: 100 });
    expect(started).toMatchObject({
      count: 3,
      ofTopPct: 75,
      ofPreviousPct: 75,
    });
    expect(finished?.count).toBe(2);
    // 2 of the 3 who started actually finished.
    expect(finished?.ofPreviousPct).toBe(66.7);
    expect(qualified?.count).toBe(2);
    expect(booked).toMatchObject({ count: 1, ofTopPct: 25 });
  });

  it("groups referrers by host so one site is one row", () => {
    const rollup = buildPagesRollup(
      [
        makeLead({
          email: "a@x.com",
          referrer: "https://www.google.com/search?q=1",
        }),
        makeLead({
          email: "b@x.com",
          referrer: "https://google.com/search?q=2",
        }),
        makeLead({ email: "c@x.com", referrer: null }),
      ],
      new Set(),
    );

    expect(rollup.byReferrer[0]).toEqual({ label: "google.com", count: 2 });
  });

  it("separates the landing page from the page the form was submitted on", () => {
    const rollup = buildPagesRollup(
      [
        makeLead({
          email: "a@x.com",
          landing_path: "/",
          source_path: "/booking-meta",
        }),
        makeLead({
          email: "b@x.com",
          landing_path: "/",
          source_path: "/contact",
        }),
      ],
      new Set(),
    );

    expect(rollup.byLandingPage).toEqual([{ label: "/", count: 2 }]);
    expect(rollup.bySubmitPage).toHaveLength(2);
  });
});

describe("buildQualityRollup", () => {
  it("reads the fit result the visitor was shown from the qualification summary", () => {
    const rollup = buildQualityRollup([
      makeLead({
        email: "a@x.com",
        qualification_summary: { qualification_thank_you_state: "perfect_fit" },
      }),
      makeLead({
        email: "b@x.com",
        qualification_summary: { qualification_thank_you_state: "perfect_fit" },
      }),
      makeLead({
        email: "c@x.com",
        qualification_summary: { qualification_band: "nurture" },
      }),
      // Finished but unscored, and never finished at all.
      makeLead({
        email: "d@x.com",
        latest_qualification_completed_at: "2026-07-15T12:05:00.000Z",
      }),
      makeLead({ email: "e@x.com" }),
    ]);

    const byLabel = Object.fromEntries(
      rollup.byFitResult.map((row) => [row.label, row.count]),
    );
    expect(byLabel["Perfect fit"]).toBe(2);
    expect(byLabel["Nurture"]).toBe(1);
    expect(byLabel["Completed (no score)"]).toBe(1);
    expect(byLabel["Did not finish"]).toBe(1);
  });

  it("reports Close sync health including leads never queued", () => {
    const rollup = buildQualityRollup([
      makeLead({ email: "a@x.com", close_sync_status: "synced" }),
      makeLead({ email: "b@x.com", close_sync_status: "synced" }),
      makeLead({ email: "c@x.com", close_sync_status: "needs_review" }),
      makeLead({ email: "d@x.com", close_sync_status: null }),
    ]);

    const byLabel = Object.fromEntries(
      rollup.syncHealth.map((row) => [row.label, row.count]),
    );
    expect(byLabel).toEqual({
      Synced: 2,
      "Needs review": 1,
      "Not queued": 1,
    });
  });

  it("summarises lead quality by timeline, capital, stage, and region", () => {
    const rollup = buildQualityRollup([
      makeLead({
        email: "a@x.com",
        timeline: "asap",
        budget: "15k_plus",
        business_stage: "researching",
        state_region: "TX",
      }),
      makeLead({ email: "b@x.com", timeline: "asap", budget: "lt_3k" }),
    ]);

    expect(rollup.byTimeline[0]).toEqual({ label: "asap", count: 2 });
    expect(rollup.byBudget).toHaveLength(2);
    expect(rollup.byBusinessStage).toContainEqual({
      label: "(not set)",
      count: 1,
    });
    expect(rollup.byState).toContainEqual({ label: "TX", count: 1 });
  });
});
