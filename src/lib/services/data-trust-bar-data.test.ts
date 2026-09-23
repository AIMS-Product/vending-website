import { describe, expect, it } from "vitest";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";

const NOW = new Date("2026-09-22T18:00:00Z");

/** A chainable query that resolves to `result` whatever is chained on it. */
function query(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "in", "order", "limit", "eq"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

describe("getTrustBar", () => {
  it("reads runs and live tables into one bar", async () => {
    const recent = new Date(NOW.getTime() - 3_600_000).toISOString();
    const client = {
      from: (table: string) => {
        if (table === "channel_sync_runs") {
          return query({
            data: [
              {
                connector: "close-lead-funnel",
                started_at: recent,
                finished_at: recent,
                rows_written: 10,
                error: null,
              },
            ],
            error: null,
          });
        }
        if (table === "calendly_bookings") {
          return query({ data: [{ created_at: recent }], error: null });
        }
        if (table === "data_audit_runs") {
          return query({ data: [], error: null });
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const bar = await getTrustBar("booked", {
      client: client as never,
      now: NOW,
    });
    expect(bar.freshnessTone).toBe("ok");
    expect(bar.asOf).toBe(recent);
    // No stored audit run: red, never silently fine.
    expect(bar.audit.tone).toBe("bad");
  });

  it("renders red, not green, when the reads fail outright", async () => {
    const client = {
      from: () => {
        throw new Error("connection refused");
      },
    };
    const bar = await getTrustBar("mom", { client: client as never, now: NOW });
    expect(bar.freshnessTone).toBe("bad");
    expect(bar.audit.tone).toBe("bad");
    expect(bar.audit.error).toBe("connection refused");
  });

  it("reports a failed runs read on every run feed", async () => {
    const client = {
      from: (table: string) =>
        table === "channel_sync_runs"
          ? query({ data: null, error: { message: "denied" } })
          : query({ data: [], error: null }),
    };
    const bar = await getTrustBar("close", {
      client: client as never,
      now: NOW,
    });
    expect(bar.problems[0].problem).toContain("denied");
  });

  it("marks ManyChat not connected when manychat_events has no row", async () => {
    const testRun = new Date(NOW.getTime() - 300 * 3_600_000).toISOString();
    const events: unknown[] = [];
    const client = {
      from: (table: string) => {
        if (table === "channel_sync_runs") {
          return query({
            data: [
              {
                connector: "manychat-ingest",
                started_at: testRun,
                finished_at: testRun,
                rows_written: 2,
                error: null,
              },
            ],
            error: null,
          });
        }
        if (table === "manychat_events") {
          return query({ data: events, error: null });
        }
        return query({ data: [], error: null });
      },
    };
    const empty = await getTrustBar("channels", {
      client: client as never,
      now: NOW,
    });
    expect(empty.notConnected.map((v) => v.feed)).toContain("manychat");
    expect(empty.problems.map((v) => v.feed)).not.toContain("manychat");

    events.push({ day: "2026-09-11" });
    const filled = await getTrustBar("channels", {
      client: client as never,
      now: NOW,
    });
    expect(filled.notConnected.map((v) => v.feed)).not.toContain("manychat");
    expect(filled.problems.find((v) => v.feed === "manychat")?.problem).toBe(
      "last updated 13 days ago",
    );
  });
});
