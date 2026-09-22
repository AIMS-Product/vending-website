import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHATBOT_LEAD_SOURCE } from "@/lib/chatbot/lead-capture";
import { LEAD_MAGNET_FORM_ID } from "@/lib/content/lead-magnets";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import {
  LEAD_CAPTURE_TYPES,
  NO_TRAFFIC_SOURCE,
  type LeadCaptureType,
} from "@/lib/ghl/forward";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Who we forward website captures to, and which captures they get.
 *
 * Edited at /admin/settings/lead-forwarding. One row, id `wescale` — the
 * paid-traffic agency working our leads in their own GoHighLevel. A second
 * destination would be a second row and a picker on that page; until one
 * exists there is no partner list to maintain.
 */

export const LEAD_FORWARD_DESTINATION_ID = "wescale";

type SettingsClient = Pick<SupabaseClient<Database>, "from">;

export type TrafficSourceMode = "all" | "allowlist";

export type LeadForwardSettings = {
  enabled: boolean;
  webhookUrl: string | null;
  captureTypes: LeadCaptureType[];
  trafficSourceMode: TrafficSourceMode;
  trafficSources: string[];
  fieldIds: Record<string, string>;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * What the feed does before anyone has configured it, and what it falls back
 * to if the table is missing: nothing is forwarded.
 */
export const DISABLED_LEAD_FORWARD_SETTINGS: LeadForwardSettings = {
  enabled: false,
  webhookUrl: null,
  captureTypes: ["booking", "application", "chat"],
  trafficSourceMode: "all",
  trafficSources: [],
  fieldIds: {},
  updatedAt: null,
  updatedBy: null,
};

export class LeadForwardSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadForwardSettingsError";
  }
}

const captureTypeSchema = z.enum(LEAD_CAPTURE_TYPES);

/**
 * A webhook URL is https-only and never points inside our own network.
 *
 * This value is fetched by the server on every forward, so an admin who typed
 * (or pasted) `http://169.254.169.254/...` would have us make that request for
 * them. Rejecting it at the edit is the cheap half of SSRF defence, and a
 * partner webhook is always a public https endpoint.
 */
const webhookUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "169.254.169.254" || host === "metadata.google.internal") {
      return false;
    }
    // Literal private and loopback ranges. A hostname that resolves into one
    // is not caught here; the partner URL is a known public host in practice.
    return !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/.test(
      host,
    );
  }, "Enter an https webhook URL on a public host.");

export const leadForwardSettingsInputSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.union([webhookUrlSchema, z.literal("")]).nullable(),
  captureTypes: z.array(captureTypeSchema),
  trafficSourceMode: z.enum(["all", "allowlist"]),
  trafficSources: z.array(z.string().trim().min(1).max(160)).max(200),
  fieldIds: z.record(z.string(), z.string().trim().max(120)),
});

export type LeadForwardSettingsInput = z.infer<
  typeof leadForwardSettingsInputSchema
>;

