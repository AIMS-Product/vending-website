import { describe, expect, it } from "vitest";
import {
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
        },
        {
          leadId: "b",
          dateWon: "2026-08-31",
          value: 5697,
          funnel: "Internal Webinar",
        },
        { leadId: "c", dateWon: "2026-08-02", value: null, funnel: "YouTube" },
        {
          leadId: "d",
          dateWon: "2026-09-04",
          value: 14997,
          funnel: "Internal Webinar",
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
      [{ leadId: "a", dateWon: "2026-07-01", value: 100, funnel: null }],
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
            data: [{ lead_id: "in-mirror", funnel: "YouTube" }],
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
      },
      {
        leadId: "not-in-mirror",
        dateWon: "2026-08-20",
        value: 5000,
        funnel: "Internal Webinar",
      },
    ]);
  });
});
