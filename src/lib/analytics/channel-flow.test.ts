import { describe, expect, it } from "vitest";
import type { CloseCall } from "@/lib/services/close-week-view";
import {
  buildChannelFlow,
  flowChannelForFunnel,
  flowChannelForSpine,
  stageRate,
} from "./channel-flow";

const call = (over: Partial<CloseCall> & { leadId: string }): CloseCall => ({
  funnel: "YouTube",
  status: "Lead",
  bookedDate: "2026-09-10",
  showUp: null,
  qualified: null,
  ...over,
});

describe("channel flow", () => {
  it("maps both vocabularies onto the same band", () => {
    expect(flowChannelForSpine("Instagram DM")).toBe("instagram");
    expect(flowChannelForFunnel("Anthony IG")).toBe("instagram");
    expect(flowChannelForFunnel("reactivation scrapers")).toBe("reactivation");
    expect(flowChannelForSpine("Chatbot")).toBe("website");
    expect(flowChannelForFunnel(null)).toBe("other");
    expect(flowChannelForSpine("Phcheck")).toBe("other");
  });

  it("counts recorded stages without inferring one from another", () => {
    const flow = buildChannelFlow({
      captured: [
        { channel: "YouTube", count: 10 },
        { channel: "Webinar", count: 100 },
      ],
      calls: [
        call({ leadId: "a", showUp: "Yes", qualified: "Yes" }),
        call({ leadId: "b", showUp: "No", qualified: "yes" }),
        call({ leadId: "c", showUp: "yes" }),
        call({ leadId: "d", funnel: "Internal Webinar" }),
      ],
      wins: [{ leadId: "a", value: 6000 }],
    });
    const yt = flow.bands.find((b) => b.key === "youtube")!;
    expect(yt.values).toEqual([10, 3, 2, 2, 1]);
    expect(yt.revenue).toBe(6000);
    expect(flow.qualifiedWithoutShow).toBe(1);
    expect(flow.totals).toEqual([110, 4, 2, 2, 1]);
  });

  it("applies the SteelTrap rule before any stage and discloses it", () => {
    const flow = buildChannelFlow({
      captured: [],
      calls: [
        call({ leadId: "a", status: "🔻 Canceled (by Lead)", showUp: "Yes" }),
        call({ leadId: "b", funnel: "LTF - Quiz Funnel" }),
        call({ leadId: "c" }),
      ],
      wins: [],
    });
    expect(flow.excluded).toBe(2);
    expect(flow.totals).toEqual([0, 1, 0, 0, 0]);
  });

  it("reads a win from the opportunity, not the current status", () => {
    const flow = buildChannelFlow({
      captured: [],
      // Status has moved on after the sale; the opportunity still says won.
      calls: [call({ leadId: "a", status: "Onboarding", showUp: "Yes" })],
      wins: [
        { leadId: "a", value: null },
        { leadId: "a", value: 500 },
      ],
    });
    expect(flow.bands[0]).toMatchObject({
      values: [0, 1, 1, 0, 1],
      revenue: 500,
      unvalued: 1,
    });
  });

  it("counts a lead once even if the read returns it twice", () => {
    const flow = buildChannelFlow({
      captured: [],
      calls: [call({ leadId: "a" }), call({ leadId: "a" })],
      wins: [],
    });
    expect(flow.totals[1]).toBe(1);
  });

  it("drops empty bands and keeps a booked-only band", () => {
    const flow = buildChannelFlow({
      captured: [],
      calls: [call({ leadId: "a", funnel: "Reactivation Scrapers" })],
      wins: [],
    });
    expect(flow.bands.map((b) => b.key)).toEqual(["reactivation"]);
    expect(flow.bands[0]!.values[0]).toBe(0);
  });

  it("returns null for a rate over nothing", () => {
    expect(stageRate(3, 0)).toBeNull();
    expect(stageRate(1, 3)).toBe(33.3);
  });
});
