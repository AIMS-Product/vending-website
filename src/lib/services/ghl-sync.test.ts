import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { GhlClient } from "@/lib/ghl/client";

vi.mock("@/lib/config", () => ({ config: {} }));

import { emailDeltaRows, syncGhl } from "./ghl-sync";

function buildClient(priorSnapshots: unknown[] = []) {
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((name: string) => {
    if (name === "channel_sync_runs") {
      return {
        insert: vi.fn(
          async (row: Record<string, unknown>) => (
            runs.push(row),
            { error: null }
          ),
        ),
      };
    }
    const builder: Record<string, unknown> = {
      upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        (upserts[name] ??= []).push(...rows);
        return { error: null };
      }),
    };
    for (const method of ["select", "lt", "order", "limit"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: priorSnapshots, error: null }).then(resolve);
    return builder;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

const ghl: GhlClient = {
  listWorkflows: async () => [
    { id: "w1", name: "Webinar Follow Up", status: "published" },
  ],
  fetchWorkflowEmailStats: async () => ({
    sent: 120,
    delivered: 118,
    opened: 50,
    clicked: 12,
    replied: 3,
  }),
  listForms: async () => [
    { id: "f1", name: "90 Day Checklist" },
    { id: "f2", name: "General 2026 Webinar Registration Form" },
  ],
  fetchFormSubmissions: async () => [
    { id: "s1", formId: "f1", createdAt: "2026-09-10T15:00:00.000Z" },
    { id: "s2", formId: "f1", createdAt: "2026-09-10T16:00:00.000Z" },
    { id: "s3", formId: "unknown-form", createdAt: "2026-09-11T01:00:00.000Z" },
    // A webinar registration is already a Webinar-channel registration.
    { id: "s4", formId: "f2", createdAt: "2026-09-10T17:00:00.000Z" },
  ],
};

const now = new Date("2026-09-11T11:20:00.000Z");

describe("emailDeltaRows", () => {
  const snap = (day: string, sent: number, clicked: number) => ({
    snapshot_day: day,
    workflow_id: "w1",
    workflow_name: "Webinar Follow Up",
    sent,
    delivered: 0,
    opened: 0,
    clicked,
    replied: 0,
  });

  it("diffs against the newest earlier snapshot and skips a workflow with none", () => {
    const rows = emailDeltaRows(
      [
        snap("2026-09-11", 120, 12),
        { ...snap("2026-09-11", 5, 0), workflow_id: "new" },
      ],
      [snap("2026-09-09", 90, 10), snap("2026-09-10", 100, 15)],
      "2026-09-10",
    );
    expect(rows).toEqual([
      {
        day: "2026-09-10",
        source: "ghl_email",
        medium: "email",
        campaign: "webinar-follow-up",
        content: null,
        term: null,
        impressions: 20,
        // 12 < 15: GHL corrected the total, so clicks is unobserved, not -3.
        clicks: null,
      },
    ]);
  });
});

describe("syncGhl", () => {
  it("records both connectors as skipped without a client", async () => {
    const { client, runs } = buildClient();
    const result = await syncGhl({ client, ghl: null, now });
    expect(result.connectors.map((run) => run.error)).toEqual([
      expect.stringMatching(/^skipped:/),
      expect.stringMatching(/^skipped:/),
    ]);
    expect(runs).toHaveLength(2);
  });

  it("stores today's snapshot, writes email deltas and form leads onto the spine", async () => {
    const { client, upserts } = buildClient([
      {
        snapshot_day: "2026-09-10",
        workflow_id: "w1",
        workflow_name: "Webinar Follow Up",
        sent: 100,
        delivered: 99,
        opened: 40,
        clicked: 10,
        replied: 3,
      },
    ]);
    const result = await syncGhl({ client, ghl, now });
    expect(result.connectors.map((run) => [run.connector, run.error])).toEqual([
      ["ghl-email", null],
      ["ghl-forms", null],
    ]);
    expect(upserts.ghl_email_stats).toEqual([
      expect.objectContaining({
        snapshot_day: "2026-09-11",
        workflow_id: "w1",
        sent: 120,
      }),
    ]);
    const spine = upserts.channel_daily!;
    expect(spine).toContainEqual(
      expect.objectContaining({
        day: "2026-09-10",
        channel: "Email",
        source: "ghl_email",
        campaign: "webinar-follow-up",
        impressions: 20,
        clicks: 2,
      }),
    );
    // Two submissions on the same form and day merge into one row of leads = 2.
    expect(spine).toContainEqual(
      expect.objectContaining({
        day: "2026-09-10",
        source: "ghl_form",
        campaign: "90-day-checklist",
        leads: 2,
      }),
    );
    expect(spine).toContainEqual(
      expect.objectContaining({
        day: "2026-09-11",
        campaign: "unknown-form",
        leads: 1,
      }),
    );
  });

  it("routes a known form to the channel that handed it out", async () => {
    const { client, upserts } = buildClient();
    const day = "2026-09-10T15:00:00.000Z";
    const routed: GhlClient = {
      ...ghl,
      listForms: async () => [
        {
          id: "74fUmvjrsYdkdhUZRwBn",
          name: "90 Day Checklist - MH - Info Form",
        },
        {
          id: "lWsjML1EFRINeZtzs9ZC",
          name: "90 Day Checklist - AK - Info Form",
        },
        {
          id: "B45aIM2IgjOh3FD8RYrl",
          name: "PAID: VP Internal Team: 90 Days Lead Magnet Form",
        },
        { id: "uzY5o2A3dIjg6JvkDKPe", name: "VSL" },
        { id: "LZ4wWLGozv6Gt813E3XM", name: "Waitlist Form" },
        { id: "7K87uNNVmBmzjuQOtUdh", name: "Course Access Form" },
        { id: "mOvuOW3y5tn9hNuti3Si", name: "Form 20" },
      ],
      fetchFormSubmissions: async () => [
        { id: "a", formId: "74fUmvjrsYdkdhUZRwBn", createdAt: day },
        { id: "b", formId: "lWsjML1EFRINeZtzs9ZC", createdAt: day },
        { id: "c", formId: "B45aIM2IgjOh3FD8RYrl", createdAt: day },
        { id: "d", formId: "uzY5o2A3dIjg6JvkDKPe", createdAt: day },
        { id: "e", formId: "LZ4wWLGozv6Gt813E3XM", createdAt: day },
        { id: "f", formId: "7K87uNNVmBmzjuQOtUdh", createdAt: day },
        { id: "g", formId: "mOvuOW3y5tn9hNuti3Si", createdAt: day },
      ],
    };
    await syncGhl({ client, ghl: routed, now });
    const leads = upserts
      .channel_daily!.filter((row) => row.leads != null)
      .map((row) => [row.channel, row.source, row.medium, row.content]);
    expect(leads).toEqual([
      ["Instagram", "mike-ig", "lead-magnet", "90-day-checklist"],
      ["Instagram", "anthony-ig", "lead-magnet", "90-day-checklist"],
      ["Meta Ads", "meta_ads", "paid", "90-days-lead-magnet"],
      ["VSL", "vsl", "form", "vsl"],
      ["Webinar", "ghl_form", "waitlist", "waitlist"],
      // Form 20 is not in the map, so it stays a GHL forms lead. Course
      // Access is a member unlocking the course, not a lead: nothing written.
      ["GHL forms", "ghl_form", "form", "(not set)"],
    ]);
  });
});
