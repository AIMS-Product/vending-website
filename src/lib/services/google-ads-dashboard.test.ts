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
