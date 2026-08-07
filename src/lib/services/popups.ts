import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  POPUPS,
  safePopupHref,
  type Popup,
  type PopupTemplateFields,
} from "@/lib/content/popups";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

type PopupRow = Tables<"popups">;
type PopupsClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: PopupsClient;
};

export type PopupStatus = "draft" | "active" | "paused";

export type AdminPopup = {
  id: string;
  status: PopupStatus;
  /** Renderer-shaped campaign; `active` is derived from `status`. */
  popup: Popup;
  createdAt: string;
  updatedAt: string;
};

export type PopupEventTotals = {
  shown: number;
  ctaClicked: number;
  converted: number;
  dismissed: number;
};

export class PopupServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PopupServiceError";
  }
}

/** Tag revalidated by admin actions so visitor pages pick up edits. */
export const SITE_POPUPS_CACHE_TAG = "site-popups";

const POPUP_FIELDS =
  "id, status, trigger, trigger_threshold, target_url_patterns, frequency, eyebrow, headline, body, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href, featured_value_label, featured_value_value, featured_value_note, offer_code, dismiss_text, accent_color, created_at, updated_at" as const;

const popupCtaSchema = z.object({
  label: z.string().trim().min(1, "CTA label is required.").max(80),
  href: z
    .string()
    .trim()
    .min(1, "CTA link is required.")
    .max(300)
    .refine((value) => safePopupHref(value) !== null, {
      message:
        "CTA link must be a relative path or an http(s), mailto, or tel URL.",
    }),
});

const popupFieldsSchema: z.ZodType<PopupTemplateFields> = z.object({
  trigger: z.enum([
    "IMMEDIATE",
    "TIME_ON_PAGE",
    "SCROLL_DEPTH",
    "IDLE_TIME",
    "EXIT_INTENT",
  ]),
  triggerThreshold: z.number().finite().min(0).max(10_000).nullable(),
  targetUrlPatterns: z.array(z.string().trim().min(1).max(200)).max(20),
  frequency: z.enum(["session", "once_per_day", "always"]),
  eyebrow: z.string().trim().min(1).max(80).nullable(),
  headline: z.string().trim().min(1, "Headline is required.").max(120),
  body: z.string().trim().min(1, "Body copy is required.").max(500),
  primaryCta: popupCtaSchema,
  secondaryCta: popupCtaSchema.nullable(),
  featuredValue: z
    .object({
      label: z.string().trim().min(1).max(60),
      value: z.string().trim().min(1).max(80),
      note: z.string().trim().min(1).max(160).nullable(),
    })
    .nullable(),
  offerCode: z.string().trim().min(1).max(40).nullable(),
  dismissText: z.string().trim().min(1).max(120).nullable(),
  accentColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
      message: "Accent colour must be a hex value like #f47b3b.",
    })
    .nullable(),
});

const popupStatusSchema = z.enum(["draft", "active", "paused"]);

export async function adminListPopups(
  deps: ServiceDeps = {},
): Promise<AdminPopup[]> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("popups")
    .select(POPUP_FIELDS)
    .order("created_at", { ascending: false });

  if (error) throw new PopupServiceError("Could not list popups.");
  return ((data ?? []) as PopupRow[]).map(rowToAdminPopup);
}

export async function adminGetPopup(
  popupId: string,
  deps: ServiceDeps = {},
): Promise<AdminPopup | null> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("popups")
    .select(POPUP_FIELDS)
    .eq("id", popupId)
    .maybeSingle();

  if (error) throw new PopupServiceError("Could not load popup.");
  return data ? rowToAdminPopup(data as PopupRow) : null;
}

export async function adminCreatePopup(
  input: { fields: PopupTemplateFields; createdBy?: string | null },
  deps: ServiceDeps = {},
): Promise<AdminPopup> {
  const fields = parseFields(input.fields);
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("popups")
    .insert({
      ...fieldsToRow(fields),
      status: "draft",
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    })
    .select(POPUP_FIELDS)
    .single();

  if (error || !data) {
    console.error("popup create failed", {
      code: error?.code ?? null,
      message: error?.message ?? "insert returned no row",
    });
    throw new PopupServiceError("Could not create popup.");
  }
  return rowToAdminPopup(data as PopupRow);
}

export async function adminUpdatePopup(
  input: {
    popupId: string;
    fields: PopupTemplateFields;
    status: PopupStatus;
    updatedBy?: string | null;
  },
  deps: ServiceDeps = {},
): Promise<void> {
  const fields = parseFields(input.fields);
  const status = popupStatusSchema.parse(input.status);
  const client = serviceClient(deps);
  const { error } = await client
    .from("popups")
    .update({
      ...fieldsToRow(fields),
      status,
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.popupId);

  if (error) throw new PopupServiceError("Could not save popup.");
}

export async function adminDeletePopup(
  popupId: string,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = serviceClient(deps);
  const { error } = await client.from("popups").delete().eq("id", popupId);
  if (error) throw new PopupServiceError("Could not delete popup.");
}

/**
 * Event totals per popup id for the stat tiles. Aggregated in code: the
 * events table is young and PostgREST aggregates are not enabled on this
 * project.
 */
// ponytail: fetches up to 100k event rows and counts in JS; swap for a SQL
// view/RPC when popup volume makes that window real.
export async function adminPopupEventTotals(
  deps: ServiceDeps = {},
): Promise<Map<string, PopupEventTotals>> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("popup_events")
    .select("popup_id, event_type")
    .limit(100_000);

  if (error) throw new PopupServiceError("Could not load popup stats.");

  const totals = new Map<string, PopupEventTotals>();
  for (const row of data ?? []) {
    const entry = totals.get(row.popup_id) ?? {
      shown: 0,
      ctaClicked: 0,
      converted: 0,
      dismissed: 0,
    };
    if (row.event_type === "popup_shown") entry.shown += 1;
    else if (row.event_type === "popup_cta_clicked") entry.ctaClicked += 1;
    else if (row.event_type === "popup_converted") entry.converted += 1;
    else if (row.event_type === "popup_dismissed") entry.dismissed += 1;
    totals.set(row.popup_id, entry);
  }
  return totals;
}

