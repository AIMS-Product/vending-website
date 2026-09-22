import { describe, expect, it } from "vitest";
import {
  byCloser,
  closeChannelLabel,
  fetchCloseDeals,
  summariseCloseWins,
} from "@/lib/services/close-wins";

describe("closeChannelLabel", () => {
  it("rolls Close funnels into the goal channels", () => {
    expect(closeChannelLabel("Internal Webinar")).toBe("Webinar");
    expect(closeChannelLabel("Reactivation Scrapers")).toBe("Lane 2");
    expect(closeChannelLabel("Meta Ads")).toBe("Other funnels");
    expect(closeChannelLabel(null)).toBe("No funnel in Close");
  });
});

describe("summariseCloseWins", () => {
  it("counts every deal by the month it was won, per channel", () => {
    const periods = summariseCloseWins(
      [
        {
          leadId: "a",
          dateWon: "2026-08-12",
          value: 8997,
          funnel: "Internal Webinar",
          closer: null,
        },
        {
          leadId: "b",
          dateWon: "2026-08-31",
          value: 5697,
          funnel: "Internal Webinar",
          closer: null,
        },
        {
          leadId: "c",
          dateWon: "2026-08-02",
          value: null,
          funnel: "YouTube",
          closer: null,
        },
        {
          leadId: "d",
          dateWon: "2026-09-04",
          value: 14997,
          funnel: "Internal Webinar",
          closer: null,
        },
      ],
      (day) => day.slice(0, 7),
    );
    expect(periods.map((period) => period.key)).toEqual(["2026-09", "2026-08"]);
    const august = periods[1];
    expect(august).toMatchObject({ won: 3, revenue: 14694, unvalued: 1 });
    expect(august.rows).toEqual([
      { label: "Webinar", won: 2, revenue: 14694 },
      { label: "YouTube", won: 1, revenue: 0 },
    ]);
  });

  it("leaves out deals the period function rejects", () => {
    const periods = summariseCloseWins(
      [
        {
          leadId: "a",
          dateWon: "2026-07-01",
          value: 100,
          funnel: null,
          closer: null,
        },
      ],
      () => null,
    );
    expect(periods).toEqual([]);
  });
});

describe("fetchCloseDeals", () => {
  it("pages Close, takes the funnel from the mirror, and asks Close for leads the mirror lacks", async () => {
    const pages = [
      {
        data: [
          {
            id: "o1",
            lead_id: "in-mirror",
            date_won: "2026-08-12",
            value: 899700,
          },
        ],
        has_more: true,
      },
      {
        data: [
          {
            id: "o2",
            lead_id: "not-in-mirror",
            date_won: "2026-08-20",
            value: 500000,
          },
          { id: "o3", lead_id: "undated", date_won: null, value: 100 },
        ],
        has_more: false,
      },
    ];
    const skips: number[] = [];
    const close = {
      listWonOpportunities: async ({ skip }: { skip: number }) => {
        skips.push(skip);
        return pages[skip / 100];
      },
      getLead: async (id: string) => ({
        id,
        custom: { "Funnel Name DEAL (Opp)": "Internal Webinar" },
      }),
    };
    const mirror = {
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [{ lead_id: "in-mirror", funnel: "YouTube", closer: null }],
            error: null,
          }),
        }),
      }),
    };

    const deals = await fetchCloseDeals({
      from: "2026-08-01",
      to: "2026-08-31",
      close: close as never,
      mirror: mirror as never,
    });

    expect(skips).toEqual([0, 100]);
    expect(deals).toEqual([
      {
        leadId: "in-mirror",
        dateWon: "2026-08-12",
        value: 8997,
        funnel: "YouTube",
        closer: null,
      },
      {
        leadId: "not-in-mirror",
        dateWon: "2026-08-20",
        value: 5000,
        funnel: "Internal Webinar",
        closer: null,
      },
    ]);
  });
});

describe("fetchCloseDeals lead reads", () => {
  it("never has more than four Close lead reads in flight", async () => {
    const opportunities = Array.from({ length: 20 }, (_, i) => ({
      id: `o${i}`,
      lead_id: `lead-${i}`,
      date_won: "2026-08-12",
      value: 100,
    }));
    let inFlight = 0;
    let peak = 0;
    const close = {
      listWonOpportunities: async () => ({
        data: opportunities,
        has_more: false,
      }),
      getLead: async (id: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { id, custom: {} };
      },
    };
    const mirror = {
      from: () => ({
        select: () => ({ in: async () => ({ data: [], error: null }) }),
      }),
    };

    const deals = await fetchCloseDeals({
      from: "2026-08-01",
      to: "2026-08-31",
      close: close as never,
      mirror: mirror as never,
    });

    expect(deals).toHaveLength(20);
    expect(peak).toBe(4);
  });
});

describe("summariseCloseWins by closer", () => {
  it("groups the same deals and the same totals by who won them", () => {
    const deals = [
      {
        leadId: "a",
        dateWon: "2026-09-20",
        value: 5997,
        funnel: "Reactivation Scrapers",
        closer: "Shreya Bechra",
      },
      {
        leadId: "b",
        dateWon: "2026-09-20",
        value: 8997,
        funnel: "Internal Webinar",
        closer: "Shreya Bechra",
      },
      {
        leadId: "c",
        dateWon: "2026-09-21",
        value: 1000,
        funnel: "YouTube",
        closer: "Joe Dysert",
      },
      {
        leadId: "d",
        dateWon: "2026-09-21",
        value: null,
        funnel: "YouTube",
        closer: null,
      },
    ];
    const month = (day: string) => day.slice(0, 7);
    const byChannelPeriods = summariseCloseWins(deals, month);
    const byCloserPeriods = summariseCloseWins(deals, month, byCloser);

    // Same arithmetic, so the two groupings cannot disagree on the total.
    expect(byCloserPeriods[0].won).toBe(byChannelPeriods[0].won);
    expect(byCloserPeriods[0].revenue).toBe(byChannelPeriods[0].revenue);
    expect(byCloserPeriods[0].unvalued).toBe(byChannelPeriods[0].unvalued);

    expect(byCloserPeriods[0].rows).toEqual([
      { label: "Shreya Bechra", won: 2, revenue: 14994 },
      { label: "Joe Dysert", won: 1, revenue: 1000 },
      { label: "No closer in Close", won: 1, revenue: 0 },
    ]);
  });
});
