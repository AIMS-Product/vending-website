import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildChannelFlow } from "@/lib/analytics/channel-flow";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/analytics-dashboard-data", () => ({
  readRuleFlow: vi.fn(),
}));

import { RuleTable } from "./ChannelsByRule";

const call = (over: Record<string, unknown>) => ({
  status: null,
  bookedDate: "2026-10-06",
  showUp: null,
  qualified: null,
  leadOwner: "Joe Dysert",
  ...over,
});
const calls = [
  call({
    leadId: "a",
    funnel: "Internal Webinar",
    showUp: "Yes",
    qualified: "Yes",
  }),
  call({
    leadId: "b",
    funnel: "Reactivation Scrapers",
    leadOwner: "Someone Else",
  }),
  // Off the Lane 1 roster: not drawn.
  call({ leadId: "c", funnel: "Instagram", leadOwner: "Someone Else" }),
] as unknown as Parameters<typeof buildChannelFlow>[0]["calls"];

describe("RuleTable", () => {
  it("draws each band with its count and a total of every kept call", () => {
    const html = renderToStaticMarkup(
      <RuleTable
        flow={buildChannelFlow({
          calls,
          captured: [],
          wins: [{ leadId: "a", value: null }],
        })}
      />,
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Webinar 1 1 1 1 $0");
    expect(text).toContain("Sales reactivation 1 0 0 0 $0");
    expect(text).toContain("Total 2 1 1 1 $0");
    expect(text).toContain("1 won deal has no value in Close");
    expect(text).not.toContain("Instagram");
  });

  it("says so when nothing was booked, never an empty table", () => {
    const html = renderToStaticMarkup(
      <RuleTable
        flow={buildChannelFlow({ calls: [], captured: [], wins: [] })}
      />,
    );
    expect(html).toContain("No first calls in this range.");
    expect(html).not.toContain("<table");
  });
});
