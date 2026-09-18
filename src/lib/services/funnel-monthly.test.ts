import { describe, expect, it } from "vitest";
import {
  buildFunnelMonthly,
  canonicalFunnelPath,
  type FunnelLeadRow,
  type FunnelShowRow,
} from "./funnel-monthly";

const NOW = new Date("2026-09-18T12:00:00.000Z");

let idSeed = 0;

function lead(overrides: Partial<FunnelLeadRow> = {}): FunnelLeadRow {
  return {
    id: `lead-${(idSeed += 1)}`,
    email: `${Math.random()}@prospect.com`,
    full_name: "Real Person",
    created_at: "2026-08-10T09:00:00.000Z",
    source_path: "/contact",
    call_booked_at: null,
    closed_won_at: null,
    closed_won_value: null,
    ...overrides,
  };
}

function findRow(
  report: ReturnType<typeof buildFunnelMonthly>,
  month: string,
  funnel: string,
) {
  const period = report.months.find((m) => m.key === month);
  return period?.rows.find((r) => r.funnel === funnel);
}

describe("canonicalFunnelPath", () => {
  it("folds a redirected URL into the page it now renders", () => {
    expect(canonicalFunnelPath("/booking-b5-socials")).toBe(
      "/booking-t5-socials",
    );
    expect(canonicalFunnelPath("/apply-vendingpreneurs")).toBe("/contact");
  });

  it("strips the query string GA4 attaches and a trailing slash", () => {
    expect(canonicalFunnelPath("/contact?source_path=%2Fold")).toBe("/contact");
    expect(canonicalFunnelPath("/contact/")).toBe("/contact");
    expect(canonicalFunnelPath("/")).toBe("/");
  });

  it("rejects anything that is not a path", () => {
    expect(canonicalFunnelPath("(not set)")).toBeNull();
    expect(canonicalFunnelPath("  ")).toBeNull();
    expect(canonicalFunnelPath(null)).toBeNull();
  });
});

