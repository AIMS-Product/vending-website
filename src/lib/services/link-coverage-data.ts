import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLinkCoverage,
  type CoverageLeadRow,
  type CoverageLinkRow,
  type LinkCoverageReport,
} from "@/lib/services/link-coverage";
import {
  resolveAdminAnalyticsRange,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  collapseToLeads,
  lookbackStart,
  type LeadLike,
} from "@/lib/analytics/lead-definition";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

export async function getLinkCoverage(input: {
  range: AdminAnalyticsRangeKey;
  client?: Client;
  now?: Date;
}): Promise<LinkCoverageReport> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const resolved = resolveAdminAnalyticsRange(input.range, now);
  const end = resolved.endDay ?? dayKey(resolved.endsAt);
  const start = resolved.startDay ?? shiftDays(end, -(resolved.days - 1));

  const [leads, links] = await Promise.all([
    page(
      (from, to) =>
        client
          .from("lead_submissions")
          .select(
            "created_at,email,full_name,lifecycle_status,source_path,utm_source,utm_medium,utm_campaign,utm_content,utm_term",
          )
          // 30 days early so repeats are recognised (lead-definition).
          .gte(
            "created_at",
            lookbackStart(`${start}T00:00:00.000Z`).toISOString(),
          )
          .lte("created_at", `${end}T23:59:59.999Z`)
          .order("created_at")
          .range(from, to),
      "lead_submissions",
    ) as Promise<CoverageLeadRow[]>,
    page(
      (from, to) =>
        client
          .from("marketing_links")
          .select(
            "utm_source,utm_medium,utm_campaign,utm_content,utm_term,label",
          )
          .order("created_at")
          .range(from, to),
      "marketing_links",
    ) as Promise<CoverageLinkRow[]>,
  ]);

  // Counted the way every other surface counts a lead: one person, no
  // newsletter signups, no test or team submissions.
  const counted = collapseToLeads(
    leads as (CoverageLeadRow & LeadLike)[],
  ).filter((lead) => lead.created_at.slice(0, 10) >= start);
  return buildLinkCoverage({
    leads: counted,
    links,
    window: { start, end },
  });
}

async function page<Row>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  table: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    // A partial read here would understate coverage and read as a tagging
    // failure the team does not have. Fail the page instead.
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
