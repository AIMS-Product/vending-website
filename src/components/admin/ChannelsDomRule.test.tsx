import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildChannelFlow } from "@/lib/analytics/channel-flow";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/analytics-dashboard-data", () => ({
  readCalls: vi.fn(),
  readDeals: vi.fn(),
}));

import { DomRuleTable } from "./ChannelsDomRule";

const calls = [
  {
    meetingId: "m1",
    leadId: "a",
    funnel: "Internal Webinar",
    bookedBy: "Marketing",
    showUp: "Yes",
    qualified: "Yes",
  },
  {
    meetingId: "m2",
    leadId: "b",
    funnel: "Instagram",
    bookedBy: "Lane 2",
    showUp: null,
    qualified: null,
  },
] as unknown as Parameters<typeof buildChannelFlow>[0]["calls"];

describe("DomRuleTable", () => {
  it("draws each band with its count and a total equal to every counted call", () => {
    const html = renderToStaticMarkup(
      <DomRuleTable
        flow={buildChannelFlow({
          calls,
          captured: [],
          wins: [{ leadId: "a", value: null }],
        })}
      />,
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Webinar 1 1 1 1 $0");
    expect(text).toContain("Lane 2 &amp; Social DMs 1 0 0 0 $0");
    expect(text).toContain("Total 2 1 1 1 $0");
    expect(text).toContain("1 won deal has no value in Close");
    expect(text).not.toContain("Instagram");
  });

  it("says so when nothing was counted, never an empty table", () => {
    const html = renderToStaticMarkup(
      <DomRuleTable
        flow={buildChannelFlow({ calls: [], captured: [], wins: [] })}
      />,
    );
    expect(html).toContain("No calls counted in this range.");
    expect(html).not.toContain("<table");
  });
});
