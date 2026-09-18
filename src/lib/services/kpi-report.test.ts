import { describe, expect, it } from "vitest";
import type { ChannelFact } from "./channel-report-rollup";
import { buildKpiReport, kpiReportToCsv, type KpiInput } from "./kpi-report";

function fact(over: Partial<ChannelFact>): ChannelFact {
  return {
    day: "2026-09-01",
    channel: "YouTube",
    source: "youtube",
    medium: "video",
    campaign: "home",
    content: "(not set)",
    destination: "book-call",
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    visits: null,
    thankyou_visits: null,
    leads: null,
    booked: null,
    showed: null,
    won: null,
    revenue: null,
    ...over,
  };
}

const lastRun = {
  "ga4-visits": "2026-09-11T10:00:00.000Z",
  leads: "2026-09-11T09:00:00.000Z",
  "webinar-ingest": "2026-09-11T08:00:00.000Z",
  "ghl-email": "2026-09-11T07:00:00.000Z",
  "manychat-ingest": null,
};

const input: KpiInput = {
  facts: [
    fact({
      visits: 1000,
      thankyou_visits: 120,
      leads: 200,
      booked: 80,
      showed: 40,
      won: 4,
    }),
    fact({ day: "2026-09-02", visits: 500, leads: null, booked: null }),
    fact({
      channel: "Instagram",
      source: "mike-ig",
      destination: "lead-magnet",
      visits: 300,
      leads: 30,
      booked: 6,
      showed: 3,
      won: 0,
    }),
    fact({
      channel: "Website",
      source: "(not set)",
      destination: "unknown",
      visits: 900,
    }),
    fact({
      channel: "Webinar",
      source: "meta_ads",
      destination: "webinar-register",
      leads: 500,
      spend: 2000,
    }),
    fact({
      channel: "Email",
      source: "ghl_email",
      destination: "book-call",
      leads: 5,
      booked: 2,
      showed: 1,
      won: 0,
    }),
    fact({
      channel: "Instagram DM",
      source: "manychat",
      destination: "book-call",
      // ManyChat conversations are contacts, not site leads (fetchFacts).
      contacts: 40,
      clicks: 20,
      booked: 10,
      showed: 6,
      won: 2,
    }),
  ],
  webinars: [
    {
      date: "2026-09-08",
      label: "Sept 8",
      format: "live",
      registrations: 1000,
      attendees: 300,
      booked_night_of: 30,
      booked_ever: 40,
      booked_calls: 32,
      showed: 20,
      show_no_booking: 3,
      won: 5,
      revenue: 50000,
      spend: 6000,
      booking_maturing: false,
      revenue_maturing: false,
    },
    {
      date: "2026-09-01",
      label: "Sept 1",
      format: "live",
      registrations: 800,
      attendees: null,
      booked_night_of: 20,
      booked_ever: 25,
      booked_calls: 16,
      showed: 10,
      show_no_booking: 0,
      won: 2,
      revenue: null,
      spend: 4000,
      booking_maturing: false,
      revenue_maturing: false,
    },
  ],
  emailSnapshots: [
    {
      snapshot_day: "2026-09-01",
      workflow_id: "w1",
      workflow_name: "Reactivation",
      sent: 1000,
      delivered: 950,
      opened: 400,
      clicked: 50,
      replied: 10,
    },
    {
      snapshot_day: "2026-09-10",
      workflow_id: "w1",
      workflow_name: "Reactivation",
      sent: 1500,
      delivered: 1425,
      opened: 600,
      clicked: 80,
      replied: 25,
    },
    {
      snapshot_day: "2026-09-10",
      workflow_id: "w2",
      workflow_name: "Single snapshot",
      sent: 99,
      delivered: 99,
      opened: 1,
      clicked: 0,
      replied: 0,
    },
  ],
  setterBookings: [
    {
      booked_by_setter: "Pearl",
      call_outcome: "showed",
      closed_won_at: "2026-09-05",
    },
    { booked_by_setter: "Pearl", call_outcome: "no_show", closed_won_at: null },
    { booked_by_setter: null, call_outcome: null, closed_won_at: null },
  ],
  lastRun,
};

