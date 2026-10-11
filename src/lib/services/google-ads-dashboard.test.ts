import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  buildRows,
  dedupeLeads,
  totalOf,
  type AdLead,
} from "./google-ads-dashboard";

const lead = (over: Partial<AdLead>): AdLead => ({
  gclid: "g1",
  day: "2026-10-01",
  campaign: "111",
  term: null,
  booked: false,
  won: false,
  wonValue: 0,
  ...over,
});

describe("dedupeLeads", () => {
  it("keeps one lead per gclid, booked or won if any submission was", () => {
    const out = dedupeLeads([
      lead({ gclid: "a" }),
      lead({ gclid: "a", booked: true, won: true, wonValue: 5000 }),
      lead({ gclid: "b" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.gclid === "a")).toMatchObject({
      booked: true,
      won: true,
      wonValue: 5000,
    });
  });
});

describe("buildRows", () => {
  it("joins spend and leads on the key and prices booked calls", () => {
    const rows = buildRows(
      [
        {
          key: "111",
          label: "Brand",
          cost: 100.004,
          clicks: 10,
          impressions: 90,
        },
        {
          key: "111",
          label: "Brand",
          cost: 99.996,
          clicks: 5,
          impressions: 10,
        },
        { key: "222", label: "Generic", cost: 50, clicks: 3, impressions: 40 },
      ],
      [
        lead({ gclid: "a", booked: true }),
        lead({ gclid: "b", booked: true, won: true, wonValue: 6000 }),
        lead({ gclid: "c", campaign: "333" }),
      ],
      (l) => l.campaign ?? "none",
    );
    expect(rows.map((r) => r.key)).toEqual(["111", "222", "333"]);
    expect(rows[0]).toMatchObject({
      spend: 200,
      clicks: 15,
      leads: 2,
      booked: 2,
      won: 1,
      wonValue: 6000,
      costPerBooked: 100,
    });
    expect(rows[1]).toMatchObject({ leads: 0, costPerBooked: null });
    expect(rows[2]).toMatchObject({ label: "333", spend: 0, leads: 1 });
  });

  it("leaves cost per booked call unknown when nothing was spent", () => {
    const [row] = buildRows([], [lead({ booked: true })], () => "111");
    expect(row.costPerBooked).toBeNull();
    expect(totalOf([row]).costPerBooked).toBeNull();
  });

  it("totals every row", () => {
    const rows = buildRows(
      [{ key: "1", label: "A", cost: 30, clicks: 1, impressions: 2 }],
      [
        lead({ campaign: "1", booked: true }),
        lead({ gclid: "x", campaign: "2", booked: true }),
      ],
      (l) => l.campaign ?? "",
    );
    expect(totalOf(rows)).toMatchObject({
      spend: 30,
      leads: 2,
      booked: 2,
      costPerBooked: 15,
    });
  });
});

describe("getGoogleAdsDashboard", () => {
  /** Rows per table; filters are ignored, so rows are chosen to fit the range. */
  function fakeClient(rows: Record<string, Array<Record<string, unknown>>>) {
    return {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const m of [
          "select",
          "gte",
          "lte",
          "gt",
          "eq",
          "in",
          "not",
          "order",
        ])
          chain[m] = () => chain;
        chain.range = async () => ({ data: rows[table] ?? [], error: null });
        return chain;
      },
    };
  }

  it("recovers a pre-utm_term lead's keyword from its click and flags health", async () => {
    const { getGoogleAdsDashboard } = await import("./google-ads-dashboard");
    const client = fakeClient({
      google_ads_campaign_daily: [
        {
          day: "2026-10-08",
          campaign_id: "1",
          campaign_name: "W2",
          cost: 100,
          clicks: 10,
          impressions: 100,
        },
        {
          day: "2026-10-10",
          campaign_id: "1",
          campaign_name: "W2",
          cost: 50,
          clicks: 5,
          impressions: 50,
        },
      ],
      google_ads_keyword_daily: [
        {
          keyword: "vending machine cost",
          cost: 150,
          clicks: 15,
          impressions: 150,
        },
      ],
      lead_submissions: [
        // Before utm_term: keyword comes from the click.
        {
          created_at: "2026-10-08T18:00:00Z",
          utm_campaign: "1",
          utm_term: null,
          call_booked_at: "2026-10-09",
          closed_won_at: null,
          closed_won_value: null,
          gclid: "g-old",
        },
        // No click row either: pre-tracking.
        {
          created_at: "2026-10-08T19:00:00Z",
          utm_campaign: "1",
          utm_term: null,
          call_booked_at: null,
          closed_won_at: null,
          closed_won_value: null,
          gclid: "g-lost",
        },
        {
          created_at: "2026-10-10T18:00:00Z",
          utm_campaign: "1",
          utm_term: "vending machine cost",
          call_booked_at: "2026-10-10",
          closed_won_at: null,
          closed_won_value: null,
          gclid: "g-new",
        },
      ],
      google_ads_clicks: [{ gclid: "g-old", keyword: "Vending Machine Cost" }],
      google_ads_campaign_status: [
        {
          campaign_id: "1",
          campaign_name: "W2",
          status: "ENABLED",
          primary_status: "LIMITED",
          primary_status_reasons: ["BUDGET_CONSTRAINED"],
          daily_budget: 150,
        },
      ],
      google_ads_ad_status: [
        {
          campaign_id: "1",
          ad_group_status: "ENABLED",
          status: "ENABLED",
          approval_status: "DISAPPROVED",
          review_status: "REVIEWED",
        },
      ],
      google_ads_search_term_daily: [
        { search_term: "vending jobs", campaign_id: "1", cost: 40, clicks: 8 },
      ],
      google_ads_search_term_conversions: [],
      google_ads_conversion_daily: [{ conversions: 2 }],
    });
    const ads = await getGoogleAdsDashboard({
      range: "30d",
      now: new Date("2026-10-11T15:00:00Z"),
      client: client as never,
    });
    const cost = ads.keywords.find((k) => k.key === "vending machine cost");
    expect(cost).toMatchObject({ leads: 2, booked: 2, costPerBooked: 75 });
    expect(ads.keywords.find((k) => k.key === "(pre-tracking)")?.leads).toBe(1);
    expect(ads.health[0].flags).toEqual([
      "Not serving: no approved ads",
      "Limited by budget",
    ]);
    expect(ads.wasted).toEqual([{ term: "vending jobs", cost: 40, clicks: 8 }]);
    expect(ads.bookedInAds30d).toBe(2);
    expect(ads.beforeAfter.after).toMatchObject({
      spend: 50,
      booked: 1,
      days: 1,
    });
  });
});

describe("getGoogleAdsDashboard before the health migration", () => {
  it("still loads, and says health is not set up, when the new views are missing", async () => {
    const { getGoogleAdsDashboard } = await import("./google-ads-dashboard");
    const NEW_VIEWS = new Set([
      "google_ads_campaign_status",
      "google_ads_ad_status",
      "google_ads_search_term_conversions",
      "google_ads_conversion_daily",
      "google_ads_clicks",
    ]);
    const client = {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const m of [
          "select",
          "gte",
          "lte",
          "gt",
          "eq",
          "in",
          "not",
          "order",
        ])
          chain[m] = () => chain;
        chain.range = async () =>
          NEW_VIEWS.has(table)
            ? { data: null, error: { code: "PGRST205", message: "not found" } }
            : { data: [], error: null };
        return chain;
      },
    };
    const ads = await getGoogleAdsDashboard({
      range: "30d",
      now: new Date("2026-10-11T15:00:00Z"),
      client: client as never,
    });
    expect(ads.healthSetUp).toBe(false);
    expect(ads.health).toEqual([]);
    expect(ads.bookedInAds30d).toBeNull();
  });
});
