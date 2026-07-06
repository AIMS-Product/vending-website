import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminOverview } from "./admin-overview";
import type { Database } from "@/types/database";

type AdminOverviewClient = Pick<SupabaseClient<Database>, "from">;

type FakeRow = Record<string, unknown>;

type FakeTableState = {
  rows: FakeRow[];
};

type FakeState = Record<string, FakeTableState>;

function buildClient(state: FakeState) {
  return {
    from(table: string) {
      return new FakeCountQuery(state[table]?.rows ?? []);
    },
  } as unknown as AdminOverviewClient;
}

/**
 * Minimal fake mirroring the count(head:true) query shape used by
 * getAdminOverview: `.select(fields, { count: "exact", head: true })`
 * followed by zero or more `.eq` / `.in` / `.gte` filters, resolved via
 * the PostgrestBuilder thenable contract (`{ count, error }`).
 */
class FakeCountQuery {
  private filters: Array<(row: FakeRow) => boolean> = [];

  constructor(private rows: FakeRow[]) {}

  select(_fields: string, _opts?: { count?: "exact"; head?: boolean }) {
    void _fields;
    void _opts;
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  in(key: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }

  gte(key: string, value: string) {
    this.filters.push((row) => String(row[key]) >= value);
    return this;
  }

  then(resolve: (value: { count: number; error: null }) => void) {
    const matched = this.rows.filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
    resolve({ count: matched.length, error: null });
  }
}

describe("getAdminOverview", () => {
  it("returns read-only counts for content, leads, and needs-attention items", async () => {
    const now = () => new Date("2026-07-06T12:00:00.000Z");
    const client = buildClient({
      seo_pages: {
        rows: [
          { id: "p1", status: "published" },
          { id: "p2", status: "published" },
          { id: "p3", status: "draft" },
        ],
      },
      news_posts: {
        rows: [
          { id: "n1", status: "published" },
          { id: "n2", status: "draft" },
          { id: "n3", status: "draft" },
        ],
      },
      lead_submissions: {
        rows: [
          {
            id: "l1",
            created_at: "2026-07-05T00:00:00.000Z",
            close_sync_status: "dead_letter",
          },
          {
            id: "l2",
            created_at: "2026-06-01T00:00:00.000Z",
            close_sync_status: "synced",
          },
          {
            id: "l3",
            created_at: "2026-07-01T00:00:00.000Z",
            close_sync_status: "pending",
          },
        ],
      },
      // One stuck lead (l1) with three failed retry events behind it. The
      // dashboard must report 1 — the same number the leads page banner
      // shows — never the event-row count.
      close_sync_events: {
        rows: [
          { id: "e1", status: "failed", lead_submission_id: "l1" },
          { id: "e2", status: "failed", lead_submission_id: "l1" },
          { id: "e3", status: "dead_letter", lead_submission_id: "l1" },
        ],
      },
    });

    await expect(getAdminOverview({ client, now })).resolves.toEqual({
      pagesPublished: 2,
      pagesDraft: 1,
      postsPublished: 1,
      postsDraft: 2,
      leadsThisWeek: 2,
      leadsTotal: 3,
      failedSyncs: 1,
      scheduledPublishPending: 0,
      scheduledPublishFailed: 0,
    });
  });

  it("only counts leads within the trailing 7-day window", async () => {
    const now = () => new Date("2026-07-06T12:00:00.000Z");
    const client = buildClient({
      seo_pages: { rows: [] },
      news_posts: { rows: [] },
      lead_submissions: {
        rows: [
          // Exactly 7 days before `now` — within the window (inclusive).
          { id: "l1", created_at: "2026-06-29T12:00:00.000Z" },
          // One millisecond before the window starts — excluded.
          { id: "l2", created_at: "2026-06-29T11:59:59.999Z" },
          { id: "l3", created_at: "2026-07-06T11:59:59.999Z" },
        ],
      },
      close_sync_events: { rows: [] },
    });

    const overview = await getAdminOverview({ client, now });

    expect(overview.leadsThisWeek).toBe(2);
    expect(overview.leadsTotal).toBe(3);
  });

  it("counts LEADS stuck in {failed, needs_review, dead_letter}, not sync event rows", async () => {
    const now = () => new Date("2026-07-06T12:00:00.000Z");
    const client = buildClient({
      seo_pages: { rows: [] },
      news_posts: { rows: [] },
      // One lead per close_sync_status — the same column and status set
      // AdminLeadsManager.tsx uses for its failedSyncCount banner.
      lead_submissions: {
        rows: [
          { id: "l1", close_sync_status: "failed" },
          { id: "l2", close_sync_status: "needs_review" },
          { id: "l3", close_sync_status: "dead_letter" },
          { id: "l4", close_sync_status: "retrying" },
          { id: "l5", close_sync_status: "pending" },
          { id: "l6", close_sync_status: "synced" },
          { id: "l7", close_sync_status: null },
        ],
      },
      // Decoy: more failed event rows than stuck leads. If the service ever
      // counted close_sync_events again, this test would see 5, not 3.
      close_sync_events: {
        rows: [
          { id: "e1", status: "failed", lead_submission_id: "l1" },
          { id: "e2", status: "failed", lead_submission_id: "l1" },
          { id: "e3", status: "needs_review", lead_submission_id: "l2" },
          { id: "e4", status: "dead_letter", lead_submission_id: "l3" },
          { id: "e5", status: "failed", lead_submission_id: "l4" },
        ],
      },
    });

    const overview = await getAdminOverview({ client, now });

    expect(overview.failedSyncs).toBe(3);
  });

  it("counts scheduled-publish pending and failed pages separately", async () => {
    const now = () => new Date("2026-07-06T12:00:00.000Z");
    const client = buildClient({
      seo_pages: {
        rows: [
          {
            id: "p1",
            status: "published",
            scheduled_publish_status: "scheduled",
          },
          {
            id: "p2",
            status: "published",
            scheduled_publish_status: "scheduled",
          },
          { id: "p3", status: "published", scheduled_publish_status: "failed" },
          { id: "p4", status: "draft", scheduled_publish_status: "published" },
        ],
      },
      news_posts: { rows: [] },
      lead_submissions: { rows: [] },
      close_sync_events: { rows: [] },
    });

    const overview = await getAdminOverview({ client, now });

    expect(overview.scheduledPublishPending).toBe(2);
    expect(overview.scheduledPublishFailed).toBe(1);
  });
});
