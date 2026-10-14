import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/links/actions", () => ({ updateLinkMeta: vi.fn() }));

import { funnelSetBy, totalsByFunnel } from "./MarketingLinkFunnels";
import type { RegistryLink } from "@/lib/services/marketing-links";

function link(
  funnel: string | null,
  stats: RegistryLink["stats"],
): RegistryLink {
  return { funnel_name: funnel, stats } as RegistryLink;
}

const stats = (leads: number, calendarBookings = 0) => ({
  leads,
  booked: 1,
  calendarBookings,
  clicks: null,
  lastLeadAt: null,
});

describe("totalsByFunnel", () => {
  it("sums each funnel's links and leaves unassigned links out", () => {
    const rows = totalsByFunnel([
      link("VSL", stats(2)),
      link("Internal Webinar", stats(5, 9)),
      link("VSL", stats(3, 1)),
      link(null, stats(40)),
    ]);
    expect(rows).toEqual([
      {
        funnel: "Internal Webinar",
        links: 1,
        leads: 5,
        booked: 1,
        calendarBookings: 9,
      },
      { funnel: "VSL", links: 2, leads: 5, booked: 2, calendarBookings: 1 },
    ]);
  });

  it("counts a link with no results yet as a link", () => {
    expect(totalsByFunnel([link("VSL", null)])[0]).toMatchObject({
      links: 1,
      leads: 0,
    });
  });
});

describe("funnelSetBy", () => {
  it("says where a funnel came from", () => {
    expect(funnelSetBy("sheet")).toBe("from the old sheet");
    expect(funnelSetBy("close")).toBe("from Close records");
    expect(funnelSetBy("rule")).toBe("by source");
    expect(funnelSetBy("jess@modern-amenities.com")).toBe("set by jess");
  });
});