describe("buildFunnelMonthly", () => {
  it("counts a win in the month the LEAD was captured, not the month it closed", () => {
    const report = buildFunnelMonthly({
      leads: [
        lead({
          created_at: "2026-08-10T09:00:00.000Z",
          call_booked_at: "2026-08-11T09:00:00.000Z",
          closed_won_at: "2026-09-05",
          closed_won_value: 5997,
        }),
      ],
      visits: [],
      shows: [],
      now: NOW,
    });

    expect(findRow(report, "2026-08", "/contact")?.won).toBe(1);
    expect(findRow(report, "2026-08", "/contact")?.revenue).toBe(5997);
    expect(findRow(report, "2026-09", "/contact")).toBeUndefined();
  });

  it("divides leads by visits only over days GA4 has reported", () => {
    // GA4 stops on the 16th. The 17th's lead must not be divided by a
    // denominator that does not cover it.
    const report = buildFunnelMonthly({
      leads: [
        lead({ created_at: "2026-09-15T09:00:00.000Z" }),
        lead({ created_at: "2026-09-17T09:00:00.000Z" }),
      ],
      visits: [
        { day: "2026-09-15", landing_page: "/contact", sessions: 100 },
        { day: "2026-09-16", landing_page: "/contact", sessions: 100 },
      ],
      shows: [],
      now: NOW,
    });

    const row = findRow(report, "2026-09", "/contact");
    expect(row?.leads).toBe(2);
    expect(report.visitsThrough).toBe("2026-09-16");
    // 1 lead inside the covered days over 200 sessions, not 2 over 200.
    expect(row?.rates.visitToLead).toBeCloseTo(0.5);
  });

  it("clips the cutover month's visits to the day lead capture went live", () => {
    // Production 2026-09-18: July held leads on five real days (the 07-27
    // cutover onward) while GA4 contributed all thirty-one, so opt-in printed
    // 0.97% against a real 5.21%. That made August's 5.09% read as a fourfold
    // improvement when it was in fact a slight fall.
    const report = buildFunnelMonthly({
      leads: [
        lead({ created_at: "2026-07-28T09:00:00.000Z" }),
        lead({ created_at: "2026-07-29T09:00:00.000Z" }),
      ],
      visits: [
        // Before lead capture existed: must not reach the denominator.
        { day: "2026-07-05", landing_page: "/contact", sessions: 900 },
        { day: "2026-07-28", landing_page: "/contact", sessions: 50 },
        { day: "2026-07-29", landing_page: "/contact", sessions: 50 },
      ],
      shows: [],
      now: new Date("2026-08-15T00:00:00.000Z"),
    });

    const july = report.months.find((month) => month.key === "2026-07");
    expect(july?.visitsStart).toBe("2026-07-27");
    expect(july?.totals.visits).toBe(100);
    // 2 / 100, not 2 / 1000.
    expect(july?.totals.rates.visitToLead).toBeCloseTo(2);
  });

  it("leaves every month after the cutover alone", () => {
    const report = buildFunnelMonthly({
      leads: [lead({ created_at: "2026-08-10T09:00:00.000Z" })],
      visits: [
        { day: "2026-08-01", landing_page: "/contact", sessions: 40 },
        { day: "2026-08-10", landing_page: "/contact", sessions: 60 },
      ],
      shows: [],
      now: new Date("2026-09-01T00:00:00.000Z"),
    });

    const august = report.months.find((month) => month.key === "2026-08");
    // No clip: the whole month counts, and the page prints no start caption.
    expect(august?.visitsStart).toBeNull();
    expect(august?.totals.visits).toBe(100);
  });

  it("drops an opt-in rate above 100%: the GA4 join has failed, not the funnel", () => {
    // Production 2026-09-18 showed /newsletter at 236.4%. GA4 credits the
    // session to the page it landed on; we credit the lead to the page the
    // form was on. A visitor who landed elsewhere and submitted here is
    // counted on two different rows, and the page ends up with more leads
    // than sessions.
    const report = buildFunnelMonthly({
      leads: [
        lead({ created_at: "2026-09-15T09:00:00.000Z" }),
        lead({ created_at: "2026-09-15T10:00:00.000Z" }),
        lead({ created_at: "2026-09-15T11:00:00.000Z" }),
      ],
      visits: [
        { day: "2026-09-15", landing_page: "/contact", sessions: 1 },
        { day: "2026-09-16", landing_page: "/contact", sessions: 1 },
      ],
      shows: [],
      now: NOW,
    });

    const row = findRow(report, "2026-09", "/contact");
    expect(row?.leads).toBe(3);
    expect(row?.visits).toBe(2);
    // 150% cannot be true, so it is a dash rather than a confident wrong number.
    expect(row?.rates.visitToLead).toBeNull();
  });

  it("keeps an opt-in rate at exactly 100%", () => {
    const report = buildFunnelMonthly({
      leads: [lead({ created_at: "2026-09-15T09:00:00.000Z" })],
      visits: [{ day: "2026-09-15", landing_page: "/contact", sessions: 1 }],
      shows: [],
      now: NOW,
    });

    expect(findRow(report, "2026-09", "/contact")?.rates.visitToLead).toBe(100);
  });

  it("never turns an empty denominator into a zero rate", () => {
    const report = buildFunnelMonthly({
      leads: [lead()],
      visits: [],
      shows: [],
      now: NOW,
    });

    const row = findRow(report, "2026-08", "/contact");
    expect(row?.visits).toBeNull();
    expect(row?.rates.visitToLead).toBeNull();
    expect(row?.rates.bookToShow).toBeNull();
    expect(row?.rates.showToWin).toBeNull();
    expect(row?.rates.leadToBook).toBe(0);
  });

  it("holds a call that has not happened yet out of the show rate", () => {
    const shows: FunnelShowRow[] = [
      {
        email: "held@prospect.com",
        first_sales_call_booked_date: "2026-08-12",
        first_call_show_up: "Yes",
      },
      {
        email: "ghost@prospect.com",
        first_sales_call_booked_date: "2026-08-13",
        first_call_show_up: "No",
      },
      {
        email: "future@prospect.com",
        first_sales_call_booked_date: "2026-09-24",
        first_call_show_up: null,
      },
      {
        email: "unlogged@prospect.com",
        first_sales_call_booked_date: "2026-08-14",
        first_call_show_up: null,
      },
    ];
    const booked = (email: string) =>
      lead({ email, call_booked_at: "2026-08-11T09:00:00.000Z" });

    const report = buildFunnelMonthly({
      leads: [
        booked("held@prospect.com"),
        booked("ghost@prospect.com"),
        booked("future@prospect.com"),
        booked("unlogged@prospect.com"),
      ],
      visits: [],
      shows,
      now: NOW,
    });

    const row = findRow(report, "2026-08", "/contact");
    expect(row?.booked).toBe(4);
    expect(row?.held).toBe(1);
    expect(row?.noShow).toBe(1);
    expect(row?.pendingShow).toBe(1);
    expect(row?.showUnlogged).toBe(1);
    // Two answers, not four: the unlogged and the future call leave the
    // denominator rather than counting as no-shows.
    expect(row?.rates.bookToShow).toBe(50);
    expect(report.showCoverage).toEqual({
      known: 2,
      total: 3,
      pct: (2 / 3) * 100,
    });
  });

  it("aligns the before window to the same weekdays as the after window", () => {
    const report = buildFunnelMonthly({
      leads: [lead()],
      visits: [],
      shows: [],
      now: NOW,
      changedOn: "2026-09-17",
    });

    // 17th and 18th are Thu/Fri; the comparison must be the previous Thu/Fri.
    expect(report.beforeAfter?.after.start).toBe("2026-09-17");
    expect(report.beforeAfter?.after.end).toBe("2026-09-18");
    expect(report.beforeAfter?.before.start).toBe("2026-09-10");
    expect(report.beforeAfter?.before.end).toBe("2026-09-11");
  });

  it("excludes internal leads unless asked for them", () => {
    const rows = [
      lead({ email: "adam@modern-amenities.com" }),
      lead({ email: "buyer@prospect.com" }),
    ];

    expect(
      findRow(
        buildFunnelMonthly({ leads: rows, visits: [], shows: [], now: NOW }),
        "2026-08",
        "/contact",
      )?.leads,
    ).toBe(1);
    expect(
      findRow(
        buildFunnelMonthly({
          leads: rows,
          visits: [],
          shows: [],
          now: NOW,
          includeInternal: true,
        }),
        "2026-08",
        "/contact",
      )?.leads,
    ).toBe(2);
  });

  it("keeps a redirected page's history on one row", () => {
    const report = buildFunnelMonthly({
      leads: [
        lead({
          created_at: "2026-08-02T09:00:00.000Z",
          source_path: "/booking-b5-socials",
        }),
        lead({
          created_at: "2026-08-03T09:00:00.000Z",
          source_path: "/booking-t5-socials",
        }),
      ],
      visits: [],
      shows: [],
      now: NOW,
    });

    expect(findRow(report, "2026-08", "/booking-t5-socials")?.leads).toBe(2);
    expect(findRow(report, "2026-08", "/booking-b5-socials")).toBeUndefined();
  });

  it("counts a half-filled form as offered but not finished", () => {
    const finished = lead({ email: "finished@prospect.com" });
    const halfway = lead({ email: "halfway@prospect.com" });
    const neverAsked = lead({ email: "straight-to-calendar@prospect.com" });

    const report = buildFunnelMonthly({
      leads: [finished, halfway, neverAsked],
      visits: [],
      shows: [],
      sessions: [
        {
          lead_submission_id: finished.id,
          completed_at: "2026-08-10T09:05:00.000Z",
          answer_count: 7,
        },
        { lead_submission_id: halfway.id, completed_at: null, answer_count: 2 },
      ],
      now: NOW,
    });

    const row = findRow(report, "2026-08", "/contact");
    expect(row?.leads).toBe(3);
    // The page that never asks a question is not an abandonment.
    expect(row?.questionsOffered).toBe(2);
    expect(row?.questionsFinished).toBe(1);
    expect(row?.questionsAbandoned).toBe(1);
    expect(row?.rates.questionsCompleted).toBe(50);
  });

  it("counts a double submit as one person, not one abandon and one finish", () => {
    const person = lead({ email: "double@prospect.com" });

    const report = buildFunnelMonthly({
      leads: [person],
      visits: [],
      shows: [],
      sessions: [
        { lead_submission_id: person.id, completed_at: null, answer_count: 2 },
        {
          lead_submission_id: person.id,
          completed_at: "2026-08-10T09:06:00.000Z",
          answer_count: 7,
        },
      ],
      now: NOW,
    });

    const row = findRow(report, "2026-08", "/contact");
    expect(row?.questionsOffered).toBe(1);
    expect(row?.questionsFinished).toBe(1);
    expect(row?.questionsAbandoned).toBe(0);
  });

  it("flags which rows are registered booking funnels", () => {
    const report = buildFunnelMonthly({
      leads: [lead(), lead({ source_path: "/news" })],
      visits: [],
      shows: [],
      now: NOW,
    });

    expect(findRow(report, "2026-08", "/contact")?.isBookingFunnel).toBe(true);
    expect(findRow(report, "2026-08", "/news")?.isBookingFunnel).toBe(false);
  });
});
