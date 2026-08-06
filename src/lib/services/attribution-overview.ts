import "server-only";

import {
  CLOSE_RESOURCE_TAGS,
  CLOSE_TAGGING_VALUES,
  closeConfigFromEnv,
  createCloseClient,
  type CloseClient,
  type CloseConfig,
  type CloseCustomFieldConfig,
  type CloseCustomFieldDefinition,
} from "@/lib/close/client";
import { config } from "@/lib/config";
import { LEAD_MAGNET_FORM_ID } from "@/lib/content/lead-magnets";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";

/**
 * Read-only health report for everything that carries attribution into Close.
 *
 * The point is to answer, per channel, the five questions that are otherwise
 * only answerable by reading three files and the Vercel dashboard:
 *
 *   1. is it configured at all (is the env var set in THIS environment)
 *   2. does it have a Close field to route to (does the ID still exist)
 *   3. is that field reachable the way we write it (lead vs contact scope)
 *   4. would the value we send actually be accepted (choice validation)
 *   5. is it live (did the probe reach Close just now)
 *
 * Nothing here writes. The Close calls are GETs against the schema endpoints.
 */

/** Close rejects a write to a field scoped to the other object with a 400. */
const CONTACT_SCOPED_FIELDS = new Set<keyof CloseCustomFieldConfig>([
  // Sent by closeContactAttributionPayload via updateContact.
  "sourcePathFieldId",
  "utmSourceFieldId",
  "utmMediumFieldId",
  "utmCampaignFieldId",
  "utmTermFieldId",
  "utmContentFieldId",
  // Sent by qualificationContactCustomFields via updateContact.
  "stateMarketFieldId",
  "businessStageFieldId",
  "budgetRangeFieldId",
  "availableCapitalFieldId",
  "purchaseTimelineFieldId",
  "locationStatusFieldId",
  "machineGoalFieldId",
  "primaryGoalFieldId",
  "consentStatusFieldId",
  "contactPreferenceFieldId",
]);

/**
 * Fixed values we send to `choices` fields, by config key. Anything not listed
 * carries free-form data, so there is no choice list to validate against.
 */
const WRITTEN_CHOICE_VALUES: Partial<
  Record<keyof CloseCustomFieldConfig, string[]>
> = {
  entrySourceFieldId: [
    CLOSE_TAGGING_VALUES.entrySourceLeadMagnet,
    CLOSE_TAGGING_VALUES.entrySourceWebsiteApply,
  ],
};

export type AttributionFieldStatus =
  | "live"
  | "not_configured"
  | "missing_in_close"
  | "wrong_object"
  | "value_rejected"
  | "unverified";

export type AttributionFieldRow = {
  key: keyof CloseCustomFieldConfig;
  label: string;
  envVar: string;
  scope: "lead" | "contact";
  fieldId?: string;
  closeFieldName?: string;
  closeFieldType?: string;
  status: AttributionFieldStatus;
  /** Plain-English next action, or null when the row is healthy. */
  issue: string | null;
};

export type AttributionEntryPointRow = {
  name: string;
  formId: string;
  routes: string[];
  entrySource: string;
  resourceTag: string;
  status: "live" | "blocked" | "not_configured";
  issue: string | null;
};

export type AttributionOverview = {
  environment: string;
  closeConnected: boolean;
  /** Set when the Close probe itself failed — every row falls back to unverified. */
  probeError: string | null;
  leadStatus: {
    configured: boolean;
    statusId?: string;
    issue: string | null;
  };
  entryPoints: AttributionEntryPointRow[];
  fields: AttributionFieldRow[];
  counts: Record<"live" | "attention" | "notConfigured", number>;
};

