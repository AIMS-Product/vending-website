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
  type ReportSourceBlock,
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

  const [channels, close, sources, audit] = await Promise.all([
    channelRows(from, to),
    closeRows(to),
    sourceBlocks(client, from, to),
    latestAudit(client),
  ]);

  const report = buildDataReport({
    period: deps.period,
    windowLabel: label,
    channels,
    close,
    sources,
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

/**
 * The sources with no column in the channel table: the webinar, the email
 * workflows, the chatbot, social reach, and the two feeds that are not
 * connected yet. A feed that is silent says so rather than being left out,
 * because an absent row reads as "nothing happened" instead of "not tracked".
 */
async function sourceBlocks(
  client: Client,
  from: string,
  to: string,
): Promise<ReportSourceBlock[]> {
  const [webinar, email, chatbot, reach, bitly, manychat] = await Promise.all([
    latestWebinar(client),
    emailTotals(client, from, to),
    chatbotTotals(client, from, to),
    reachTotals(client, from, to),
    countRows(client, "bitly_link_clicks", (query) =>
      query.gte("day", from).lte("day", to),
    ),
    countRows(client, "manychat_events", (query) =>
      query.gte("day", from).lte("day", to),
    ),
  ]);

  const blocks: ReportSourceBlock[] = [];
  if (webinar) blocks.push(webinar);
  if (email) blocks.push(email);
  if (chatbot) blocks.push(chatbot);
  if (reach) blocks.push(reach);
  blocks.push({
    label: "Instagram DM (ManyChat)",
    values: [{ label: "Events", value: count(manychat) }],
    note:
      (manychat ?? 0) === 0
        ? "not connected: Mike has not added the External Request steps"
        : undefined,
  });
  blocks.push({
    label: "Short-link clicks (Bitly)",
    values: [{ label: "Clicks", value: count(bitly) }],
    note:
      (bitly ?? 0) === 0
        ? "not connected: no Bitly access token yet"
        : undefined,
  });
  return blocks;
}

async function latestWebinar(
  client: Client,
): Promise<ReportSourceBlock | null> {
  const { data } = await client
    .from("webinar_events")
    .select(
      "date,label,registrations,attendees,booked_ever,showed,won,revenue,spend,booking_maturing",
    )
    .order("date", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    label: `Webinar ${row.label ?? row.date}`,
    values: [
      { label: "Registered", value: count(row.registrations) },
      { label: "Attended", value: count(row.attendees) },
      { label: "Booked", value: count(row.booked_ever) },
      { label: "Showed", value: count(row.showed) },
      { label: "Won", value: count(row.won) },
      { label: "Revenue", value: dollars(row.revenue) },
      { label: "Spend", value: dollars(row.spend) },
    ],
    note: row.booking_maturing
      ? "too early to grade: bookings are still coming in"
      : undefined,
  };
}

async function emailTotals(
  client: Client,
  from: string,
  to: string,
): Promise<ReportSourceBlock | null> {
  const { data } = await client
    .from("ghl_email_stats")
    .select("sent,delivered,opened,clicked,replied")
    .gte("snapshot_day", from)
    .lte("snapshot_day", to);
  if (!data || data.length === 0) return null;
  const sum = (key: "sent" | "delivered" | "opened" | "clicked" | "replied") =>
    data.reduce((total, row) => total + (row[key] ?? 0), 0);
  return {
    label: "Email workflows (GoHighLevel)",
    values: [
      { label: "Sent", value: count(sum("sent")) },
      { label: "Opened", value: count(sum("opened")) },
      { label: "Clicked", value: count(sum("clicked")) },
      { label: "Replied", value: count(sum("replied")) },
    ],
  };
}

async function chatbotTotals(
  client: Client,
  from: string,
  to: string,
): Promise<ReportSourceBlock | null> {
  const { data } = await client
    .from("chatbot_conversations")
    .select("status,lead_submission_id")
    .gte("created_at", `${from}T00:00:00Z`)
    .lt("created_at", `${nextDay(to)}T00:00:00Z`);
  if (!data) return null;
  return {
    label: "Site chatbot",
    values: [
      { label: "Conversations", value: count(data.length) },
      {
        label: "Leads captured",
        value: count(data.filter((row) => row.lead_submission_id).length),
      },
    ],
  };
}

async function reachTotals(
  client: Client,
  from: string,
  to: string,
): Promise<ReportSourceBlock | null> {
  const { data } = await client
    .from("channel_daily")
    .select("impressions,clicks")
    .gte("day", from)
    .lte("day", to)
    .not("impressions", "is", null)
    .limit(1000);
  if (!data || data.length === 0) return null;
  const sum = (key: "impressions" | "clicks") =>
    data.reduce((total, row) => total + (row[key] ?? 0), 0);
  return {
    label: "Social reach (Metricool)",
    values: [
      { label: "Impressions", value: count(sum("impressions")) },
      { label: "Clicks to site", value: count(sum("clicks")) },
    ],
    note: "impressions, not people: the same follower counts once per post",
  };
}

async function countRows(
  client: Client,
  table: "bitly_link_clicks" | "manychat_events",
  apply: (query: CountQuery) => CountQuery,
): Promise<number | null> {
  const query = apply(
    client.from(table).select("*", { count: "exact", head: true }) as never,
  ) as unknown as Promise<{ count: number | null }>;
  const { count: rows } = await query;
  return rows ?? null;
}

type CountQuery = {
  gte(column: string, value: string): CountQuery;
  lte(column: string, value: string): CountQuery;
};

function count(value: number | null | undefined) {
  return value === null || value === undefined
    ? "-"
    : value.toLocaleString("en-US");
}

function dollars(value: number | null | undefined) {
  return value === null || value === undefined
    ? "-"
    : `$${Math.round(value).toLocaleString("en-US")}`;
}

function nextDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
