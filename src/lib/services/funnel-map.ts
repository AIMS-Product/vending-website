import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { FORM_ROUTES } from "@/lib/services/ghl-sync";
import {
  fetchFacts,
  getChannelsTab,
  type ChannelsTabData,
} from "@/lib/services/channel-report";
import {
  normaliseFacts,
  type ChannelFact,
} from "@/lib/services/channel-report-rollup";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Data behind the Funnel map tab: the Channels tab's own numbers (so the map
 * and the table can never disagree) plus the GoHighLevel detail, which has no
 * home anywhere else in the admin.
 *
 * GHL is the one connector whose output is invisible on the Channels table by
 * design: email rows carry sends and clicks but never a lead, and form rows
 * are re-credited to the channel that earned them (see FORM_ROUTES). Both are
 * correct, and both make people ask where the GHL data went. This answers it.
 */

type MapClient = Pick<SupabaseClient<Database>, "from">;

const DAY_MS = 24 * 60 * 60 * 1000;

export type GhlWorkflow = {
  name: string;
  /** Lifetime totals, from the newest snapshot. GHL exposes nothing else. */
  sent: number;
  opened: number;
  clicked: number;
  /** Day-over-day deltas summed over the range; null when unobserved. */
  sentInRange: number | null;
  clickedInRange: number | null;
};

export type GhlForm = {
  /** The form name as GHL stores it, slugged by the connector. */
  campaign: string;
  source: string;
  /** The channel this form's leads are credited to on the Channels tab. */
  channel: string;
  leads: number;
};

export type GhlSummary = {
  /** Null when the email connector has never written a snapshot. */
  snapshotDay: string | null;
  workflowCount: number;
  workflows: GhlWorkflow[];
  lifetime: { sent: number; opened: number; clicked: number };
  inRange: { sent: number | null; clicked: number | null; formLeads: number };
  forms: GhlForm[];
};

export type FunnelMapData = {
  channels: ChannelsTabData;
  ghl: GhlSummary;
};

export async function getFunnelMap(
  input: {
    range?: AdminAnalyticsRangeKey;
    client?: MapClient;
    now?: Date;
  } = {},
): Promise<FunnelMapData> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const range = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const days = ADMIN_ANALYTICS_RANGES[range].days;
  const endDay = dayKey(now);
  const startDay = dayKey(new Date(now.getTime() - (days - 1) * DAY_MS));

  const [channels, ghl] = await Promise.all([
    getChannelsTab({ range, client, now }),
    getGhlSummary(client, startDay, endDay),
  ]);
  return { channels, ghl };
}

type Route = { source: string; medium: string; content: string };

const ROUTES: Route[] = Object.values(FORM_ROUTES).filter(
  (route): route is Route => route !== "exclude",
);

/** Source/medium/content triples the GHL forms connector writes. */
const ROUTE_KEYS = new Set(
  ROUTES.map((route) => routeKey(route.source, route.medium, route.content)),
);

async function getGhlSummary(
  client: MapClient,
  startDay: string,
  endDay: string,
): Promise<GhlSummary> {
  const { data: newest } = await client
    .from("ghl_email_stats")
    .select("snapshot_day")
    .order("snapshot_day", { ascending: false })
    .limit(1);
  const snapshotDay = newest?.[0]?.snapshot_day ?? null;

  const [snapshot, facts] = await Promise.all([
    snapshotDay
      ? client
          .from("ghl_email_stats")
          .select("workflow_name,sent,opened,clicked")
          .eq("snapshot_day", snapshotDay)
      : Promise.resolve({ data: null }),
    // PostgREST caps a plain select at 1,000 rows and says nothing about it,
    // which silently undercounts every range longer than a few weeks.
    // `fetchFacts` is the paged read the Channels tab already trusts, and
    // `normaliseFacts` re-derives the channel label the same way, so a form's
    // credited channel here always matches the row it lands in there.
    fetchFacts(client, startDay, endDay),
  ]);

  const rangeByCampaign = new Map<
    string,
    { sent: number | null; clicked: number | null }
  >();
  const formsByKey = new Map<string, GhlForm>();
  let formLeads = 0;

  for (const row of normaliseFacts((facts ?? []) as ChannelFact[])) {
    if (row.source === "ghl_email") {
      const seen = rangeByCampaign.get(row.campaign);
      rangeByCampaign.set(row.campaign, {
        sent: addObserved(seen?.sent ?? null, row.impressions),
        clicked: addObserved(seen?.clicked ?? null, row.clicks),
      });
      continue;
    }
    // A routed source (mike-ig, vsl, meta_ads) also carries link-tagged rows
    // that have nothing to do with GHL. Only the exact triple a form route
    // writes counts as a form submission.
    const isFormRow =
      row.source === "ghl_form" ||
      ROUTE_KEYS.has(routeKey(row.source, row.medium, row.content));
    if (!isFormRow || !row.leads) continue;
    formLeads += row.leads;
    const key = routeKey(row.source, row.campaign, "");
    const existing = formsByKey.get(key);
    formsByKey.set(
      key,
      existing
        ? { ...existing, leads: existing.leads + row.leads }
        : {
            campaign: row.campaign,
            source: row.source,
            channel: row.channel,
            leads: row.leads,
          },
    );
  }

  const workflows: GhlWorkflow[] = (snapshot.data ?? [])
    .map((row) => {
      const inRange = rangeByCampaign.get(slug(row.workflow_name));
      return {
        name: row.workflow_name,
        sent: row.sent ?? 0,
        opened: row.opened ?? 0,
        clicked: row.clicked ?? 0,
        sentInRange: inRange?.sent ?? null,
        clickedInRange: inRange?.clicked ?? null,
      };
    })
    .sort((a, b) => b.sent - a.sent);

  return {
    snapshotDay,
    workflowCount: workflows.length,
    workflows,
    lifetime: {
      sent: total(workflows, "sent"),
      opened: total(workflows, "opened"),
      clicked: total(workflows, "clicked"),
    },
    inRange: {
      sent: totalObserved(workflows, "sentInRange"),
      clicked: totalObserved(workflows, "clickedInRange"),
      formLeads,
    },
    forms: [...formsByKey.values()].sort((a, b) => b.leads - a.leads),
  };
}

/** JSON, not a delimiter: campaign names contain pipes and dashes. */
function routeKey(a: string, b: string, c: string | null): string {
  return JSON.stringify([a, b, c ?? ""]);
}

/** Unobserved plus a number is that number; unobserved stays unobserved. */
function addObserved(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return a + b;
}

function total(
  rows: GhlWorkflow[],
  key: "sent" | "opened" | "clicked",
): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function totalObserved(
  rows: GhlWorkflow[],
  key: "sentInRange" | "clickedInRange",
): number | null {
  return rows.reduce<number | null>(
    (sum, row) => addObserved(sum, row[key]),
    null,
  );
}

/** Must match the slug the GHL connector writes into `campaign`. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
