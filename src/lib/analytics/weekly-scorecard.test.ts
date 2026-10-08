import { describe, expect, it } from "vitest";
import type { ChannelFact } from "@/lib/services/channel-report-rollup";
import type { CloseCall } from "@/lib/services/close-week-view";
import { buildScorecard, mondayOf, scorecardWeeks } from "./weekly-scorecard";

const call = (
  leadId: string,
  bookedDate: string,
  extra: Partial<CloseCall> = {},
): CloseCall => ({
  leadId,
  bookedDate,
  funnel: "Website",
  status: "Booked",
  showUp: null,
  qualified: null,
  ...extra,
});

const fact = (
  day: string,
  source: string,
  extra: Partial<ChannelFact> = {},
): ChannelFact =>
  ({
    day,
    source,
    channel: "x",
    medium: "",
    campaign: "",
    content: "",
    destination: "",
    spend: null,
    leads: null,
    contacts: null,
    ...extra,
  }) as ChannelFact;

describe("weeks", () => {
  it("runs Monday to Sunday, newest first, holding today", () => {
    expect(mondayOf("2026-10-08")).toBe("2026-10-05"); // Thursday
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // Sunday
    expect(scorecardWeeks("2026-10-08", 2)).toEqual([
      { start: "2026-10-05", end: "2026-10-11" },
      { start: "2026-09-28", end: "2026-10-04" },
    ]);
  });
});

describe("buildScorecard", () => {
  const today = "2026-10-08";

  it("counts every first call as the total, and the §3 rule and Lane 2 beneath it", () => {
    const [, w1] = buildScorecard({
      today,
      count: 2,
      calls: [
        call("a", "2026-09-28"),
        call("b", "2026-10-04"),
        call("c", "2026-09-30", { status: "🔻 Canceled (by Lead)" }),
        call("d", "2026-10-01", { funnel: "Reactivation Scrapers" }),
        call("e", "2026-10-05"), // next week
      ],
      facts: [],
      qualifiedDays: [],
    });
    expect(w1).toMatchObject({
      start: "2026-09-28",
      complete: true,
      booked: 4,
      bookedKept: 3,
      bookedMarketing: 2,
    });
  });

  it("prices MQLs as captured leads plus contacts, with spend by network", () => {
    const days = ["28", "29", "30"]
      .map((d) => `2026-09-${d}`)
      .concat(["01", "02", "03", "04"].map((d) => `2026-10-${d}`));
    const [, w1] = buildScorecard({
      today,
      count: 2,
      calls: [],
      facts: [
        ...days.map((d) => fact(d, "meta_ads", { spend: 100 })),
        ...days.map((d) => fact(d, "google", { spend: 50 })),
        fact("2026-09-29", "website", { leads: 40 }),
        fact("2026-09-29", "ghl_webinar", { contacts: 660 }),
      ],
      qualifiedDays: ["2026-09-28", "2026-10-04", "2026-10-05"],
    });
    expect(w1).toMatchObject({
      mqls: 700,
      qualified: 2,
      spend: 1050,
      missingSpend: [],
      costPerMql: 1.5,
    });
    expect(w1!.spendByNetwork).toEqual([
      { label: "Google Ads", spend: 350 },
      { label: "Meta", spend: 700 },
    ]);
  });

  it("flags a running network with settled days that recorded no spend", () => {
    // Production 2026-10-01: Google Ads disconnected in Metricool; GA4 still
    // wrote google rows (visits, spend null) every day after.
    const facts = [
      fact("2026-09-29", "google", { spend: 499.79 }),
      fact("2026-09-30", "google", { spend: 147.76 }),
      ...["01", "02", "03", "04", "05", "06", "07"].map((d) =>
        fact(`2026-10-${d}`, "google", { spend: null }),
      ),
    ];
    const [current, w1] = buildScorecard({
      today,
      count: 2,
      calls: [],
      facts,
      qualifiedDays: [],
    });
    // 9/28 had no google row at all, plus 10/1-10/4.
    expect(w1!.missingSpend).toEqual([{ label: "Google Ads", days: 5 }]);
    // Running week: Mon-Wed are settled; today (Thu) is not yet missing.
    expect(current!.missingSpend).toEqual([{ label: "Google Ads", days: 3 }]);
    expect(current!.complete).toBe(false);
  });

  it("flags only networks that recorded spend somewhere on screen", () => {
    const [w] = buildScorecard({
      today,
      count: 1,
      calls: [],
      facts: [fact("2026-10-06", "meta_ads", { spend: 10 })],
      qualifiedDays: [],
    });
    expect(w!.missingSpend).toEqual([
      { label: "Meta", days: 2 }, // 10/5 and 10/7 have no Meta row
    ]);
    expect(w!.costPerMql).toBeNull();
  });
});