export async function getLeadForwardSettings(
  client?: SettingsClient,
): Promise<LeadForwardSettings> {
  const db = client ?? createAdminClient();
  const { data, error } = await db
    .from("lead_forward_settings")
    .select(
      "enabled,webhook_url,capture_types,traffic_source_mode,traffic_sources,field_ids,updated_at,updated_by",
    )
    .eq("id", LEAD_FORWARD_DESTINATION_ID)
    .maybeSingle();

  // A missing table or row means the feed was never set up. That is "off",
  // not an error to fail a lead submit with.
  if (error || !data) return DISABLED_LEAD_FORWARD_SETTINGS;

  return {
    enabled: data.enabled,
    webhookUrl: data.webhook_url,
    captureTypes: data.capture_types.filter((value): value is LeadCaptureType =>
      (LEAD_CAPTURE_TYPES as readonly string[]).includes(value),
    ),
    trafficSourceMode:
      data.traffic_source_mode === "allowlist" ? "allowlist" : "all",
    trafficSources: data.traffic_sources,
    fieldIds: asFieldIds(data.field_ids),
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

export async function adminUpdateLeadForwardSettings(
  input: LeadForwardSettingsInput,
  {
    client,
    updatedBy,
    now = () => new Date(),
  }: {
    client?: SettingsClient;
    updatedBy: string;
    now?: () => Date;
  },
): Promise<LeadForwardSettings> {
  const parsed = leadForwardSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new LeadForwardSettingsError(
      parsed.error.issues[0]?.message ?? "These settings are not valid.",
    );
  }
  const settings = parsed.data;
  const webhookUrl = settings.webhookUrl?.trim() ? settings.webhookUrl : null;

  // Turning the feed on with nowhere to send would queue forwards that can
  // only fail, so it is refused here rather than discovered in the drain.
  if (settings.enabled && !webhookUrl && !hasApiTransport()) {
    throw new LeadForwardSettingsError(
      "Add a webhook URL, or set the GHL token and location id, before turning forwarding on.",
    );
  }
  if (settings.enabled && settings.captureTypes.length === 0) {
    throw new LeadForwardSettingsError(
      "Choose at least one capture type to forward.",
    );
  }
  if (
    settings.enabled &&
    settings.trafficSourceMode === "allowlist" &&
    settings.trafficSources.length === 0
  ) {
    throw new LeadForwardSettingsError(
      "Choose at least one traffic source, or forward every source.",
    );
  }

  const db = client ?? createAdminClient();
  const { error } = await db.from("lead_forward_settings").upsert({
    id: LEAD_FORWARD_DESTINATION_ID,
    enabled: settings.enabled,
    webhook_url: webhookUrl,
    capture_types: settings.captureTypes,
    traffic_source_mode: settings.trafficSourceMode,
    traffic_sources: settings.trafficSources,
    field_ids: settings.fieldIds,
    updated_at: now().toISOString(),
    updated_by: updatedBy,
  });

  if (error) {
    throw new LeadForwardSettingsError("Could not save lead forwarding.");
  }

  return getLeadForwardSettings(db);
}

export type LeadForwardCaptureCounts = {
  captureTypes: Array<{ type: LeadCaptureType; count: number }>;
  trafficSources: Array<{ source: string; count: number }>;
  total: number;
  days: number;
};

const COUNT_WINDOW_DAYS = 30;
const TRAFFIC_SOURCE_LIMIT = 25;

/**
 * What the selection page counts next to each checkbox.
 *
 * Shown so the choice is made against real volume rather than a guess — "this
 * ticks 25 roadmap downloads into their CRM" is the fact that decides it.
 * Capture type is derived the same way the submit paths label it, so the
 * numbers and the feed cannot disagree.
 */
export async function getLeadForwardCaptureCounts(
  client?: SettingsClient,
  now: () => Date = () => new Date(),
): Promise<LeadForwardCaptureCounts> {
  const db = client ?? createAdminClient();
  const since = new Date(
    now().getTime() - COUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await db
    .from("lead_submissions")
    .select("form_type,utm_source,metadata,latest_qualification_form_id")
    .gte("created_at", since);

  if (error || !data) {
    return {
      captureTypes: [],
      trafficSources: [],
      total: 0,
      days: COUNT_WINDOW_DAYS,
    };
  }

  const byType = new Map<LeadCaptureType, number>();
  const bySource = new Map<string, number>();
  for (const row of data) {
    const type = captureTypeForRow(row);
    byType.set(type, (byType.get(type) ?? 0) + 1);
    const source = row.utm_source?.trim() || NO_TRAFFIC_SOURCE;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }

  return {
    captureTypes: LEAD_CAPTURE_TYPES.map((type) => ({
      type,
      count: byType.get(type) ?? 0,
    })),
    trafficSources: [...bySource.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TRAFFIC_SOURCE_LIMIT),
    total: data.length,
    days: COUNT_WINDOW_DAYS,
  };
}

/**
 * The stored-row half of the capture labelling in services/leads.ts and
 * services/qualification-intake.ts. Those decide at submit time from the input
 * they hold; this reads the same facts back off the row.
 */
function captureTypeForRow(row: {
  form_type: string;
  metadata: unknown;
  latest_qualification_form_id: string | null;
}): LeadCaptureType {
  if (row.form_type === "newsletter") return "newsletter";
  if (row.latest_qualification_form_id === NEWSLETTER_FORM_ID) {
    return "newsletter";
  }
  if (row.latest_qualification_form_id === LEAD_MAGNET_FORM_ID) {
    return "lead_magnet";
  }
  const source =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>).source
      : null;
  if (source === CHATBOT_LEAD_SOURCE) return "chat";
  if (row.form_type === "apply") return "application";
  return "booking";
}

function hasApiTransport(): boolean {
  return Boolean(
    process.env.WESCALE_GHL_TOKEN && process.env.WESCALE_GHL_LOCATION_ID,
  );
}

function asFieldIds(value: unknown): Record<string, string> {
  const parsed = z.record(z.string(), z.string()).safeParse(value);
  return parsed.success ? parsed.data : {};
}

export { LEAD_CAPTURE_TYPES, NO_TRAFFIC_SOURCE, type LeadCaptureType };
