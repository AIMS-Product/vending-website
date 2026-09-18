import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCloseClient,
  type CloseClient,
  type CloseCustomFieldDefinition,
} from "@/lib/close/client";
import { config } from "@/lib/config";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;
type SearchClient = Pick<CloseClient, "listCustomFields" | "searchLeads">;

export const CLOSE_LEAD_FUNNEL_CONNECTOR = "close-lead-funnel";

/**
 * The Close custom fields this mirror is built from, by their labels in Close.
 * Resolved to ids at run time from Close's own schema rather than pinned in
 * env, so a field renamed or recreated in Close fails the run with the label
 * in the error instead of silently writing nulls for a quarter.
 */
export const FIELD_LABELS = {
  bookedDate: "First Sales Call Booked Date",
  funnel: "Funnel Name DEAL (Opp)",
  showUp: "First Call Show Up (Opp)",
  setter: "Reactivation - Setter Name",
  leadSource: "Lead Source - Company",
  marketingSourceType: "Marketing Source Type",
  lane: "Sales Team Lane",
  qualified: "Qualified (Opp)",
  disposition: "Todays Call Disposition (Opp)",
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;
export type FieldIds = Partial<Record<FieldKey, string>> &
  Pick<Record<FieldKey, string>, "bookedDate" | "funnel">;

/** Close pages at most 200 leads per search request. */
const PAGE_SIZE = 200;
/** Well above the leads that have ever booked; stops a runaway cursor loop. */
const MAX_PAGES = 500;
const UPSERT_BATCH = 500;

export type CloseLeadFunnelRow = TablesInsert<"close_lead_funnel">;

export function resolveFieldIds(
  definitions: readonly CloseCustomFieldDefinition[],
): FieldIds {
  const byLabel = new Map(
    definitions.map((definition) => [
      definition.name.trim().toLowerCase(),
      definition.id,
    ]),
  );
  const found: Partial<Record<FieldKey, string>> = {};
  for (const [key, label] of Object.entries(FIELD_LABELS) as Array<
    [FieldKey, string]
  >) {
    const id = byLabel.get(label.toLowerCase());
    if (id) found[key] = id;
  }
  if (!found.bookedDate || !found.funnel) {
    const missing = [
      !found.bookedDate && FIELD_LABELS.bookedDate,
      !found.funnel && FIELD_LABELS.funnel,
    ].filter(Boolean);
    throw new Error(
      `Close lead custom field not found: ${missing.map((label) => `"${label}"`).join(", ")}. The mirror cannot be built without it.`,
    );
  }
  return found as FieldIds;
}

/**
 * Every lead whose first sales call was ever booked, newest change first so a
 * run cut short by the function timeout still refreshed the leads that moved.
 * No date window on purpose: the whole set is a few thousand leads, and one
 * query shape means one thing that can break.
 */
export function buildSearchBody(
  fieldIds: FieldIds,
  cursor: string | null = null,
): Record<string, unknown> {
  const customFields = Object.values(fieldIds).map((id) => `custom.${id}`);
  return {
    query: {
      type: "and",
      queries: [
        { type: "object_type", object_type: "lead" },
        {
          type: "field_condition",
          field: { type: "custom_field", custom_field_id: fieldIds.bookedDate },
          condition: { type: "exists" },
        },
      ],
    },
    sort: [
      {
        direction: "desc",
        field: {
          type: "regular_field",
          object_type: "lead",
          field_name: "date_updated",
        },
      },
    ],
    _fields: {
      lead: [
        "id",
        "display_name",
        "status_label",
        "date_created",
        "date_updated",
        "contacts",
        ...customFields,
      ],
    },
    _limit: PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  };
}

/**
 * One search result -> one mirror row. Custom values arrive flattened as
 * `custom.cf_...` keys on a search result; the nested `custom` object is
 * accepted too because the single-lead endpoint returns that shape.
 */
export function mapLead(
  lead: Record<string, unknown>,
  fieldIds: FieldIds,
  syncedAt: string,
): CloseLeadFunnelRow | null {
  const leadId = text(lead.id);
  if (!leadId) return null;
  const custom = (lead.custom ?? {}) as Record<string, unknown>;
  const field = (key: FieldKey): string | null => {
    const id = fieldIds[key];
    if (!id) return null;
    return text(lead[`custom.${id}`] ?? custom[id]);
  };
  const bookedRaw = field("bookedDate");
  const booked =
    bookedRaw && /^\d{4}-\d{2}-\d{2}/.test(bookedRaw)
      ? bookedRaw.slice(0, 10)
      : null;
  return {
    lead_id: leadId,
    display_name: text(lead.display_name),
    email: firstEmail(lead.contacts),
    funnel: field("funnel"),
    lead_source: field("leadSource"),
    marketing_source_type: field("marketingSourceType"),
    sales_team_lane: field("lane"),
    first_sales_call_booked_date: booked,
    first_call_show_up: field("showUp"),
    status_label: text(lead.status_label),
    qualified: field("qualified"),
    setter_name: field("setter"),
    call_disposition: field("disposition"),
    lead_created_at: text(lead.date_created),
    lead_updated_at: text(lead.date_updated),
    synced_at: syncedAt,
  };
}

export async function syncCloseLeadFunnel(
  deps: { client?: SyncClient; close?: SearchClient | null; now?: Date } = {},
): Promise<SyncRunOutcome> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const close = deps.close === undefined ? closeFromConfig() : deps.close;

  return recordSyncRun(
    client,
    CLOSE_LEAD_FUNNEL_CONNECTOR,
    async () => {
      if (!close) {
        return {
          rowsWritten: 0,
          error: "skipped: CLOSE_API_KEY is not configured.",
        };
      }
      const definitions = await close.listCustomFields("lead");
      const fieldIds = resolveFieldIds(definitions.data ?? []);
      const syncedAt = now.toISOString();

      // Keyed, not pushed: the crawl is a cursor walk over a live set sorted
      // newest-change-first, so a lead updated mid-run shifts across a page
      // boundary and is read twice. Two rows with one `lead_id` in a single
      // upsert is what Postgres rejects with "ON CONFLICT DO UPDATE command
      // cannot affect row a second time", which failed the whole run and wrote
      // nothing. First seen wins: in a newest-first walk that is the fresher
      // copy of the lead.
      const byLeadId = new Map<string, CloseLeadFunnelRow>();
      let cursor: string | null = null;
      let walkedEveryPage = false;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await close.searchLeads(
          buildSearchBody(fieldIds, cursor),
        );
        for (const lead of result.data ?? []) {
          const row = mapLead(lead, fieldIds, syncedAt);
          if (row && !byLeadId.has(row.lead_id)) byLeadId.set(row.lead_id, row);
        }
        cursor = result.cursor ?? null;
        if (!cursor || (result.data ?? []).length === 0) {
          walkedEveryPage = true;
          break;
        }
      }
      const rows = [...byLeadId.values()];

      let written = 0;
      for (let from = 0; from < rows.length; from += UPSERT_BATCH) {
        const batch = rows.slice(from, from + UPSERT_BATCH);
        const { error } = await client
          .from("close_lead_funnel")
          .upsert(batch, { onConflict: "lead_id" });
        if (error) {
          throw new Error(
            `close_lead_funnel upsert failed after ${written} rows: ${error.message}`,
          );
        }
        written += batch.length;
      }

      // Every lead Close still returns now carries this run's `synced_at`, so
      // anything older is a lead whose booked date a rep cleared, or a lead
      // deleted or merged in Close. Upsert alone kept those forever (Sep 11-17:
      // 176 in the mirror, 171 in Close). Only after a walk that reached the
      // last page and found leads: a cut-short or empty walk proves nothing.
      if (walkedEveryPage && rows.length > 0) {
        const { error } = await client
          .from("close_lead_funnel")
          .delete()
          .lt("synced_at", syncedAt);
        if (error) {
          throw new Error(
            `close_lead_funnel prune failed after ${written} rows: ${error.message}`,
          );
        }
      }
      return { rowsWritten: written };
    },
    { now: () => new Date() },
  );
}

function closeFromConfig(): SearchClient | null {
  if (!config.CLOSE_API_KEY) return null;
  return createCloseClient({ apiKey: config.CLOSE_API_KEY });
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function firstEmail(contacts: unknown): string | null {
  if (!Array.isArray(contacts)) return null;
  for (const contact of contacts) {
    const emails = (contact as { emails?: unknown })?.emails;
    if (!Array.isArray(emails)) continue;
    for (const entry of emails) {
      const email = text((entry as { email?: unknown })?.email);
      if (email) return email.toLowerCase();
    }
  }
  return null;
}
