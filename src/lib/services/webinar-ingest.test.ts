import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ingestWebinarSnapshot, WebinarIngestError } from "./webinar-ingest";

function buildClient(webinarError: unknown = null) {
  const webinars: Array<Record<string, unknown>> = [];
  const spine: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  let webinarOptions: unknown;
  const from = vi.fn((table: string) => {
    if (table === "webinar_events") {
      return {
        upsert: vi.fn(
          async (rows: Array<Record<string, unknown>>, options: unknown) => {
            webinars.push(...rows);
            webinarOptions = options;
            return { error: webinarError };
          },
        ),
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
    webinars,
    spine,
    runs,
    options: () => webinarOptions,
  };
}

const NOW = new Date("2026-09-11T17:45:00.000Z");

/** Mirrors the sample in the vp-webinars contract (Sept 1). */
const payload = {
  version: 1,
  sentAt: "2026-09-11T17:41:00Z",
  pulledAt: {
    meta: "2026-09-11T17:00:00Z",
    zoom: "",
    ghl: "",
    close: "",
    booked: "",
    sheet: "",
  },
  webinars: [
    {
      date: "2026-09-01",
      label: "Sept 1",
      format: "Live",
      spend: 10155,
      registrations: 812,
      registrationsAdAttributed: 737,
      attendees: 152,
      peakAttendees: 110,
      attendeesAtOffer: null,
      bookedWithin7d: 24,
      bookedNightOf: 20,
      showed: 18,
      won: 1,
      revenue: null,
      pitchStartMin: 55,
      lengthMin: 88,
      notes: null,
      bookingMaturing: false,
      revenueMaturing: true,
    },
  ],
  audiences: [
    {
      day: "2026-09-01",
      channel: "webinar",
      source: "meta_ads",
      medium: "paid",
      campaign: "webinar-2026-09-01",
      content: "warm",
      destination: "webinar-register",
      spend: 1636,
      leads: 263,
      booked: 9,
      showed: null,
      won: null,
    },
    {
      day: "2026-09-01",
      channel: "webinar",
      source: "unattributed",
      medium: "organic",
      campaign: "webinar-2026-09-01",
      content: "unattributed",
      destination: "webinar-register",
      spend: 0,
      leads: 75,
      booked: 4,
      showed: null,
      won: null,
    },
  ],
};

describe("ingestWebinarSnapshot", () => {
  it("upserts webinars by date and audiences onto the spine, and records the run", async () => {
    const { client, webinars, spine, runs, options } = buildClient();

    const result = await ingestWebinarSnapshot(payload, { client, now: NOW });

    expect(result).toEqual({ webinarsWritten: 1, audiencesWritten: 2 });
    expect(options()).toEqual({ onConflict: "date" });
    expect(webinars[0]).toMatchObject({
      date: "2026-09-01",
      spend: 10155,
      attendees_at_offer: null,
      revenue: null,
      booking_maturing: false,
      revenue_maturing: true,
      received_at: NOW.toISOString(),
    });
    expect(spine[0]).toMatchObject({
      day: "2026-09-01",
      channel: "Webinar",
      source: "meta_ads",
      medium: "paid",
      campaign: "webinar-2026-09-01",
      content: "warm",
      destination: "webinar-register",
      leads: 263,
      // Calendly owns booked on the spine. The sheet's count reaches the spine
      // through the webinar's tagged Calendly links already, so taking it here
      // too counted every webinar booking twice. Explicit null, not omitted,
      // so the sender's next full-history send clears the doubled rows.
      booked: null,
      showed: null,
    });
    // Spend lives on webinar_events; metricool-ads owns it on the spine.
    expect(spine[0]).not.toHaveProperty("spend");
    expect(spine[1]).toMatchObject({
      channel: "Webinar",
      source: "unattributed",
    });
    expect(runs[0]).toMatchObject({
      connector: "webinar-ingest",
      rows_written: 3,
      error: null,
    });
  });

  it("rejects an unknown version and records the rejection", async () => {
    const { client, webinars, runs } = buildClient();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      ingestWebinarSnapshot({ ...payload, version: 2 }, { client, now: NOW }),
    ).rejects.toThrow(WebinarIngestError);
    expect(webinars).toHaveLength(0);
    expect(runs[0]).toMatchObject({
      connector: "webinar-ingest",
      rows_written: 0,
    });
    expect(String(runs[0].error)).toMatch(/version/);
    consoleError.mockRestore();
  });

  it("refuses a negative or non-integer count rather than storing it", async () => {
    const { client } = buildClient();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = {
      ...payload,
      audiences: [{ ...payload.audiences[0], leads: -1 }],
    };
    await expect(
      ingestWebinarSnapshot(bad, { client, now: NOW }),
    ).rejects.toThrow(/audiences\.0\.leads/);
  });

  it("surfaces a database failure as a 500 and a red run", async () => {
    const { client, runs } = buildClient({ message: "relation missing" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      ingestWebinarSnapshot(payload, { client, now: NOW }),
    ).rejects.toMatchObject({ status: 500 });
    expect(runs[0]).toMatchObject({ rows_written: 0 });
    expect(String(runs[0].error)).toMatch(/webinar_events upsert failed/);
  });
});