export function sumPopupEventTotals(
  totals: Iterable<PopupEventTotals>,
): PopupEventTotals {
  const sum = { shown: 0, ctaClicked: 0, converted: 0, dismissed: 0 };
  for (const entry of totals) {
    sum.shown += entry.shown;
    sum.ctaClicked += entry.ctaClicked;
    sum.converted += entry.converted;
    sum.dismissed += entry.dismissed;
  }
  return sum;
}

const POPUP_EVENT_TYPES = new Set([
  "popup_shown",
  "popup_cta_clicked",
  "popup_converted",
  "popup_dismissed",
]);

/**
 * Persists one popup analytics event for the admin stat tiles. Never throws:
 * stats are best-effort and must not break the attribution forward — this is
 * also what keeps the route resilient while the table is not yet provisioned.
 */
export async function recordPopupEvent(
  input: { eventType: string; popupId: string; pagePath?: string | null },
  deps: ServiceDeps = {},
): Promise<boolean> {
  if (!POPUP_EVENT_TYPES.has(input.eventType)) return false;
  try {
    const client = serviceClient(deps);
    const { error } = await client.from("popup_events").insert({
      popup_id: input.popupId,
      event_type: input.eventType,
      page_path: input.pagePath ?? null,
    });
    if (error) {
      console.warn("popup event write failed", {
        eventType: input.eventType,
        code: error.code,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("popup event write failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return false;
  }
}

/** Active campaigns in renderer shape. Exported for tests; visitors get the
 *  cached `loadSitePopups`. */
export async function fetchActiveSitePopups(
  deps: ServiceDeps = {},
): Promise<Popup[]> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("popups")
    .select(POPUP_FIELDS)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new PopupServiceError("Could not load active popups.");
  return ((data ?? []) as PopupRow[]).map(rowToPopup);
}

const cachedActiveSitePopups = unstable_cache(
  () => fetchActiveSitePopups(),
  ["site-popups"],
  { revalidate: 300, tags: [SITE_POPUPS_CACHE_TAG] },
);

/**
 * The root layout's load path. Falls back to the static `POPUPS` array (all
 * inactive → nothing renders) when the table is unreachable or not yet
 * provisioned, so a DB problem can never break public pages.
 */
export async function loadSitePopups(): Promise<Popup[]> {
  try {
    return await cachedActiveSitePopups();
  } catch (error) {
    console.warn("site popups load failed, using static fallback", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return POPUPS;
  }
}

function serviceClient(deps: ServiceDeps): PopupsClient {
  return deps.client ?? createAdminClient();
}

function parseFields(input: unknown): PopupTemplateFields {
  const parsed = popupFieldsSchema.safeParse(input);
  if (!parsed.success) {
    throw new PopupServiceError(
      parsed.error.issues[0]?.message ?? "Invalid popup.",
    );
  }
  return parsed.data;
}

function fieldsToRow(
  fields: PopupTemplateFields,
): Omit<
  Database["public"]["Tables"]["popups"]["Insert"],
  "id" | "status" | "created_by" | "updated_by" | "created_at" | "updated_at"
> {
  return {
    trigger: fields.trigger,
    trigger_threshold: fields.triggerThreshold,
    target_url_patterns: fields.targetUrlPatterns,
    frequency: fields.frequency,
    eyebrow: fields.eyebrow,
    headline: fields.headline,
    body: fields.body,
    primary_cta_label: fields.primaryCta.label,
    primary_cta_href: fields.primaryCta.href,
    secondary_cta_label: fields.secondaryCta?.label ?? null,
    secondary_cta_href: fields.secondaryCta?.href ?? null,
    featured_value_label: fields.featuredValue?.label ?? null,
    featured_value_value: fields.featuredValue?.value ?? null,
    featured_value_note: fields.featuredValue?.note ?? null,
    offer_code: fields.offerCode,
    dismiss_text: fields.dismissText,
    accent_color: fields.accentColor,
  };
}

function rowToPopup(row: PopupRow): Popup {
  return {
    id: row.id,
    active: row.status === "active",
    trigger: row.trigger as Popup["trigger"],
    triggerThreshold: row.trigger_threshold,
    targetUrlPatterns: row.target_url_patterns,
    frequency: row.frequency as Popup["frequency"],
    eyebrow: row.eyebrow,
    headline: row.headline,
    body: row.body,
    primaryCta: { label: row.primary_cta_label, href: row.primary_cta_href },
    secondaryCta:
      row.secondary_cta_label && row.secondary_cta_href
        ? { label: row.secondary_cta_label, href: row.secondary_cta_href }
        : null,
    featuredValue:
      row.featured_value_label && row.featured_value_value
        ? {
            label: row.featured_value_label,
            value: row.featured_value_value,
            note: row.featured_value_note,
          }
        : null,
    offerCode: row.offer_code,
    dismissText: row.dismiss_text,
    accentColor: row.accent_color,
  };
}

function rowToAdminPopup(row: PopupRow): AdminPopup {
  return {
    id: row.id,
    status: popupStatusSchema.catch("draft").parse(row.status),
    popup: rowToPopup(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
