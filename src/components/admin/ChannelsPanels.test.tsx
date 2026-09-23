import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChannelKpis, ChannelTable } from "./ChannelsPanels";
import type {
  ChannelReport,
  ChannelReportRow,
  Metrics,
} from "@/lib/services/channel-report-rollup";

function metrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    visits: null,
    thankyou_visits: null,
    leads: null,
    contacts: null,
    booked: null,
    showed: null,
    won: null,
    revenue: null,
    ...overrides,
  };
}

function report(): ChannelReport {
  return {
    totals: metrics({
      spend: 4200,
      leads: 145,
      contacts: 320,
      booked: 53,
      won: 9,
    }),
    priorTotals: metrics({
      spend: 3800,
      leads: 129,
      contacts: 300,
      booked: 48,
      won: 7,
    }),
    reach: [],
    funnel: [],
    rows: [],
    tail: [],
  };
}

function row(overrides: Partial<ChannelReportRow> = {}): ChannelReportRow {
  return {
    key: "instagram",
    label: "Instagram",
    metrics: metrics(),
    prior: metrics(),
    rates: { leadPct: null, bookPct: null, winPct: null },
    directBooked: null,
    costPerLead: null,
    costPerBooked: null,
    costPerSignup: null,
    ...overrides,
  };
}

describe("ChannelKpis", () => {
  it("lays out all five tiles in one strip row, not a 4-column wrap", () => {
    // Regression: AdminMetricStrip defaults to 4 columns, which wrapped the
    // 5th tile (Won) alone onto a second row with a stray divider.
    const html = renderToStaticMarkup(
      <ChannelKpis report={report()} days={30} />,
    );
    expect(html).toContain("lg:grid-cols-5");
    expect(html).not.toContain("xl:grid-cols-4");
  });
});

describe("ChannelTable leads and booked cells", () => {
  it("keeps the leads number and its delta chip on one line", () => {
    const html = renderToStaticMarkup(
      <ChannelTable
        title="By channel"
        rows={[
          row({
            metrics: metrics({ leads: 145 }),
            prior: metrics({ leads: 129 }),
          }),
        ]}
        tail={[]}
      />,
    );
    // The leads figure and its % chip share one whitespace-nowrap cell.
    expect(html).toContain('text-right whitespace-nowrap tabular-nums">145');
    expect(html).toContain("+12%");
  });

  it("keeps a skipped-form booked count on one line", () => {
    const html = renderToStaticMarkup(
      <ChannelTable
        title="By channel"
        rows={[
          row({
            metrics: metrics({ booked: 53 }),
            directBooked: 13,
          }),
        ]}
        tail={[]}
      />,
    );
    expect(html).toContain('text-right whitespace-nowrap tabular-nums">53');
    expect(html).toContain("13 skipped form");
  });
});
