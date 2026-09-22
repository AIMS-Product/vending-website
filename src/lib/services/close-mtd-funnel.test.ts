import { describe, expect, it } from "vitest";
import { buildCloseMtdFunnel } from "./close-mtd-funnel";
import type { CloseCall } from "./close-week-view";
import type { CloseDeal } from "./close-wins";

const call = (over: Partial<CloseCall> = {}): CloseCall => ({
  leadId: "lead_1",
  funnel: "Instagram",
  status: "Active",
  bookedDate: "2026-09-10",
  showUp: "Yes",
  qualified: "Yes",
  ...over,
});

const deal = (over: Partial<CloseDeal> = {}): CloseDeal => ({
  leadId: "lead_1",
  dateWon: "2026-09-12",
  value: 5000,
  funnel: "Instagram",
  closer: "A Closer",
  ...over,
});

const build = (calls: CloseCall[], deals: CloseDeal[] = []) =>
  buildCloseMtdFunnel({
    calls,
    deals,
    from: "2026-09-01",
    to: "2026-09-21",
  });

describe("buildCloseMtdFunnel", () => {
  it("counts each stage over the booked cohort, never over the one above it", () => {
    // The real shape: a rep marked this one qualified without logging a show.
    const funnel = build([
      call(),
      call({ showUp: "No", qualified: "Yes" }),
      call({ showUp: "Yes", qualified: "No" }),
      call({ showUp: null, qualified: null }),
    ]);
    const stage = (key: string) =>
      funnel.stages.find((entry) => entry.key === key)!;

    expect(stage("booked").count).toBe(4);
    expect(stage("showed").count).toBe(2);
    expect(stage("qualified").count).toBe(2);
    // 2 of 4 booked, not 2 of 2 showed — the nesting that does not exist.
    expect(stage("qualified").ofBookedPct).toBe(50);
    expect(funnel.qualifiedWithoutShow).toBe(1);
  });

  it("leaves an unlogged call out of showed without dropping it from booked", () => {
    const funnel = build([call({ showUp: null }), call({ showUp: "Yes" })]);
    expect(funnel.stages[0]!.count).toBe(2);
    expect(funnel.stages[1]!.count).toBe(1);
  });

  it("drops the calls SteelTrap drops and says how many", () => {
    const funnel = build([
      call(),
      call({ status: "🔻 Canceled (by Lead)" }),
      call({ status: "Outside the US" }),
      call({ funnel: "LTF - Quiz Funnel" }),
    ]);
    expect(funnel.stages[0]!.count).toBe(1);
    expect(funnel.excluded).toBe(3);
  });

  it("splits the marketing line off Reactivation Scrapers", () => {
    const funnel = build([
      call({ funnel: "Reactivation Scrapers" }),
      call({ funnel: "Reactivation Scrapers", showUp: "No", qualified: "No" }),
      call({ funnel: "Instagram" }),
      call({ funnel: "Internal Webinar", qualified: "No" }),
    ]);
    expect(funnel.scrapers).toEqual({ booked: 2, showed: 1, qualified: 1 });
    expect(funnel.marketing).toEqual({ booked: 2, showed: 2, qualified: 1 });
  });

  it("keeps won on its own population, by the day the deal was won", () => {
    const funnel = build(
      // No call booked this month at all.
      [],
      [
        deal({ dateWon: "2026-09-12", value: 5000 }),
        deal({ leadId: "lead_2", dateWon: "2026-09-20", value: null }),
        // Won last month: outside the window.
        deal({ leadId: "lead_3", dateWon: "2026-08-30", value: 9000 }),
      ],
    );
    expect(funnel.won).toBe(2);
    expect(funnel.revenue).toBe(5000);
    expect(funnel.unvalued).toBe(1);
    // Won is never expressed as a share of a cohort it does not belong to.
    expect(funnel.stages.find((s) => s.key === "won")!.ofBookedPct).toBeNull();
  });

  it("ignores calls booked outside the month", () => {
    const funnel = build([
      call({ bookedDate: "2026-08-31" }),
      call({ bookedDate: "2026-09-01" }),
      call({ bookedDate: "2026-09-22" }),
    ]);
    expect(funnel.stages[0]!.count).toBe(1);
  });

  it("gives every stage a population and a source", () => {
    for (const stage of build([call()]).stages) {
      expect(stage.population.length).toBeGreaterThan(0);
      expect(stage.source.length).toBeGreaterThan(0);
    }
  });

  it("labels a funnel-less lead rather than dropping it", () => {
    const funnel = build([call({ funnel: null }), call({ funnel: "  " })]);
    expect(funnel.rows).toEqual([
      { label: "No source", booked: 2, showed: 2, qualified: 2 },
    ]);
  });
});
