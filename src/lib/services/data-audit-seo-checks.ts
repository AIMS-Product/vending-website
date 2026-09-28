import "server-only";

import { SEARCH_CONSOLE_SOURCE } from "@/lib/analytics/channel";
import { isMissingTable } from "@/lib/seo/db";
import { compare, type AuditResult } from "@/lib/services/data-audit";
import {
  pageAll,
  type AuditClient as Client,
} from "@/lib/services/data-audit-query";

/**
 * /admin/seo reads Search Console from `seo_gsc_daily`; the channel tabs read
 * the same Google totals from the spine. Both are written by one run from one
 * report, so they must agree within 1%. A gap means one write failed.
 */
export async function seoSearchConsoleCheck(
  client: Client,
  window: { from: string; to: string; label: string },
): Promise<AuditResult[]> {
  const sumImpressions = async (
    read: () => Promise<Array<{ impressions: number | null }>>,
  ) => {
    const rows = await read();
    return rows.length === 0
      ? null
      : rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  };

  let ours: number | null;
  try {
    ours = await sumImpressions(() =>
      pageAll(client, "seo_gsc_daily", "day,impressions", (q) =>
        q.gte("day", window.from).lte("day", window.to),
      ),
    );
  } catch (error) {
    if (!isMissingTable({ message: (error as Error).message })) throw error;
    ours = null;
  }
  const spine = await sumImpressions(() =>
    pageAll(client, "channel_daily", "day,impressions", (q) =>
      q
        .eq("source", SEARCH_CONSOLE_SOURCE)
        .gte("day", window.from)
        .lte("day", window.to),
    ),
  );

  return [
    compare({
      checkId: "seo-search-console",
      label: "SEO page's Google impressions",
      window: window.label,
      sourceName: "the channel spine",
      ours,
      source: spine,
      tolerancePct: 1,
      note:
        ours === null
          ? "The SEO tables are empty or not created yet."
          : undefined,
    }),
  ];
}
