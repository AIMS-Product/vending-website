import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: {} }));

import { applyLeadDefinition } from "./channel-report";
import { buildFunnelMonthly } from "./funnel-monthly";
import { collapseToLeads } from "@/lib/analytics/lead-definition";

/**
 * The guard for "every surface counts a lead the same way". The same month of
 * submissions — repeats, a newsletter signup, a test, a chatbot capture — goes
 * through the month tables (Funnels, Exec), the channel spine (Channels, KPI,
 * Map, reporting API) and the shared collapse the range tabs use. If any of
 * them grows its own filter, these numbers split and this fails.
 */
const rows = [
  ["pat@buyer.com", "2026-08-03T10:00:00Z", "/contact", null],
  ["pat@buyer.com", "2026-08-03T10:04:00Z", "/book-now", null],
  ["sam@buyer.com", "2026-08-05T10:00:00Z", "/booking-youtube", null],
  ["lee@buyer.com", "2026-08-09T10:00:00Z", "/", null],
  ["lee@buyer.com", "2026-08-30T10:00:00Z", "/about", null],
  [
    "reader@buyer.com",
    "2026-08-10T10:00:00Z",
    "/newsletter",
    "newsletter_subscribed",
  ],
  ["test@example.com", "2026-08-11T10:00:00Z", "/contact", null],
  ["chat@buyer.com", "2026-08-12T10:00:00Z", "/", null],
].map(([email, created_at, source_path, lifecycle_status], index) => ({
  id: `row-${index}`,
  email,
  full_name: "Buyer",
  created_at: created_at as string,
  source_path,
  lifecycle_status,
  utm_source: index === 7 ? null : "youtube",
  utm_medium: index === 7 ? null : "video",
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  metadata: index === 7 ? { source: "chatbot" } : null,
  call_booked_at: null,
  call_outcome: null,
  closed_won_at: null,
  closed_won_value: null,
}));

describe("every surface agrees on the lead count", () => {
  it("counts four leads in August on the month table, the spine and the range tabs", () => {
    const expected = 4; // pat, sam, lee, chat

    const month = buildFunnelMonthly({
      leads: rows,
      visits: [],
      shows: [],
      now: new Date("2026-09-15T00:00:00Z"),
    }).months.find((period) => period.key === "2026-08");

    const spine = applyLeadDefinition([], rows, {
      startDay: "2026-08-01",
      endDay: "2026-08-31",
      includeInternal: false,
    }).reduce((total, fact) => total + (fact.leads ?? 0), 0);

    expect(collapseToLeads(rows)).toHaveLength(expected);
    expect(month?.totals.leads).toBe(expected);
    expect(spine).toBe(expected);
  });
});
