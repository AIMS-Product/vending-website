import { describe, expect, it } from "vitest";
import {
  buildCloseMonthlyFunnel,
  groupOf,
  isWonCall,
  leadsKey,
  monthsFrom,
} from "./close-monthly-funnel";
import type { CloseCall } from "./close-week-view";

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
) => buildCloseMonthlyFunnel({ calls, today, start: "2026-01", ...extra });

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
    expect(groupOf("Reactivation Scrapers")).toBe("outbound");
    expect(groupOf("Sales Reactivation")).toBe("outbound");
    // The plan counts this one as a marketing channel with its own target,
    // so it must not land in the lane the marketing subtotal excludes.
    expect(groupOf("Reactivation Email")).toBe("marketing");
    expect(groupOf("No source")).toBe("review");
    expect(groupOf("Unknown (Needs Review)")).toBe("review");
  });
});

describe("isWonCall", () => {
  it("reads the Close stage, emoji and spacing included", () => {
    expect(isWonCall(call({ status: "🏆 Closed / Won" }))).toBe(true);
    expect(isWonCall(call({ status: "Closed/Won" }))).toBe(true);
    expect(isWonCall(call({ status: "💔 Lost" }))).toBe(false);
    expect(isWonCall(call({ status: null }))).toBe(false);
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

  it("counts a win in the month the call was booked, with its deal value", () => {
    const funnel = build(
      [
        call({
          leadId: "a",
          bookedDate: "2026-02-10",
          status: "🏆 Closed / Won",
        }),
      ],
      { dealValueByLead: new Map([["a", 12_000]]) },
    );
    expect(monthOf(funnel, "2026-02").totals).toMatchObject({
      won: 1,
      revenue: 12_000,
    });
    expect(monthOf(funnel, "2026-04").totals).toMatchObject({
      won: 0,
      revenue: 0,
    });
  });

  it("counts a won lead carrying no deal value in won, not in revenue", () => {
    const funnel = build([call({ leadId: "a", status: "🏆 Closed / Won" })]);
    const february = monthOf(funnel, "2026-02");
    expect(february.totals).toMatchObject({ won: 1, revenue: 0 });
    expect(february.unvalued).toBe(1);
  });

  it("never counts a win for a lead the booked column excluded", () => {
    const funnel = build(
      [call({ leadId: "a", status: "🔻 Canceled (by Lead)" })],
      { dealValueByLead: new Map([["a", 9_000]]) },
    );
    expect(funnel.grandTotal).toMatchObject({ booked: 0, won: 0, revenue: 0 });
    expect(monthOf(funnel, "2026-02").excluded).toBe(1);
  });

  it("subtotals marketing and sales reactivation separately and together", () => {
    const funnel = build([
      call({ leadId: "a", funnel: "YouTube" }),
      call({ leadId: "b", funnel: "Instagram" }),
      call({ leadId: "c", funnel: "Reactivation Scrapers" }),
      call({ leadId: "d", funnel: "Sales Reactivation" }),
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

  it("marks a month still too young for its closed-won column to be read", () => {
    // Maturity runs from the month's LAST day, so August is still filling in
    // on 22 September: its final calls are 22 days old, not 45.
    const funnel = build([call()]);
    expect(monthOf(funnel, "2026-07").mature).toBe(true);
    expect(monthOf(funnel, "2026-08").mature).toBe(false);
    expect(monthOf(funnel, "2026-09").mature).toBe(false);
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
