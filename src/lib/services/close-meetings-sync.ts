import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LEAD_LABELS,
  mapLeadFacts,
  mapMeeting,
  monthWindows,
  wholeSecond,
  type LeadFieldIds,
  type LeadRow,
  type MeetingRow,
} from "@/lib/booked-calls-v2/close-mapping";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;
type MeetingsClient = Pick<
  CloseClient,
  "listMeetings" | "listOutcomes" | "listCustomFields" | "searchLeads"
>;

export const CLOSE_MEETINGS_CONNECTOR = "close-meetings";

/** A window still paging past this many rows is split in two and reread. */
const SKIP_CAP = 2_000;
/** Leads with a meeting created this recently get their origin fields refreshed. */
const LEAD_FACT_DAYS = 70;
const LEAD_BATCH = 100;
const UPSERT_BATCH = 500;

async function crawlWindow(
  close: MeetingsClient,
  gte: string,
  lt: string,
  sink: (raw: Record<string, unknown>) => void,
): Promise<void> {
  for (let skip = 0; ; skip += 100) {
    if (skip >= SKIP_CAP) {
      const from = Date.parse(gte);
      const mid = wholeSecond(from + (Date.parse(lt) - from) / 2);
      if (mid === gte || mid === lt) {
        throw new Error(
          `Close meetings window ${gte}..${lt} cannot be split further.`,
        );
      }
      // Reread both halves: rows already sunk are keyed by id, so no double count.
      await crawlWindow(close, gte, mid, sink);
      await crawlWindow(close, mid, lt, sink);
      return;
    }
    const page = await close.listMeetings(gte, lt, skip);
    for (const raw of page.data ?? []) sink(raw);
    if (!page.has_more) return;
  }
}

async function refreshLeadFacts(
  client: SyncClient,
  close: MeetingsClient,
  leadIds: readonly string[],
  syncedAt: string,
): Promise<number> {
  const [leadDefs, contactDefs] = await Promise.all([
    close.listCustomFields("lead"),
    close.listCustomFields("contact"),
  ]);
  const byLabel = (defs: { data?: Array<{ id: string; name: string }> }) =>
    new Map((defs.data ?? []).map((d) => [d.name.trim().toLowerCase(), d.id]));
  const leadIds_ = byLabel(leadDefs);
  const contactIds = byLabel(contactDefs);
  const ids: LeadFieldIds = {
    lead: Object.fromEntries(
      Object.entries(LEAD_LABELS).map(([key, label]) => [
        key,
        leadIds_.get(label),
      ]),
    ) as Partial<Record<keyof typeof LEAD_LABELS, string>>,
    utmSource: contactIds.get("utm_source") ?? contactIds.get("utm source"),
    utmMedium: contactIds.get("utm_medium") ?? contactIds.get("utm medium"),
  };
  if (!ids.lead.funnel) {
    throw new Error(
      `Close lead custom field not found: "Funnel Name DEAL (Opp)".`,
    );
  }
  if (!ids.utmSource)
    console.warn(
      "close-meetings: no contact utm_source field; origins fall back to Resource Tag",
    );
  const fields = Object.values(ids.lead)
    .filter((id): id is string => Boolean(id))
    .map((id) => `custom.${id}`);

  let written = 0;
  for (let i = 0; i < leadIds.length; i += LEAD_BATCH) {
    const batch = leadIds.slice(i, i + LEAD_BATCH);
    const result = await close.searchLeads({
      query: {
        type: "or",
        queries: batch.map((id) => ({ type: "id", value: id })),
      },
      _fields: { lead: ["id", "contacts", ...fields] },
      _limit: LEAD_BATCH,
    });
    const rows = (result.data ?? [])
      .map((lead) => mapLeadFacts(lead, ids, syncedAt))
      .filter((row): row is LeadRow => row !== null);
    if (rows.length === 0) continue;
    const { error } = await client
      .from("close_meeting_leads")
      .upsert(rows, { onConflict: "lead_id" });
    if (error)
      throw new Error(
        `close_meeting_leads upsert failed after ${written} rows: ${error.message}`,
      );
    written += rows.length;
  }
  return written;
}

export async function syncCloseMeetings(
  deps: { client?: SyncClient; close?: MeetingsClient | null; now?: Date } = {},
): Promise<SyncRunOutcome> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const close =
    deps.close === undefined
      ? config.CLOSE_API_KEY
        ? createCloseClient({ apiKey: config.CLOSE_API_KEY })
        : null
      : deps.close;

  return recordSyncRun(
    client,
    CLOSE_MEETINGS_CONNECTOR,
    async () => {
      if (!close)
        return {
          rowsWritten: 0,
          error: "skipped: CLOSE_API_KEY is not configured.",
        };
      const syncedAt = now.toISOString();
      const outcomes = new Map(
        ((await close.listOutcomes()).data ?? []).map((o) => [
          o.id,
          o.name ?? o.id,
        ]),
      );

      const byId = new Map<string, MeetingRow>();
      for (const [gte, lt] of monthWindows(now)) {
        await crawlWindow(close, gte, lt, (raw) => {
          const row = mapMeeting(raw, outcomes, syncedAt);
          if (row && !byId.has(row.id)) byId.set(row.id, row);
        });
      }
      const rows = [...byId.values()];
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const { error } = await client
          .from("close_meetings")
          .upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: "id" });
        if (error)
          throw new Error(
            `close_meetings upsert failed after ${i} rows: ${error.message}`,
          );
      }
      // Every window walked to its last page, so anything older was deleted in Close.
      if (rows.length > 0) {
        const { error } = await client
          .from("close_meetings")
          .delete()
          .lt("synced_at", syncedAt);
        if (error)
          throw new Error(`close_meetings prune failed: ${error.message}`);
      }

      const since = now.getTime() - LEAD_FACT_DAYS * 86_400_000;
      const recentLeads = [
        ...new Set(
          rows
            .filter((r) => Date.parse(r.date_created) >= since)
            .map((r) => r.lead_id),
        ),
      ];
      const leadRows = await refreshLeadFacts(
        client,
        close,
        recentLeads,
        syncedAt,
      );
      return { rowsWritten: rows.length + leadRows };
    },
    { now: () => new Date() },
  );
}
