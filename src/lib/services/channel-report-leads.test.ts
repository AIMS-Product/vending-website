import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: {} }));

import { applyLeadDefinition } from "./channel-report";
import type { ChannelFact } from "./channel-report-rollup";

const fact = (overrides: Partial<ChannelFact>): ChannelFact => ({
  day: "2026-08-10",
  channel: "YouTube",
  source: "youtube",
  medium: "video",
  campaign: "(not set)",
  content: "(not set)",
  destination: "unknown",
  spend: null,
  impressions: null,
  reach: null,
  clicks: null,
  visits: null,
  thankyou_visits: null,
  leads: null,
  booked: null,
  showed: null,
  won: null,
  revenue: null,
  ...overrides,
});

const lead = (email: string, created_at: string, extra = {}) => ({
  created_at,
  email,
  full_name: "Pat",
  utm_source: "youtube",
  utm_medium: "video",
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  call_booked_at: null,
  call_outcome: null,
  closed_won_at: null,
  metadata: null,
  ...extra,
});

const window = {
  startDay: "2026-08-01",
  endDay: "2026-08-31",
  includeInternal: false,
};

describe("applyLeadDefinition", () => {
  it("recounts site leads by person and moves registrations to contacts", () => {
    const facts = applyLeadDefinition(
      [
        // Stored as 3: the old connector counted every submit.
        fact({ leads: 3 }),
        // A webinar audience row: registrations, not site leads.
        fact({
          channel: "Webinar",
          source: "meta_ads",
          medium: "paid",
          leads: 2736,
        }),
      ],
      [
        lead("pat@buyer.com", "2026-08-10T10:00:00Z"),
        lead("pat@buyer.com", "2026-08-10T10:05:00Z"),
        lead("sam@buyer.com", "2026-08-10T11:00:00Z"),
      ],
      window,
    );

    expect(facts.find((row) => row.channel === "YouTube")).toMatchObject({
      leads: 2,
      contacts: null,
    });
    expect(facts.find((row) => row.channel === "Webinar")).toMatchObject({
      leads: null,
      contacts: 2736,
    });
  });

  it("reads a key only repeats or tests used as zero site leads, not contacts", () => {
    const [row] = applyLeadDefinition(
      [fact({ leads: 1 })],
      [lead("test@example.com", "2026-08-10T10:00:00Z")],
      window,
    );
    expect(row).toMatchObject({ leads: 0, contacts: null });
  });

  it("adds leads the nightly connector has not written yet", () => {
    const facts = applyLeadDefinition(
      [],
      [lead("pat@buyer.com", "2026-08-20T10:00:00Z")],
      window,
    );
    expect(facts).toEqual([
      expect.objectContaining({
        day: "2026-08-20",
        channel: "YouTube",
        leads: 1,
      }),
    ]);
  });

  it("recognises a repeat whose first submission fell before the window", () => {
    const facts = applyLeadDefinition(
      [],
      [
        lead("pat@buyer.com", "2026-07-25T10:00:00Z"),
        lead("pat@buyer.com", "2026-08-02T10:00:00Z"),
      ],
      window,
    );
    expect(facts).toEqual([]);
  });
});
