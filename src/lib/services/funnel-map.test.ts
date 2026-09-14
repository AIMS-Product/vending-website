import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({ config: {} }));
// Only the rollup is stubbed. `fetchFacts` stays real so the paged read of
// channel_daily is the one under test.
vi.mock("@/lib/services/channel-report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./channel-report")>()),
  getChannelsTab: async () => ({
    connected: true,
    report: { rows: [], funnel: [] },
  }),
}));

import { getFunnelMap } from "./funnel-map";

type Row = Record<string, unknown>;

/**
 * Two tables, three shapes: the newest snapshot day, that day's workflow
 * rows, and the spine rows in range.
 */
function buildClient({
  snapshotDays = [{ snapshot_day: "2026-09-14" }],
  workflows = [] as Row[],
  spine = [] as Row[],
  cohort = [] as Row[],
}) {
  const from = vi.fn((name: string) => {
    let filteredToOneDay = false;
    let page: [number, number] | null = null;
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "order", "limit", "gte", "lte", "in"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.eq = vi.fn(() => {
      filteredToOneDay = true;
      return builder;
    });
    // channel_daily is read a page at a time; PostgREST caps a plain select
    // at 1,000 rows, so a fake that ignores `range` would hide a real bug.
    builder.range = vi.fn((start: number, end: number) => {
      page = [start, end];
      return builder;
    });
    builder.then = (resolve: (value: unknown) => unknown) => {
      const data =
        name === "channel_daily"
          ? page
            ? spine.slice(page[0], page[1] + 1)
            : spine
          : name === "close_lead_funnel"
            ? page
              ? cohort.slice(page[0], page[1] + 1)
              : cohort
            : filteredToOneDay
              ? workflows
              : snapshotDays;
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return builder;
  });
  return { from } as unknown as Pick<SupabaseClient<Database>, "from">;
}

const formRow = {
  source: "mike-ig",
  medium: "lead-magnet",
  campaign: "90-day-checklist-form",
  content: "90-day-checklist",
  channel: "Instagram",
  leads: 7,
  impressions: null,
  clicks: null,
};

describe("getFunnelMap", () => {
  it("counts a routed form row as a GHL lead, credited to its channel", async () => {
    const { ghl } = await getFunnelMap({
      client: buildClient({ spine: [formRow] }),
    });

    expect(ghl.inRange.formLeads).toBe(7);
    expect(ghl.forms).toEqual([
      {
        campaign: "90-day-checklist-form",
        source: "mike-ig",
        channel: "Instagram",
        leads: 7,
      },
    ]);
  });

  it("ignores a link-tagged row that shares the source but not the form route", async () => {
    // The same person's organic Instagram post. Counting it as a form
    // submission would inflate GHL by every post they ever tagged.
    const { ghl } = await getFunnelMap({
      client: buildClient({
        spine: [
          formRow,
          { ...formRow, medium: "organic", content: "reel-12", leads: 40 },
        ],
      }),
    });

    expect(ghl.inRange.formLeads).toBe(7);
    expect(ghl.forms).toHaveLength(1);
  });

  it("joins email deltas to the workflow by the slug the connector writes", async () => {
    const { ghl } = await getFunnelMap({
      client: buildClient({
        workflows: [
          {
            workflow_name: "2A. Smart Vending Masterclass",
            sent: 82905,
            opened: 22743,
            clicked: 923,
          },
        ],
        spine: [
          {
            source: "ghl_email",
            medium: "email",
            campaign: "2a-smart-vending-masterclass",
            content: "",
            channel: "Email",
            leads: null,
            impressions: 300,
            clicks: 4,
          },
          {
            source: "ghl_email",
            medium: "email",
            campaign: "2a-smart-vending-masterclass",
            content: "",
            channel: "Email",
            leads: null,
            impressions: 200,
            clicks: null,
          },
        ],
      }),
    });

    expect(ghl.workflows[0]).toMatchObject({
      sent: 82905,
      sentInRange: 500,
      clickedInRange: 4,
    });
    expect(ghl.inRange.sent).toBe(500);
  });

  it("reads past the 1,000-row page cap", async () => {
    // A year of GHL rows is well over one page. Stopping at the cap would
    // undercount silently, which is worse than failing.
    const spine = Array.from({ length: 1_200 }, (_, index) => ({
      ...formRow,
      campaign: `form-${index}`,
      leads: 1,
    }));

    const { ghl } = await getFunnelMap({ client: buildClient({ spine }) });

    expect(ghl.inRange.formLeads).toBe(1_200);
  });

  it("leaves an unmeasured range unobserved rather than zero", async () => {
    const { ghl } = await getFunnelMap({
      client: buildClient({
        workflows: [
          { workflow_name: "Dormant", sent: 10, opened: 2, clicked: 0 },
        ],
      }),
    });

    expect(ghl.workflows[0].sentInRange).toBeNull();
    expect(ghl.inRange.sent).toBeNull();
    expect(ghl.lifetime.sent).toBe(10);
  });
});

describe("getFunnelMap cohort", () => {
  it("pages past the PostgREST cap instead of truncating the cohort", async () => {
    // 1,200 booked calls is under three months at the plan's rate. An unpaged
    // read returns 1,000 of them and every rate below is computed on 83% of
    // the people, with nothing anywhere saying so.
    const cohort = Array.from({ length: 1_200 }, () => ({
      funnel: "YouTube",
      first_sales_call_booked_date: "2026-09-10",
      first_call_show_up: "Yes",
      status_label: null,
    }));
    const data = await getFunnelMap({
      client: buildClient({ cohort }),
      now: new Date("2026-09-14T12:00:00Z"),
    });
    expect(data.cohort?.booked).toBe(1_200);
    expect(data.actuals.booked).toBe(1_200);
    expect(data.actuals.showed).toBe(1_200);
  });

  it("leaves booked unavailable, not zero, when the mirror is missing", async () => {
    const client = buildClient({});
    const broken = {
      from: (name: string) =>
        name === "close_lead_funnel"
          ? {
              select: () => broken.from(name),
              order: () => broken.from(name),
              gte: () => broken.from(name),
              lte: () => broken.from(name),
              range: () => broken.from(name),
              then: (resolve: (value: unknown) => unknown) =>
                Promise.resolve({
                  data: null,
                  error: { code: "42P01", message: "does not exist" },
                }).then(resolve),
            }
          : client.from(name as never),
    };
    const data = await getFunnelMap({
      client: broken as never,
      now: new Date("2026-09-14T12:00:00Z"),
    });
    expect(data.cohort).toBeNull();
    expect(data.actuals.booked).toBeNull();
    expect(data.actuals.won).toBeNull();
    expect(data.actualsBasis).toMatch(/unavailable rather than zero/);
  });
});
