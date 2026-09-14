import { describe, expect, it } from "vitest";
import {
  buildCohort,
  CLOSE_MATURITY_DAYS,
  SHOW_GRACE_DAYS,
  type CohortRow,
} from "./funnel-cohort";

const NOW = new Date("2026-09-14T12:00:00Z");
const WINDOW = { start: "2026-06-01", end: "2026-09-14" };

function row(over: Partial<CohortRow> = {}): CohortRow {
  return {
    funnel: "YouTube",
    first_sales_call_booked_date: "2026-06-10",
    first_call_show_up: "Yes",
    status_label: null,
    ...over,
  };
}

describe("buildCohort", () => {
  it("anchors on the booked date and joins a later win back to it", () => {
    // Booked in June, won whenever -- the win belongs to June's cohort. This
    // is the whole point: the calendar-aligned rate would have put it in the
    // month the status changed.
    const cohort = buildCohort(
      [row({ status_label: "🏆 Closed / Won" }), row()],
      WINDOW,
      NOW,
    );
    expect(cohort.booked).toBe(2);
    expect(cohort.held).toBe(2);
    expect(cohort.won).toBe(1);
    expect(cohort.rates.closePct).toBe(50);
  });

  it("reproduces the spec's worked example", () => {
    const rows = [
      ...Array.from({ length: 12 }, () =>
        row({ status_label: "Closed / Won" }),
      ),
      ...Array.from({ length: 48 }, () => row()),
      ...Array.from({ length: 40 }, () => row({ first_call_show_up: "No" })),
    ];
    const cohort = buildCohort(rows, WINDOW, NOW);
    expect(cohort.booked).toBe(100);
    expect(cohort.rates.showPct).toBe(60);
    expect(cohort.rates.closePct).toBe(20);
  });

  it("holds an immature booking out of the show-rate denominator", () => {
    const tooNew = "2026-09-14";
    const cohort = buildCohort(
      [row(), row({ first_sales_call_booked_date: tooNew })],
      WINDOW,
      NOW,
    );
    expect(cohort.booked).toBe(2);
    expect(cohort.pendingShow).toBe(1);
    expect(cohort.showable).toBe(1);
    expect(cohort.status).toBe("partial");
  });

  it("does not count a call nobody logged as a no-show", () => {
    const cohort = buildCohort(
      [row(), row({ first_call_show_up: null })],
      WINDOW,
      NOW,
    );
    expect(cohort.noShow).toBe(0);
    expect(cohort.showUnlogged).toBe(1);
    expect(cohort.showable).toBe(1);
    expect(cohort.rates.showPct).toBe(100);
    // ...and the coverage figure is what admits half the cohort was dropped.
    expect(cohort.coverage.showUp).toEqual({ known: 1, total: 2, pct: 50 });
  });

  it("renders an empty denominator as unavailable, never zero", () => {
    const cohort = buildCohort([], WINDOW, NOW);
    expect(cohort.rates.showPct).toBeNull();
    expect(cohort.rates.closePct).toBeNull();
    expect(cohort.status).toBe("immature");
  });

  it("never reports revenue it does not have", () => {
    const cohort = buildCohort([row({ status_label: "Won" })], WINDOW, NOW);
    expect(cohort.revenue).toBeNull();
  });

  it('does not read "Lost - Won\'t Sign" as a win', () => {
    const cohort = buildCohort(
      [row({ status_label: "Lost - Won't Sign" })],
      WINDOW,
      NOW,
    );
    expect(cohort.won).toBe(0);
  });

  it("keeps a held call out of the close rate until it is old enough", () => {
    const justHeld = "2026-09-12";
    const cohort = buildCohort(
      [row({ first_sales_call_booked_date: justHeld })],
      WINDOW,
      NOW,
    );
    expect(cohort.held).toBe(1);
    expect(cohort.closeable).toBe(0);
    expect(cohort.rates.closePct).toBeNull();
  });

  it("still counts a win the cohort is too young to rate", () => {
    // Every booking inside the close window at once: the rate has to wait,
    // but the wins are observed facts and printing 0 of them would be a lie.
    const cohort = buildCohort(
      [
        row({
          first_sales_call_booked_date: "2026-09-12",
          status_label: "Closed / Won",
        }),
        row({ first_sales_call_booked_date: "2026-09-12" }),
      ],
      WINDOW,
      NOW,
    );
    expect(cohort.closeable).toBe(0);
    expect(cohort.rates.closePct).toBeNull();
    expect(cohort.won).toBe(1);
    expect(cohort.wonOfCloseable).toBe(0);
  });

  it("scopes to one funnel without touching the others", () => {
    const cohort = buildCohort(
      [row(), row({ funnel: "Website" }), row({ funnel: null })],
      WINDOW,
      NOW,
      "YouTube",
    );
    expect(cohort.booked).toBe(1);
    expect(cohort.funnel).toBe("YouTube");
  });

  it("excludes a booking outside the window", () => {
    const cohort = buildCohort(
      [row({ first_sales_call_booked_date: "2026-05-31" }), row()],
      WINDOW,
      NOW,
    );
    expect(cohort.booked).toBe(1);
  });

  it("states its maturity intervals rather than hiding them", () => {
    expect(SHOW_GRACE_DAYS).toBeGreaterThan(0);
    expect(CLOSE_MATURITY_DAYS).toBeGreaterThan(SHOW_GRACE_DAYS);
  });
});
