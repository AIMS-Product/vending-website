import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ingestManychatEvent, ManychatIngestError } from "./manychat-ingest";

function buildClient(upsertError: unknown = null) {
  const events: Array<Record<string, unknown>> = [];
  const spine: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    if (table === "manychat_events") {
      return {
        upsert: vi.fn(async (row: Record<string, unknown>) => {
          if (!upsertError) events.push(row);
          return { error: upsertError };
        }),
        select: vi.fn(() => ({
          eq: vi.fn(async (_column: string, day: string) => ({
            data: events
              .filter((row) => row.day === day)
              .map((row) => ({
                event: row.event,
                subscriber_id: row.subscriber_id,
              })),
            error: null,
          })),
        })),
      };
    }
    if (table === "channel_daily") {
      return {
        upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
          spine.push(...rows);
          return { error: null };
        }),
      };
    }
    if (table === "channel_sync_runs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          runs.push(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    events,
    spine,
    runs,
  };
}

const NOW = new Date("2026-09-11T22:10:00.000Z");

const subscriber = {
  ig_username: "vendingmike",
  email: "mike@example.com",
  phone: "+15555550100",
  subscribed: "2026-09-01T10:00:00-07:00",
  tags: ["🔥New Lead", "Pearl Booking link sent"],
};

describe("ingestManychatEvent", () => {
  it("stores the enriched event and rewrites the day's Instagram DM row", async () => {
    const { client, events, spine, runs } = buildClient();

    const result = await ingestManychatEvent(
      { subscriber_id: 123456, event: "booking_link_sent" },
      { client, now: NOW, fetchSubscriber: async () => subscriber },
    );

    expect(result).toEqual({
      day: "2026-09-11",
      event: "booking_link_sent",
      enriched: true,
    });
    expect(events[0]).toMatchObject({
      subscriber_id: "123456",
      event: "booking_link_sent",
      day: "2026-09-11",
      ig_username: "vendingmike",
      email: "mike@example.com",
      tags: subscriber.tags,
      enriched: true,
    });
    expect(spine.at(-1)).toMatchObject({
      day: "2026-09-11",
      channel: "Instagram DM",
      source: "manychat",
      medium: "chat",
      destination: "book-call",
      leads: 0,
      clicks: 1,
      booked: 0,
      won: 0,
    });
    expect(runs[0]).toMatchObject({
      connector: "manychat-ingest",
      error: null,
    });
  });

  it("counts a contact once per stage per day and keeps stages apart", async () => {
    const { client, spine } = buildClient();
    const deps = { client, now: NOW, fetchSubscriber: async () => null };
    await ingestManychatEvent({ subscriber_id: "1", event: "new_lead" }, deps);
    await ingestManychatEvent({ subscriber_id: "1", event: "new_lead" }, deps);
    await ingestManychatEvent({ subscriber_id: "2", event: "new_lead" }, deps);
    await ingestManychatEvent(
      { subscriber_id: "2", event: "call_booked" },
      deps,
    );
    expect(spine.at(-1)).toMatchObject({ leads: 2, booked: 1, clicks: 0 });
  });

  it("still counts the event when enrichment fails, marked unenriched", async () => {
    const { client, events } = buildClient();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ingestManychatEvent(
      { subscriber_id: "9", event: "call_booked", email: "x@example.com" },
      {
        client,
        now: NOW,
        fetchSubscriber: async () => {
          throw new Error("429");
        },
      },
    );
    expect(events[0]).toMatchObject({
      enriched: false,
      email: "x@example.com",
      tags: [],
    });
  });

  it("uses occurred_at for the day when the flow sends it", async () => {
    const { client, events } = buildClient();
    await ingestManychatEvent(
      {
        subscriber_id: "9",
        event: "closed",
        occurred_at: "2026-09-03T18:00:00-07:00",
      },
      { client, now: NOW, fetchSubscriber: async () => null },
    );
    expect(events[0]).toMatchObject({ day: "2026-09-04" });
  });

  it("rejects an unknown stage and records the rejection", async () => {
    const { client, events, runs } = buildClient();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ingestManychatEvent(
        { subscriber_id: "1", event: "vibes" },
        { client, now: NOW, fetchSubscriber: async () => null },
      ),
    ).rejects.toThrow(ManychatIngestError);
    expect(events).toHaveLength(0);
    expect(String(runs[0].error)).toMatch(/event/);
  });

  it("surfaces a database failure as a 500 and a red run", async () => {
    const { client, runs } = buildClient({ message: "relation missing" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ingestManychatEvent(
        { subscriber_id: "1", event: "new_lead" },
        { client, now: NOW, fetchSubscriber: async () => null },
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(String(runs[0].error)).toMatch(/manychat_events upsert failed/);
  });
});
