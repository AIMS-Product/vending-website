import { describe, expect, it } from "vitest";
import {
  buildAttributionOverview,
  envVarForField,
} from "./attribution-overview";
import {
  closeConfigFromEnv,
  type CloseClient,
  type CloseCustomFieldDefinition,
} from "@/lib/close/client";

const ENTRY_SOURCE_ID = "cf_entry_source";

function fakeClose(
  fields: Partial<Record<"lead" | "contact", CloseCustomFieldDefinition[]>>,
): CloseClient {
  return {
    listCustomFields: async (scope: "lead" | "contact") => ({
      data: fields[scope] ?? [],
    }),
  } as unknown as CloseClient;
}

function entrySourceField(choices: string[]): CloseCustomFieldDefinition {
  return {
    id: ENTRY_SOURCE_ID,
    name: "Entry Source",
    type: "choices",
    choices,
  };
}

const BASE_ENV = {
  CLOSE_API_KEY: "close_key_123",
  CLOSE_LEAD_STATUS_ID: "stat_new",
  CLOSE_ENTRY_SOURCE_FIELD_ID: ENTRY_SOURCE_ID,
};

async function overviewWith(env: Record<string, string>, client: CloseClient) {
  return buildAttributionOverview({
    closeConfig: closeConfigFromEnv(env),
    client,
    environment: "test",
  });
}

function fieldRow(
  overview: Awaited<ReturnType<typeof buildAttributionOverview>>,
  key: string,
) {
  return overview.fields.find((row) => row.key === key);
}

describe("envVarForField", () => {
  it("derives the env var name from the config key", () => {
    // Derived rather than hand-listed, so a new field cannot be shown under a
    // variable name that does not exist.
    expect(envVarForField("entrySourceFieldId")).toBe(
      "CLOSE_ENTRY_SOURCE_FIELD_ID",
    );
    expect(envVarForField("utmSourceFieldId")).toBe(
      "CLOSE_UTM_SOURCE_FIELD_ID",
    );
    expect(envVarForField("sourceCtaTrackingNameFieldId")).toBe(
      "CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID",
    );
  });
});

describe("buildAttributionOverview", () => {
  it("reports a configured field that Close accepts as live", async () => {
    const overview = await overviewWith(
      BASE_ENV,
      fakeClose({
        lead: [entrySourceField(["Lead-Magnet", "Website-Apply"])],
      }),
    );

    expect(fieldRow(overview, "entrySourceFieldId")).toMatchObject({
      status: "live",
      closeFieldName: "Entry Source",
      issue: null,
    });
    expect(overview.entryPoints.every((entry) => entry.status === "live")).toBe(
      true,
    );
  });

  // The exact situation this page was built to catch.
  it("blocks only the entry points whose choice is missing from Close", async () => {
    const overview = await overviewWith(
      BASE_ENV,
      fakeClose({ lead: [entrySourceField(["Lead-Magnet"])] }),
    );

    expect(fieldRow(overview, "entrySourceFieldId")).toMatchObject({
      status: "value_rejected",
    });

    const apply = overview.entryPoints.find((entry) =>
      entry.name.includes("Apply"),
    );
    const magnet = overview.entryPoints.find((entry) =>
      entry.name.includes("magnet"),
    );
    expect(apply).toMatchObject({ status: "blocked" });
    expect(apply?.issue).toContain("Website-Apply");
    // The magnet path still works — it sends "Lead-Magnet", which does exist.
    // Reporting it as blocked would be a false alarm on a healthy channel.
    expect(magnet).toMatchObject({ status: "live", issue: null });
  });

  it("flags a field whose ID is scoped to the other Close object", async () => {
    // Source path is contact-scoped; putting it on the lead makes Close 400.
    const overview = await overviewWith(
      { ...BASE_ENV, CLOSE_SOURCE_PATH_FIELD_ID: "cf_source_path" },
      fakeClose({
        lead: [
          entrySourceField(["Lead-Magnet", "Website-Apply"]),
          { id: "cf_source_path", name: "Application Source", type: "text" },
        ],
        contact: [],
      }),
    );

    expect(fieldRow(overview, "sourcePathFieldId")).toMatchObject({
      status: "wrong_object",
    });
    expect(fieldRow(overview, "sourcePathFieldId")?.issue).toContain(
      "rejects the whole update",
    );
  });

  it("flags a field ID that no longer exists in Close", async () => {
    const overview = await overviewWith(
      { ...BASE_ENV, CLOSE_SOURCE_PATH_FIELD_ID: "cf_deleted" },
      fakeClose({ lead: [entrySourceField(["Lead-Magnet", "Website-Apply"])] }),
    );

    expect(fieldRow(overview, "sourcePathFieldId")).toMatchObject({
      status: "missing_in_close",
    });
  });

  it("marks unset fields as not configured rather than broken", async () => {
    const overview = await overviewWith(
      BASE_ENV,
      fakeClose({ lead: [entrySourceField(["Lead-Magnet", "Website-Apply"])] }),
    );

    const utm = fieldRow(overview, "utmSourceFieldId");
    expect(utm).toMatchObject({ status: "not_configured" });
    expect(utm?.issue).toContain("CLOSE_UTM_SOURCE_FIELD_ID");
    expect(overview.counts.notConfigured).toBeGreaterThan(0);
  });

  it("degrades to unverified instead of claiming health when Close is unreachable", async () => {
    const failing = {
      listCustomFields: async () => {
        throw new Error("Close is down");
      },
    } as unknown as CloseClient;

    const overview = await overviewWith(BASE_ENV, failing);

    expect(overview.probeError).toContain("Close is down");
    expect(fieldRow(overview, "entrySourceFieldId")).toMatchObject({
      status: "unverified",
    });
    expect(overview.counts.live).toBe(0);
  });

  it("reports the empty lead status that leaves new leads on Close's default", async () => {
    const overview = await overviewWith(
      { ...BASE_ENV, CLOSE_LEAD_STATUS_ID: "" },
      fakeClose({ lead: [entrySourceField(["Lead-Magnet", "Website-Apply"])] }),
    );

    expect(overview.leadStatus.configured).toBe(false);
    expect(overview.leadStatus.issue).toContain("default status");
  });

  // Drift guard: a new field added to the Close config must appear on this page
  // rather than silently going unmonitored.
  it("covers every field the Close client can send", async () => {
    const overview = await overviewWith(BASE_ENV, fakeClose({}));
    const configKeys = Object.keys(
      closeConfigFromEnv(BASE_ENV).customFields,
    ).sort();

    expect(overview.fields.map((row) => row.key).sort()).toEqual(configKeys);
  });
});
