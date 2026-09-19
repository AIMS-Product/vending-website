import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChannelLeaderboard } from "./OverviewPanels";
import {
  METRIC_KEYS,
  type ChannelReportRow,
  type Metrics,
} from "@/lib/services/channel-report-rollup";

function metrics(overrides: Partial<Metrics> = {}): Metrics {
  const out = {} as Metrics;
  for (const key of METRIC_KEYS) out[key] = null;
  return { ...out, ...overrides };
}

function row(
  label: string,
  current: Partial<Metrics>,
  bookPct: number | null = null,
): ChannelReportRow {
  return {
    key: label,
    label,
    metrics: metrics(current),
    prior: metrics(),
    rates: { leadPct: null, bookPct, winPct: null },
    directBooked: null,
    costPerLead: null,
    costPerBooked: null,
    costPerSignup: null,
  };
}

describe("ChannelLeaderboard", () => {
  it("marks each channel with its brand artwork and links into its detail", () => {
    const html = renderToStaticMarkup(
      <ChannelLeaderboard
        canEdit
        rows={[row("YouTube", { leads: 40, booked: 6 }, 15)]}
        tailCount={0}
        range="30d"
      />,
    );

    expect(html).toContain('src="/admin/brands/youtube.svg"');
    expect(html).toContain('alt="YouTube"');
    expect(html).toContain("tab=channels&amp;channel=YouTube");
    expect(html).toContain("6 booked");
    expect(html).toContain("15% of leads");
  });

  it("sends a channel with its own admin page there instead", () => {
    const html = renderToStaticMarkup(
      <ChannelLeaderboard
        canEdit
        rows={[row("Chatbot", { leads: 12 })]}
        tailCount={0}
        range="30d"
      />,
    );

    expect(html).toContain('href="/admin/chatbot"');
  });

  it("shows a dash for a channel no connector reported leads for", () => {
    const html = renderToStaticMarkup(
      <ChannelLeaderboard
        canEdit
        rows={[row("Trustpilot", { visits: 80 })]}
        tailCount={0}
        range="30d"
      />,
    );

    expect(html).toContain("—");
    expect(html).not.toContain(">0<");
  });

  it("holds back a booking rate that only two leads sit behind", () => {
    const html = renderToStaticMarkup(
      <ChannelLeaderboard
        canEdit
        rows={[row("LinkedIn", { leads: 2, booked: 2 }, 100)]}
        tailCount={0}
        range="30d"
      />,
    );

    expect(html).toContain("2 booked");
    // The bar's own width is 100%, so the assertion names the rate's wording.
    expect(html).not.toContain("100% of leads");
  });
});