describe("buildKpiReport", () => {
  const report = buildKpiReport(input);
  const [funnels, webinar, reEngagement, lane2] = report.sections;

  it("rows are channel x CTA path with paired rates and cohort basis", () => {
    const yt = funnels!.rows.find((row) => row.key === "YouTube|book-call")!;
    expect(yt.detail).toBe("Direct booking");
    expect(
      funnels!.rows.find((row) => row.key === "Website|unknown"),
    ).toBeUndefined();
    expect(funnels!.hiddenNote).toContain("visits or impressions only");
    expect(yt.values).toMatchObject({
      visits: 1500,
      // Both rates are over every visit the channel had, including the
      // second day, which converted nobody: 120 / 1500 and 200 / 1500. A
      // visit-day with no lead row is zero leads, not a gap.
      thankYouVisits: 120,
      thankYouConv: 8,
      leads: 200,
      optIn: 13.3,
      leadToBook: 40,
      booked: 80,
      showRate: 50,
      closeRate: 10,
      won: 4,
      leadToClose: 2,
      revenue: null,
      spend: null,
      costPerBooked: null,
    });
    expect(yt.owner).toBe("Ayman");
    expect(yt.sourceOfTruth).toBe("ga4-visits + leads");
    // Oldest run among the connectors behind the row.
    expect(yt.lastVerified).toBe("2026-09-11T09:00:00.000Z");
  });

  it("hides visit-only rows and keeps webinar, DM and email out of section 1", () => {
    expect(funnels!.hidden).toBe(1);
    const channels = funnels!.rows.map((row) => row.label);
    expect(channels).toEqual(["All channels", "YouTube", "Instagram"]);
  });

  it("totals every channel, the hidden visit-only row included", () => {
    const all = funnels!.rows[0]!;
    expect(all.label).toBe("All channels");
    expect(all.detail).toBe("every row below, plus 1 with no outcome");
    // Leads add up down the column; visits are larger than the two visible
    // rows sum to, because the hidden visit-only row is real traffic.
    const visible = funnels!.rows.slice(1);
    const sum = (key: string) =>
      visible.reduce((total, row) => total + (row.values[key] ?? 0), 0);
    expect(all.values.leads).toBe(sum("leads"));
    expect(all.values.booked).toBe(sum("booked"));
    expect(all.values.won).toBe(sum("won"));
    expect(all.values.visits).toBeGreaterThan(sum("visits"));
    // A pooled rate, not an average of the rows' rates.
    expect(all.values.leadToBook).toBe(
      Math.round((all.values.booked! / all.values.leads!) * 1000) / 10,
    );
  });

  it("totals webinars and keeps unobserved attendees null in the total", () => {
    expect(webinar!.rows[0]!.label).toBe("All webinars");
    expect(webinar!.rows[0]!.values).toMatchObject({
      registrations: 1800,
      attendees: 300,
      // booked_calls (32 + 16), the count of record. Shown and Won come from the booking-link join, so
      // the denominator is the population they are counted over -- not booked_ever (65, Close's tag
      // cohort, a different set of people) and not booked_night_of (50, a subset of one night).
      booked: 48,
      bookedEver: 65,
      bookedNightOf: 50,
      showRate: 62.5, // 30 shown over 48 booked calls; 46.2% over booked_ever, 60% over night-of
      showNoBooking: 3,
      won: 7,
      revenue: 50000,
      spend: 10000,
      costPerBooked: 208, // $10,000 over 48 booked calls, was $154 over the tag cohort
    });
    expect(webinar!.rows[1]!.label).toBe("Sept 8");
  });

  it("never reports more shows than bookings", () => {
    for (const row of webinar!.rows) {
      const { showed, booked } = row.values;
      if (typeof showed === "number" && typeof booked === "number") {
        expect(showed).toBeLessThanOrEqual(booked);
      }
    }
  });

  it("divides shows by the population they were counted over, never by the tag cohort", () => {
    // Sept 8 alone: 20 shown, 32 booked calls, 40 in Close's tag cohort. The two booking numbers cross in
    // both directions across the quarter, so a wrong denominator is wrong in both directions too -- this
    // page published 25.7% for Sept 1 against a real 60%, and 51.1% for Sept 8 against a real 65.7%.
    const one = buildKpiReport({
      ...input,
      webinars: [input.webinars[0]!],
    }).sections.find((section) => section.key === "webinar")!;
    expect(one.rows[0]!.values.showRate).toBe(62.5);
    expect(one.rows[0]!.values.showRate).not.toBe(50);

    // A sender too old to carry the count of record leaves the rate a dash. Falling back to `booked_ever`
    // is what produced the wrong rate in the first place, and a wrong rate reads as confident.
    const legacy = buildKpiReport({
      ...input,
      webinars: [{ ...input.webinars[0]!, booked_calls: null }],
    }).sections.find((section) => section.key === "webinar")!;
    expect(legacy.rows[0]!.values.booked).toBeNull();
    expect(legacy.rows[0]!.values.showRate).toBeNull();
    expect(legacy.rows[0]!.values.costPerBooked).toBeNull();
    // The tag cohort stays visible as its own number; it is just never divided into anything.
    expect(legacy.rows[0]!.values.bookedEver).toBe(40);
    expect(legacy.rows[0]!.values.showed).toBe(20);
  });

  it("withholds the rates a still-open window decides, and keeps the counts", () => {
    const open = buildKpiReport({
      ...input,
      webinars: [
        {
          ...input.webinars[0]!,
          booking_maturing: true,
          revenue_maturing: true,
        },
      ],
    }).sections.find((section) => section.key === "webinar")!;
    const values = open.rows[0]!.values;
    // A cohort still booking has no final rate; a confident 0% is the same lie as a 335%.
    expect(values.showRate).toBeNull();
    expect(values.regToBook).toBeNull();
    expect(values.costPerBooked).toBeNull();
    expect(values.closeRate).toBeNull();
    expect(values.regToClose).toBeNull();
    // The counts are real, just not final.
    // The count of record, not the tag cohort (40). A maturing window withholds the rates, never the counts.
    expect(values.booked).toBe(32);
    expect(values.bookedEver).toBe(40);
    expect(values.showed).toBe(20);
    expect(values.won).toBe(5);
  });

  it("differences GHL lifetime totals and drops single snapshots", () => {
    expect(reEngagement!.hidden).toBe(1);
    const w1 = reEngagement!.rows.find((row) => row.key === "workflow|w1")!;
    expect(w1.values).toMatchObject({
      sent: 500,
      delivered: 475,
      deliveryRate: 95,
      replied: 15,
      booked: null,
    });
    const spine = reEngagement!.rows.find(
      (row) => row.key === "re-engagement|spine",
    )!;
    expect(spine.values).toMatchObject({ leads: 5, booked: 2, sent: null });
  });

  it("counts setters by booking date and the DM funnel from ManyChat", () => {
    const [team, pearl, unassigned, dm] = lane2!.rows;
    expect(team!.values).toMatchObject({ booked: 3, showed: 2, won: 1 });
    expect(pearl!.label).toBe("Pearl");
    expect(pearl!.values).toMatchObject({
      booked: 2,
      showRate: 50,
      won: 1,
      closeRate: 100,
    });
    expect(unassigned!.label).toBe("No setter (self-booked)");
    expect(dm!.values).toMatchObject({
      leads: 40,
      clicks: 20,
      booked: 10,
      won: 2,
    });
    expect(dm!.lastVerified).toBeNull();
  });

  it("refuses a rate above 100% instead of printing it", () => {
    const skewed = buildKpiReport({
      ...input,
      facts: [fact({ visits: 10, leads: 25, booked: 2 })],
    });
    const yt = skewed.sections[0]!.rows[0]!;
    expect(yt.values.optIn).toBeNull();
    expect(yt.values.leadToBook).toBe(8);
  });
});

describe("kpiReportToCsv", () => {
  it("writes one block per section with blanks for unobserved cells", () => {
    const csv = kpiReportToCsv(buildKpiReport(input));
    const blocks = csv.trim().split("\n\n");
    expect(blocks).toHaveLength(4);
    expect(blocks[0]!.split("\n")[0]).toMatch(
      /^Section,Row,Detail,Impressions,CTR,/,
    );
    const yt = blocks[0]!
      .split("\n")
      .find((line) => line.startsWith("Content and website funnels,YouTube"))!;
    expect(yt).toContain(",1500,120,8,13.3,200,40,80,50,");
    expect(yt).toContain(",,,,ga4-visits + leads,Ayman,Weekly,");
  });
});
