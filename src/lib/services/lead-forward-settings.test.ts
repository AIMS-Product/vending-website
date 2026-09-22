import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminUpdateLeadForwardSettings,
  getLeadForwardCaptureCounts,
  getLeadForwardSettings,
  LeadForwardSettingsError,
  type LeadForwardSettingsInput,
} from "./lead-forward-settings";

type Row = Record<string, unknown>;

function settingsClient(
  row: Row | null,
  { error = false }: { error?: boolean } = {},
) {
  const upserts: Row[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: error ? null : row,
            error: error ? { message: "relation does not exist" } : null,
          }),
        }),
        gte: async () => ({ data: [], error: null }),
      }),
      upsert: async (value: Row) => {
        upserts.push(value);
        return { error: null };
      },
    }),
  } as never;
  return { client, upserts };
}

const validInput: LeadForwardSettingsInput = {
  enabled: true,
  webhookUrl: "https://services.leadconnectorhq.com/hooks/abc",
  captureTypes: ["booking", "application"],
  trafficSourceMode: "all",
  trafficSources: [],
  fieldIds: { utm_source: "cf_1" },
};

afterEach(() => {
  delete process.env.WESCALE_GHL_TOKEN;
  delete process.env.WESCALE_GHL_LOCATION_ID;
});

describe("getLeadForwardSettings", () => {
  it("reads a configured row", async () => {
    const { client } = settingsClient({
      enabled: true,
      webhook_url: "https://hooks.example.com/abc",
      capture_types: ["booking", "chat", "not_a_type"],
      traffic_source_mode: "allowlist",
      traffic_sources: ["google"],
      field_ids: { utm_source: "cf_1" },
      updated_at: "2026-09-22T17:00:00.000Z",
      updated_by: "adam@modern-amenities.com",
    });

    const settings = await getLeadForwardSettings(client);

    expect(settings.enabled).toBe(true);
    // A value the app does not understand is dropped, not forwarded blindly.
    expect(settings.captureTypes).toEqual(["booking", "chat"]);
    expect(settings.trafficSourceMode).toBe("allowlist");
  });

  it("treats a missing table or row as switched off", async () => {
    const missingTable = settingsClient(null, { error: true });
    await expect(
      getLeadForwardSettings(missingTable.client),
    ).resolves.toMatchObject({ enabled: false });

    const noRow = settingsClient(null);
    await expect(getLeadForwardSettings(noRow.client)).resolves.toMatchObject({
      enabled: false,
    });
  });
});

describe("adminUpdateLeadForwardSettings", () => {
  it("saves a valid configuration", async () => {
    const { client, upserts } = settingsClient(null);
    await adminUpdateLeadForwardSettings(validInput, {
      client,
      updatedBy: "adam@modern-amenities.com",
      now: () => new Date("2026-09-22T17:00:00.000Z"),
    });

    expect(upserts[0]).toMatchObject({
      id: "wescale",
      enabled: true,
      webhook_url: "https://services.leadconnectorhq.com/hooks/abc",
      capture_types: ["booking", "application"],
      updated_by: "adam@modern-amenities.com",
    });
  });

  it("refuses a non-https or internal webhook URL", async () => {
    const { client, upserts } = settingsClient(null);
    for (const webhookUrl of [
      "http://hooks.example.com/abc",
      "https://127.0.0.1/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/abc",
      "not a url",
    ]) {
      await expect(
        adminUpdateLeadForwardSettings(
          { ...validInput, webhookUrl },
          { client, updatedBy: "adam@modern-amenities.com" },
        ),
      ).rejects.toBeInstanceOf(LeadForwardSettingsError);
    }
    expect(upserts).toHaveLength(0);
  });

  it("refuses to switch on with nowhere to send", async () => {
    const { client, upserts } = settingsClient(null);
    await expect(
      adminUpdateLeadForwardSettings(
        { ...validInput, webhookUrl: null },
        { client, updatedBy: "adam@modern-amenities.com" },
      ),
    ).rejects.toThrow(/webhook URL/);
    expect(upserts).toHaveLength(0);
  });

  it("accepts no webhook when the API credentials are set", async () => {
    process.env.WESCALE_GHL_TOKEN = "pit-x";
    process.env.WESCALE_GHL_LOCATION_ID = "loc1";
    const { client, upserts } = settingsClient(null);

    await adminUpdateLeadForwardSettings(
      { ...validInput, webhookUrl: null },
      { client, updatedBy: "adam@modern-amenities.com" },
    );

    expect(upserts[0]).toMatchObject({ enabled: true, webhook_url: null });
  });

  it("refuses to switch on with nothing selected", async () => {
    const { client } = settingsClient(null);
    await expect(
      adminUpdateLeadForwardSettings(
        { ...validInput, captureTypes: [] },
        { client, updatedBy: "adam@modern-amenities.com" },
      ),
    ).rejects.toThrow(/capture type/);

    await expect(
      adminUpdateLeadForwardSettings(
        {
          ...validInput,
          trafficSourceMode: "allowlist",
          trafficSources: [],
        },
        { client, updatedBy: "adam@modern-amenities.com" },
      ),
    ).rejects.toThrow(/traffic source/);
  });

  it("allows switching off without a destination", async () => {
    const { client, upserts } = settingsClient(null);
    await adminUpdateLeadForwardSettings(
      { ...validInput, enabled: false, webhookUrl: null, captureTypes: [] },
      { client, updatedBy: "adam@modern-amenities.com" },
    );
    expect(upserts[0]).toMatchObject({ enabled: false });
  });
});

describe("getLeadForwardCaptureCounts", () => {
  it("labels each stored row the way the submit paths label it", async () => {
    const rows = [
      { form_type: "contact", utm_source: "youtube", metadata: {} },
      { form_type: "apply", utm_source: null, metadata: {} },
      {
        form_type: "contact",
        utm_source: "youtube",
        metadata: { source: "chatbot" },
      },
      {
        form_type: "contact",
        utm_source: null,
        metadata: {},
        latest_qualification_form_id: "2d3b9fbc-c270-4cd4-a970-97aeb95cd5ec",
      },
    ];
    const client = {
      from: () => ({
        select: () => ({ gte: async () => ({ data: rows, error: null }) }),
      }),
    } as never;

    const counts = await getLeadForwardCaptureCounts(client);

    expect(counts.total).toBe(4);
    const byType = Object.fromEntries(
      counts.captureTypes.map((row) => [row.type, row.count]),
    );
    expect(byType).toMatchObject({
      booking: 1,
      application: 1,
      chat: 1,
      lead_magnet: 1,
    });
    expect(counts.trafficSources).toEqual([
      { source: "youtube", count: 2 },
      { source: "(none)", count: 2 },
    ]);
  });

  it("reports nothing rather than throwing when the read fails", async () => {
    const client = {
      from: () => ({
        select: () => ({
          gte: async () => ({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as never;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(getLeadForwardCaptureCounts(client)).resolves.toMatchObject({
      total: 0,
    });
  });
});
