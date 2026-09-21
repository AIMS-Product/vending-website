import { describe, expect, it } from "vitest";
import { totalMetric } from "./ChannelsPanels";
import type { ChannelReportRow } from "@/lib/services/channel-report-rollup";

const row = (metrics: Partial<ChannelReportRow["metrics"]>) =>
  ({ metrics }) as ChannelReportRow;

describe("channel table total row", () => {
  it("adds what was observed", () => {
    expect(
      totalMetric([row({ booked: 12 }), row({ booked: 30 })], "booked"),
    ).toBe(42);
  });

  it("skips channels that did not report the column", () => {
    expect(
      totalMetric([row({ booked: 12 }), row({ booked: null })], "booked"),
    ).toBe(12);
  });

  it("stays a dash when nothing reported it, never zero", () => {
    // A connector outage must not render as a real zero total.
    expect(
      totalMetric([row({ booked: null }), row({ booked: null })], "booked"),
    ).toBeNull();
  });

  it("keeps a genuine zero", () => {
    expect(totalMetric([row({ booked: 0 })], "booked")).toBe(0);
  });

  it("totals nothing over no rows", () => {
    expect(totalMetric([], "booked")).toBeNull();
  });
});
