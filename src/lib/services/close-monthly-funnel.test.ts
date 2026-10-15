import { describe, expect, it } from "vitest";
import {
  buildCloseMonthlyFunnel,
  groupOf,
  leadsKey,
  monthsFrom,
} from "./close-monthly-funnel";
import type { CloseCall } from "./close-week-view";
import type { CloseDeal } from "./close-wins";

const call = (over: Partial<CloseCall> = {}): CloseCall => ({
  leadId: "lead_1",
  funnel: "Instagram",
  status: "📞 Follow Up",
  bookedDate: "2026-02-10",
  showUp: "Yes",
  qualified: "Yes",
  ...over,
});

const build = (
  calls: CloseCall[],
  extra: Parameters<typeof buildCloseMonthlyFunnel>[0] extends infer T
    ? Partial<Omit<T & object, "calls" | "today" | "start">>
    : never = {},
  today = "2026-09-22",
) =>
  buildCloseMonthlyFunnel({
    calls,
    today,
    start: "2026-01",
    deals: [],
    ...extra,
  });

const deal = (over: Partial<CloseDeal> = {}): CloseDeal => ({
  leadId: "lead_1",
  dateWon: "2026-02-10",
  value: 12_000,
  funnel: "Instagram",
  closer: null,
  ...over,
});

const monthOf = (funnel: ReturnType<typeof build>, key: string) =>
  funnel.months.find((month) => month.key === key)!;

