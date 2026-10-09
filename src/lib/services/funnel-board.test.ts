import { describe, expect, it } from "vitest";
import { brandFor } from "@/components/admin/ChannelLogo";
import {
  NO_FUNNEL,
  buildFunnelBoard,
  channelOfFunnel,
  mondayOf,
  type BoardCall,
  type BoardFill,
} from "@/lib/services/funnel-board";

const call = (over: Partial<BoardCall>): BoardCall => ({
  lead_id: "lead_x",
  email: null,
  display_name: "Pat Prospect",
  funnel: "Reactivation Scrapers",
  first_sales_call_booked_date: "2026-10-06",
  setter_name: null,
  ...over,
});

const fill = (over: Partial<BoardFill>): BoardFill => ({
  created_at: "2026-10-05T18:00:00Z",
  email: null,
  utm_source: null,
  utm_medium: null,
  referrer: null,
  metadata: null,
  close_lead_id: null,
  ...over,
});

const days = ["2026-10-05", "2026-10-06", "2026-10-07"];

describe("buildFunnelBoard", () => {
  const board = buildFunnelBoard({
    days,
    calls: [
      // Site lead from YouTube that Close filed as Reactivation Scrapers: moves.
      call({ lead_id: "a", setter_name: "Luke" }),
      // Matched by email when the fill carries no Close id.
      call({
        lead_id: "b",
        email: "Pat@Gmail.com",
        funnel: "Internal Webinar",
      }),
      // No site fill: keeps its Close funnel.
      call({ lead_id: "c", setter_name: "Luke" }),
      // Close "Website" with no site fill lands on our Website row.
      call({
        lead_id: "d",
        funnel: "Website",
        first_sales_call_booked_date: "2026-10-07",
      }),
      // A fill made AFTER the call does not credit it.
      call({ lead_id: "e", funnel: null }),
      // Outside the window, and internal: neither counted.
      call({ lead_id: "f", first_sales_call_booked_date: "2026-10-20" }),
      call({ lead_id: "g", email: "claude-test@vendingpreneurs-test.com" }),
    ],
    fills: [
      fill({ close_lead_id: "a", utm_source: "youtube", utm_medium: "video" }),
      fill({ email: "pat@gmail.com", utm_source: "google", utm_medium: "cpc" }),
      fill({
        close_lead_id: "e",
        utm_source: "youtube",
        created_at: "2026-10-08T18:00:00Z",
      }),
    ],
  });
  const row = (channel: string) =>
    board.groups.flatMap((g) => g.rows).find((r) => r.channel === channel);

  it("counts the same calls Close does, on the call day", () => {
    expect(board.total).toBe(5);
    expect(board.dayTotals).toEqual([0, 4, 1]);
    expect(board.internalExcluded).toBe(1);
  });

  it("credits site leads to the channel that brought them", () => {
    expect(row("YouTube")).toMatchObject({ total: 1, closeTotal: 0 });
    expect(row("Google Ads")).toMatchObject({ total: 1, closeTotal: 0 });
    expect(row("Reactivation Scrapers")).toMatchObject({
      total: 1,
      closeTotal: 2,
    });
    expect(row("Webinar")).toMatchObject({ total: 0, closeTotal: 1 });
    expect(row("Website")).toMatchObject({ total: 1, closeTotal: 1 });
    expect(row(NO_FUNNEL)).toMatchObject({ total: 1, closeTotal: 1 });
    expect(board.moved).toBe(2);
    expect(board.withSiteFill).toBe(2);
  });

  it("crosswalk columns add back up to Close's funnel totals", () => {
    const yt = board.crosswalk.find((r) => r.channel === "YouTube")!;
    expect(yt.funnels).toEqual({ "Reactivation Scrapers": 1 });
    const sum = (f: string) =>
      board.crosswalk.reduce((s, r) => s + (r.funnels[f] ?? 0), 0);
    expect(sum("Reactivation Scrapers")).toBe(2);
    expect(sum("Internal Webinar")).toBe(1);
    expect(board.setters).toEqual([{ name: "Luke", calls: 2 }]);
  });
});

describe("helpers", () => {
  it("maps Close funnels onto our channel names", () => {
    expect(channelOfFunnel("Internal Webinar")).toBe("Webinar");
    expect(channelOfFunnel("Linkedin")).toBe("LinkedIn");
    expect(channelOfFunnel("LTF - In-House")).toBe("LTF - In-House");
    expect(channelOfFunnel(null)).toBe(NO_FUNNEL);
    // The unknown row must not wear a vendor mark (it once read "Close").
    expect(brandFor(NO_FUNNEL)).toBeNull();
  });

  it("finds the Monday on or before a day", () => {
    expect(mondayOf("2026-10-09")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
  });
});
