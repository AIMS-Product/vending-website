import { describe, expect, it } from "vitest";
import { buildDataReport, type DataReportInput } from "./data-report";
import { compare, summariseAudit, type AuditResult } from "./data-audit";

const passing = (checkId: string): AuditResult =>
  compare({
    checkId,
    label: "Visits",
    window: "last 7 days",
    sourceName: "Google Analytics",
    ours: 1000,
    source: 1000,
    tolerancePct: 2,
  });

const failing: AuditResult = compare({
  checkId: "ad-spend",
  label: "Ad spend",
  window: "last 4 days",
  sourceName: "the ad platforms",
  ours: 1500,
  source: 1000,
  tolerancePct: 1,
  unit: "money",
});

const input = (overrides: Partial<DataReportInput> = {}): DataReportInput => ({
  period: "day",
  windowLabel: "Friday 19 September",
  channels: [
    { label: "Google Ads", leads: 12, contacts: null, booked: 5, spend: 480 },
    { label: "Webinar", leads: 1, contacts: 300, booked: 9, spend: 1200 },
  ],
  close: {
    label: "Sep 12 to Sep 18",
    complete: true,
    rows: [
      {
        label: "Reactivation Scrapers",
        booked: 41,
        showed: 7,
        qualified: 5,
        won: 1,
        revenue: 5997,
      },
    ],
  },
  audit: {
    summary: summariseAudit([passing("a"), passing("b")]),
    results: [passing("a"), passing("b")],
    runAt: "2026-09-19T12:30:00.000Z",
  },
  dashboardUrl: "https://www.vendingpreneurs.com/admin/analytics",
  ...overrides,
});

describe("buildDataReport", () => {
  it("leads with the trust line and totals leads and calls in the subject", () => {
    const report = buildDataReport(input());

    expect(report.subject).toBe(
      "EOD Friday 19 September: 13 leads today, 41 calls booked this week",
    );
    expect(report.text.split("\n")[2]).toBe(
      "All 2 checks agree with their source systems.",
    );
  });

  it("says in the subject when a number disagrees with its source", () => {
    const results = [passing("a"), failing];
    const report = buildDataReport(
      input({
        audit: {
          summary: summariseAudit(results),
          results,
          runAt: "2026-09-19T12:30:00.000Z",
        },
      }),
    );

    expect(report.subject).toContain("[CHECK FAILED]");
    expect(report.text).toContain("Ad spend: Ours $1,500 is 50% above");
    expect(report.text).toContain("WRONG");
  });

  it("never claims agreement when no audit ran", () => {
    const report = buildDataReport(input({ audit: null }));
    expect(report.subject).toContain("[unverified]");
    expect(report.text).toContain("these numbers are unverified");
  });

  it("keeps registrations out of the lead column and dashes what was not observed", () => {
    const report = buildDataReport(input());
    const webinar = report.text
      .split("\n")
      .find((line) => line.startsWith("Webinar"))!;

    expect(webinar).toContain("300");
    expect(webinar).toMatch(/Webinar\s+1\s+300\s+9/);
    const googleAds = report.text
      .split("\n")
      .find((line) => line.startsWith("Google Ads"))!;
    expect(googleAds).toMatch(/Google Ads\s+12\s+-\s+5/);
  });

  it("labels every figure so a phone can stack the table into cards", () => {
    const report = buildDataReport(input());

    // No monospace block: that is what wrapped into nonsense on a phone.
    expect(report.html).not.toContain("<pre");
    expect(report.html).toContain("@media only screen and (max-width:520px)");
    // Each cell carries the column it came from, which is the stacked label.
    expect(report.html).toContain('data-label="Leads"');
    expect(report.html).toContain('data-label="Revenue"');
    // The row's own name is the card title, not a labelled figure.
    expect(report.html).toContain(
      '<td align="left" class="label" data-label="Channel">Google Ads</td>',
    );
  });

  it("shows a source that is not connected instead of leaving it out", () => {
    const report = buildDataReport(
      input({
        sources: [
          {
            label: "Instagram DM (ManyChat)",
            values: [{ label: "Events", value: "0" }],
            note: "not connected: Mike has not added the External Request steps",
          },
        ],
      }),
    );

    expect(report.text).toContain("Instagram DM (ManyChat): 0 events");
    expect(report.text).toContain("not connected");
    expect(report.html).toContain("Instagram DM (ManyChat)");
  });

  it("marks a week that has not finished", () => {
    const report = buildDataReport(
      input({
        period: "week",
        close: {
          label: "Sep 19 to Sep 25",
          complete: false,
          rows: [
            {
              label: "YouTube",
              booked: 3,
              showed: 0,
              qualified: 0,
              won: 0,
              revenue: 0,
            },
          ],
        },
      }),
    );
    expect(report.text).toContain("still filling");
    expect(report.subject.startsWith("EOW")).toBe(true);
  });
});