describe("monthsFrom", () => {
  it("runs from the start through the month holding today, oldest first", () => {
    expect(monthsFrom("2026-01", "2026-03-04")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("rolls the year over", () => {
    expect(monthsFrom("2025-11", "2026-01-15")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
  });
});

describe("groupOf", () => {
  it("splits the sales floor's own lane from marketing", () => {
    expect(groupOf("YouTube")).toBe("marketing");
    expect(groupOf("Lane 2")).toBe("outbound");
    expect(groupOf("Social DMs")).toBe("outbound");
    expect(groupOf("Reactivation Scrapers")).toBe("outbound");
    // A marketing source on Dom's map: a Marketing booking stays marketing.
    expect(groupOf("Sales Reactivation")).toBe("marketing");
    // The plan counts this one as a marketing channel with its own target,
    // so it must not land in the lane the marketing subtotal excludes.
    expect(groupOf("Reactivation Email")).toBe("marketing");
    expect(groupOf("No source")).toBe("review");
    expect(groupOf("Unknown (Needs Review)")).toBe("review");
  });
});

describe("buildCloseMonthlyFunnel", () => {
  it("buckets first calls into the month they were booked in", () => {
    const funnel = build([
      call({ leadId: "a", bookedDate: "2026-01-31" }),
      call({ leadId: "b", bookedDate: "2026-02-01" }),
      call({ leadId: "c", bookedDate: "2026-02-28" }),
    ]);
    expect(monthOf(funnel, "2026-01").totals.booked).toBe(1);
    expect(monthOf(funnel, "2026-02").totals.booked).toBe(2);
  });

  it("counts show and qualified over booked, never over each other", () => {
    // A call logged qualified without a logged show: nesting would put
    // qualified above showed and read as a rate over 100%.
    const funnel = build([
      call({ leadId: "a", showUp: "Yes", qualified: "No" }),
      call({ leadId: "b", showUp: null, qualified: "Yes" }),
    ]);
    expect(monthOf(funnel, "2026-02").totals).toMatchObject({
      booked: 2,
      showed: 1,
      qualified: 1,
    });
  });

  it("counts a win in the month it was won, under Dom's label for its funnel", () => {
    const funnel = build([call({ leadId: "a", bookedDate: "2026-01-10" })], {
      deals: [deal({ leadId: "a", dateWon: "2026-02-10", funnel: "linkedin" })],
    });
    expect(monthOf(funnel, "2026-01").totals).toMatchObject({
      booked: 1,
      won: 0,
    });
    expect(monthOf(funnel, "2026-02").totals).toMatchObject({
      won: 1,
      revenue: 12_000,
    });
    expect(funnel.rows.map((row) => row.label)).toContain("Linkedin");
  });

  it("counts a won deal carrying no value in won, not in revenue", () => {
    const funnel = build([], { deals: [deal({ value: null })] });
    const february = monthOf(funnel, "2026-02");
    expect(february.totals).toMatchObject({ won: 1, revenue: 0 });
    expect(february.unvalued).toBe(1);
  });

  it("applies no lead-status rule on top of Dom's", () => {
    const funnel = build([
      call({ leadId: "a", status: "🔻 Canceled (by Lead)" }),
    ]);
    expect(funnel.grandTotal).toMatchObject({ booked: 1 });
  });

  it("subtotals marketing and what Lane 2 and Social DMs booked, separately and together", () => {
    // `byBooker` files Lane 2 and Social DMs calls under who booked them.
    const funnel = build([
      call({ leadId: "a", funnel: "YouTube" }),
      call({ leadId: "b", funnel: "Sales Reactivation" }),
      call({ leadId: "c", funnel: "Lane 2" }),
      call({ leadId: "d", funnel: "Social DMs" }),
    ]);
    const february = monthOf(funnel, "2026-02");
    expect(february.byGroup.marketing.booked).toBe(2);
    expect(february.byGroup.outbound.booked).toBe(2);
    expect(february.totals.booked).toBe(4);
    expect(funnel.grandByGroup.marketing.booked).toBe(2);
    expect(funnel.grandByGroup.outbound.booked).toBe(2);
  });

  it("shows form fills where a funnel has them and nothing where it does not", () => {
    const funnel = build(
      [
        call({ leadId: "a", funnel: "YouTube" }),
        call({ leadId: "b", funnel: "Reactivation Scrapers" }),
      ],
      {
        leads: new Map([[leadsKey("2026-02", "YouTube"), 40]]),
        leadsFrom: "2026-01-01",
      },
    );
    const youtube = funnel.rows.find((row) => row.label === "YouTube")!;
    const scrapers = funnel.rows.find(
      (row) => row.label === "Reactivation Scrapers",
    )!;
    expect(youtube.byMonth["2026-02"].leads).toBe(40);
    // No form behind the outbound lane, so not observed rather than zero.
    expect(scrapers.byMonth["2026-02"].leads).toBeNull();
    expect(monthOf(funnel, "2026-02").totals.leads).toBe(40);
  });

  // Production, August 2026: 7 Newsletter leads, but the Mike Newsletter funnel
  // booked no call that month, so it had no cell and the leads showed nowhere.
  it("shows a funnel's form fills in a month it booked no call", () => {
    const funnel = build(
      [
        call({ leadId: "a", funnel: "YouTube", bookedDate: "2026-08-10" }),
        call({
          leadId: "b",
          funnel: "Mike Newsletter",
          bookedDate: "2026-07-10",
        }),
      ],
      {
        leads: new Map([
          [leadsKey("2026-08", "YouTube"), 12],
          [leadsKey("2026-08", "Mike Newsletter"), 7],
          [leadsKey("2026-08", "Newsletter"), 3],
        ]),
        leadsFrom: "2026-07-06",
      },
    );
    const mike = funnel.rows.find((row) => row.label === "Mike Newsletter")!;
    expect(mike.byMonth["2026-08"]).toMatchObject({ booked: 0, leads: 7 });
    expect(mike.byMonth["2026-07"].booked).toBe(1);
    // A funnel that has never booked a call still gets its row.
    const newsletter = funnel.rows.find((row) => row.label === "Newsletter")!;
    expect(newsletter.byMonth["2026-08"]).toMatchObject({
      booked: 0,
      leads: 3,
    });
    expect(newsletter.group).toBe("marketing");
    expect(monthOf(funnel, "2026-08").totals).toMatchObject({
      booked: 1,
      leads: 22,
    });
    expect(funnel.grandTotal.leads).toBe(22);
  });

  it("reports no form fills for months before capture started", () => {
    const funnel = build(
      [
        call({ leadId: "a", funnel: "YouTube", bookedDate: "2026-01-10" }),
        call({ leadId: "b", funnel: "YouTube", bookedDate: "2026-08-10" }),
      ],
      {
        leads: new Map([[leadsKey("2026-08", "YouTube"), 12]]),
        leadsFrom: "2026-07-06",
      },
    );
    const youtube = funnel.rows.find((row) => row.label === "YouTube")!;
    expect(youtube.byMonth["2026-01"].leads).toBeNull();
    expect(youtube.byMonth["2026-08"].leads).toBe(12);
  });

  it("marks the running month incomplete", () => {
    const funnel = build([call()]);
    expect(monthOf(funnel, "2026-07").complete).toBe(true);
    expect(monthOf(funnel, "2026-09").complete).toBe(false);
  });

  it("orders rows by total booked across every month shown", () => {
    const funnel = build([
      call({ leadId: "a", funnel: "YouTube", bookedDate: "2026-01-05" }),
      call({ leadId: "b", funnel: "YouTube", bookedDate: "2026-03-05" }),
      call({ leadId: "c", funnel: "Instagram", bookedDate: "2026-02-05" }),
    ]);
    expect(funnel.rows.map((row) => row.label)).toEqual([
      "YouTube",
      "Instagram",
    ]);
    expect(funnel.grandTotal.booked).toBe(3);
  });
});