/** `entrySourceFieldId` → `CLOSE_ENTRY_SOURCE_FIELD_ID`. */
export function envVarForField(key: string) {
  return `CLOSE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
}

/** `entrySourceFieldId` → `Entry source`. */
function labelForField(key: string) {
  const words = key
    .replace(/FieldId$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ENTRY_POINTS: Array<
  Omit<AttributionEntryPointRow, "status" | "issue"> & {
    /** Which choice this entry point sends, so we can check it is accepted. */
    entrySourceValue: string;
  }
> = [
  {
    name: "Entrepreneur lead magnet",
    formId: LEAD_MAGNET_FORM_ID,
    routes: ["/resources/roadmap", "/resources/finance-templates"],
    entrySource: CLOSE_TAGGING_VALUES.entrySourceLeadMagnet,
    entrySourceValue: CLOSE_TAGGING_VALUES.entrySourceLeadMagnet,
    resourceTag: `${CLOSE_RESOURCE_TAGS.roadmap} · ${CLOSE_RESOURCE_TAGS.financeTemplates}`,
  },
  {
    name: "Newsletter signup",
    formId: NEWSLETTER_FORM_ID,
    routes: ["/newsletter"],
    entrySource: CLOSE_TAGGING_VALUES.entrySourceLeadMagnet,
    entrySourceValue: CLOSE_TAGGING_VALUES.entrySourceLeadMagnet,
    resourceTag: "newsletter",
  },
  {
    name: "Apply / qualification (books a call)",
    formId: "a1b2c3d4-0000-4000-8000-000000000001",
    // The apply funnel lives at /contact; /apply is only a 301 into it.
    routes: ["/contact", "/vp-quiz", "Builder pages using the default form"],
    entrySource: CLOSE_TAGGING_VALUES.entrySourceWebsiteApply,
    entrySourceValue: CLOSE_TAGGING_VALUES.entrySourceWebsiteApply,
    resourceTag: CLOSE_RESOURCE_TAGS.websiteApplication,
  },
];

export async function buildAttributionOverview(deps?: {
  closeConfig?: CloseConfig;
  client?: CloseClient;
  environment?: string;
}): Promise<AttributionOverview> {
  const closeConfig = deps?.closeConfig ?? closeConfigFromEnv(config);
  const environment =
    deps?.environment ?? process.env.VERCEL_ENV ?? "development";

  const probe = await probeCloseSchema(closeConfig, deps?.client);
  const fields = buildFieldRows(closeConfig, probe);

  return {
    environment,
    closeConnected: closeConfig.enabled,
    probeError: probe.error,
    leadStatus: leadStatusRow(closeConfig),
    entryPoints: buildEntryPointRows(fields, probe),
    fields,
    counts: {
      live: fields.filter((row) => row.status === "live").length,
      attention: fields.filter((row) =>
        ["missing_in_close", "wrong_object", "value_rejected"].includes(
          row.status,
        ),
      ).length,
      notConfigured: fields.filter((row) => row.status === "not_configured")
        .length,
    },
  };
}

type SchemaProbe = {
  /** field id → definition, per object type. Empty when the probe failed. */
  lead: Map<string, CloseCustomFieldDefinition>;
  contact: Map<string, CloseCustomFieldDefinition>;
  error: string | null;
};

async function probeCloseSchema(
  closeConfig: CloseConfig,
  injected?: CloseClient,
): Promise<SchemaProbe> {
  const empty = { lead: new Map(), contact: new Map() };
  if (!closeConfig.enabled && !injected) {
    return { ...empty, error: "Close API key is not configured." };
  }

  try {
    const client =
      injected ??
      createCloseClient({
        apiKey: closeConfig.apiKey,
        baseUrl: closeConfig.baseUrl,
      });
    const [lead, contact] = await Promise.all([
      client.listCustomFields("lead"),
      client.listCustomFields("contact"),
    ]);
    return {
      lead: indexById(lead.data ?? []),
      contact: indexById(contact.data ?? []),
      error: null,
    };
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function indexById(definitions: CloseCustomFieldDefinition[]) {
  // Close returns bare ids here but takes `cf_`-prefixed ids on write, so index
  // both spellings rather than making every lookup guess which one it holds.
  const index = new Map<string, CloseCustomFieldDefinition>();
  for (const definition of definitions) {
    index.set(definition.id, definition);
    index.set(
      definition.id.startsWith("cf_")
        ? definition.id.slice(3)
        : `cf_${definition.id}`,
      definition,
    );
  }
  return index;
}

function buildFieldRows(
  closeConfig: CloseConfig,
  probe: SchemaProbe,
): AttributionFieldRow[] {
  return Object.keys(closeConfig.customFields)
    .sort()
    .map((rawKey) => {
      const key = rawKey as keyof CloseCustomFieldConfig;
      const fieldId = closeConfig.customFields[key];
      const scope = CONTACT_SCOPED_FIELDS.has(key) ? "contact" : "lead";
      const base = {
        key,
        label: labelForField(key),
        envVar: envVarForField(key),
        scope,
        fieldId,
      } as const;

      if (!fieldId) {
        return {
          ...base,
          status: "not_configured" as const,
          issue: `Set ${envVarForField(key)} to start sending this field.`,
        };
      }
      if (probe.error) {
        return {
          ...base,
          status: "unverified" as const,
          issue: "Could not reach Close to verify this field.",
        };
      }

      const onScope = probe[scope].get(fieldId);
      const onOther = probe[scope === "lead" ? "contact" : "lead"].get(fieldId);

      if (!onScope && onOther) {
        return {
          ...base,
          closeFieldName: onOther.name,
          closeFieldType: onOther.type,
          status: "wrong_object" as const,
          issue: `This ID is a ${scope === "lead" ? "contact" : "lead"} field in Close but the site writes it to the ${scope}. Close rejects the whole update.`,
        };
      }
      if (!onScope) {
        return {
          ...base,
          status: "missing_in_close" as const,
          issue: `No ${scope} field with this ID exists in Close. It was probably deleted or the ID is a typo.`,
        };
      }

      const rejected = rejectedChoices(key, onScope);
      if (rejected.length) {
        return {
          ...base,
          closeFieldName: onScope.name,
          closeFieldType: onScope.type,
          status: "value_rejected" as const,
          issue: `Close has no choice ${rejected.map((value) => `"${value}"`).join(", ")} on "${onScope.name}". Add it in Close or those submissions will fail.`,
        };
      }

      return {
        ...base,
        closeFieldName: onScope.name,
        closeFieldType: onScope.type,
        status: "live" as const,
        issue: null,
      };
    });
}

function rejectedChoices(
  key: keyof CloseCustomFieldConfig,
  definition: CloseCustomFieldDefinition,
) {
  const written = WRITTEN_CHOICE_VALUES[key];
  if (!written || definition.type !== "choices") return [];
  const available = new Set(definition.choices ?? []);
  return written.filter((value) => !available.has(value));
}

function buildEntryPointRows(
  fields: AttributionFieldRow[],
  probe: SchemaProbe,
): AttributionEntryPointRow[] {
  const entrySource = fields.find((row) => row.key === "entrySourceFieldId");

  return ENTRY_POINTS.map((entry) => {
    if (!entrySource || entrySource.status === "not_configured") {
      return {
        ...stripInternals(entry),
        status: "not_configured" as const,
        issue:
          "Entry Source is not wired up yet, so these leads reach Close untagged.",
      };
    }

    // A choice missing on the field only blocks the entry points that send it.
    const definition = probe.lead.get(entrySource.fieldId ?? "");
    const sendsMissingChoice =
      definition?.type === "choices" &&
      !(definition.choices ?? []).includes(entry.entrySourceValue);

    if (sendsMissingChoice) {
      return {
        ...stripInternals(entry),
        status: "blocked" as const,
        issue: `Close has no "${entry.entrySourceValue}" choice on Entry Source, so these submissions will be rejected.`,
      };
    }

    // A field-level problem only blocks this entry point when it affects every
    // value. `value_rejected` does not: it is raised when ANY value we can send
    // is missing, and the check above already caught it if that value is ours.
    // Blocking here anyway would report a working channel as broken.
    if (
      entrySource.status !== "live" &&
      entrySource.status !== "value_rejected"
    ) {
      return {
        ...stripInternals(entry),
        status: "blocked" as const,
        issue: entrySource.issue,
      };
    }
    return { ...stripInternals(entry), status: "live" as const, issue: null };
  });
}

function stripInternals(
  entry: (typeof ENTRY_POINTS)[number],
): Omit<AttributionEntryPointRow, "status" | "issue"> {
  return {
    name: entry.name,
    formId: entry.formId,
    routes: entry.routes,
    entrySource: entry.entrySource,
    resourceTag: entry.resourceTag,
  };
}

function leadStatusRow(closeConfig: CloseConfig) {
  if (!closeConfig.leadStatusId) {
    return {
      configured: false,
      issue:
        "CLOSE_LEAD_STATUS_ID is empty, so new leads land on the Close default status instead of New.",
    };
  }
  return {
    configured: true,
    statusId: closeConfig.leadStatusId,
    issue: null,
  };
}
