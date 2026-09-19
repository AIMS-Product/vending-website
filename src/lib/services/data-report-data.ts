import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { getChannelsTab } from "@/lib/services/channel-report";
import { getCloseWeekView } from "@/lib/services/close-week-view-data";
import { weekStartOf } from "@/lib/services/close-week-view";
import {
  buildDataReport,
  type DataReport,
  type ReportChannelRow,
} from "@/lib/services/data-report";
import type { AuditResult, AuditSummary } from "@/lib/services/data-audit";
import { summariseAudit } from "@/lib/services/data-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

/**
 * Where the report goes. One address until Adam says otherwise; the env var
 * exists so adding a reader never needs a deploy.
 */
const DEFAULT_RECIPIENT = "adam@modern-amenities.com";
const TIME_ZONE = "America/Los_Angeles";

export type SendResult = {
  period: "day" | "week";
  window: { from: string; to: string };
  subject: string;
  sent: boolean;
  error?: string;
};

export async function sendDataReport(deps: {
  period: "day" | "week";
  now?: Date;
  client?: Client;
  to?: string[];
  /** Builds the report and returns it without sending. */
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SendResult & { report: DataReport }> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const { from, to, label } = reportWindow(deps.period, now);

  const [channels, close, audit] = await Promise.all([
    channelRows(from, to),
    closeRows(to),
    latestAudit(client),
  ]);

  const report = buildDataReport({
    period: deps.period,
    windowLabel: label,
    channels,
    close,
    audit,
    dashboardUrl: `${config.NEXT_PUBLIC_SITE_URL ?? "https://www.vendingpreneurs.com"}/admin/analytics`,
  });

  if (deps.dryRun) {
    return {
      period: deps.period,
      window: { from, to },
      subject: report.subject,
      sent: false,
      report,
    };
  }

  const sent = await send(
    report,
    deps.to ?? recipients(),
    deps.fetchImpl ?? fetch,
  );
  return {
    period: deps.period,
    window: { from, to },
    subject: report.subject,
    sent: sent.ok,
    ...(sent.ok ? {} : { error: sent.error }),
    report,
  };
}

/** Today for the day report; the Friday-to-Thursday week for the week report. */
export function reportWindow(period: "day" | "week", now: Date) {
  const today = dayKey(now);
  if (period === "day") {
    return { from: today, to: today, label: longDate(today) };
  }
  // Thursday evening: the week that ends today. Any other day: the week today
  // sits in, so a manual run mid-week still reports a real window.
  const from = weekStartOf(today);
  return {
    from,
    to: today,
    label: `${shortDate(from)} to ${shortDate(today)}`,
  };
}

async function channelRows(
  from: string,
  to: string,
): Promise<ReportChannelRow[]> {
  const tab = await getChannelsTab({ range: `custom:${from}:${to}` });
  return tab.report.rows.map((row) => ({
    label: row.label,
    leads: row.metrics.leads,
    contacts: row.metrics.contacts,
    booked: row.metrics.booked,
    spend: row.metrics.spend,
  }));
}

async function closeRows(to: string) {
  const view = await getCloseWeekView();
  if (!view.ok) return null;
  const week = view.weeks.find(
    (candidate) => candidate.key === weekStartOf(to),
  );
  if (!week) return null;
  return {
    label: `${shortDate(week.key)} to ${shortDate(week.end)}`,
    complete: week.complete,
    rows: week.rows.map((row) => ({
      label: row.label,
      booked: row.booked,
      showed: row.showed,
      qualified: row.qualified,
      won: row.won,
      revenue: row.revenue,
    })),
  };
}

/**
 * The night's audit. Null when it has never run or the table is not there yet:
 * the report then says the numbers are unverified rather than implying a pass.
 */
export async function latestAudit(client: Client): Promise<{
  summary: AuditSummary;
  results: AuditResult[];
  runAt: string | null;
} | null> {
  const { data, error } = await client
    .from("data_audit_runs")
    .select(
      "run_at,check_id,label,window_label,source_name,ours,source,diff_pct,status,detail",
    )
    .order("run_at", { ascending: false })
    .limit(60);
  if (error || !data || data.length === 0) return null;

  const runAt = data[0]!.run_at;
  const results: AuditResult[] = data
    .filter((row) => row.run_at === runAt)
    .map((row) => ({
      checkId: row.check_id,
      label: row.label,
      window: row.window_label,
      sourceName: row.source_name,
      ours: row.ours === null ? null : Number(row.ours),
      source: row.source === null ? null : Number(row.source),
      diffPct: row.diff_pct === null ? null : Number(row.diff_pct),
      status: row.status as AuditResult["status"],
      detail: row.detail,
    }));
  return { summary: summariseAudit(results), results, runAt };
}

function recipients() {
  const configured = process.env.DATA_REPORT_TO?.trim();
  return configured
    ? configured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [DEFAULT_RECIPIENT];
}

async function send(
  report: DataReport,
  to: string[],
  fetchImpl: typeof fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!config.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }
  const from =
    config.LEAD_NOTIFICATION_FROM?.trim() ||
    config.RESEND_FROM_EMAIL?.trim() ||
    "reports@vendingpreneurs.com";
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: report.subject,
        text: report.text,
        html: report.html,
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Resend replied ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Send failed.",
    };
  }
}

function dayKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function longDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function shortDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
