/**
 * The end-of-day and end-of-week report, as text and HTML.
 *
 * Two things in one email, in this order: what happened (leads and calls
 * booked by channel), and whether it can be trusted (the night's audit against
 * each source system). The trust line comes first when something failed, so a
 * reader never acts on a number the audit already doubts.
 *
 * Pure. The numbers arrive prepared; nothing here reads a database.
 */

import type { AuditResult, AuditSummary } from "@/lib/services/data-audit";

export type ReportChannelRow = {
  label: string;
  leads: number | null;
  /** Registrations and off-site contacts. Never counted as leads. */
  contacts: number | null;
  booked: number | null;
  spend: number | null;
};

export type ReportCloseRow = {
  label: string;
  booked: number;
  showed: number;
  qualified: number;
  won: number;
  revenue: number;
};

export type DataReportInput = {
  period: "day" | "week";
  /** e.g. "Friday 19 September" or "week of Sep 12 to Sep 18". */
  windowLabel: string;
  channels: readonly ReportChannelRow[];
  /** The same window on the Close side: every first call, including people who never touched the site. */
  close: {
    label: string;
    rows: readonly ReportCloseRow[];
    complete: boolean;
  } | null;
  audit: {
    summary: AuditSummary;
    results: readonly AuditResult[];
    runAt: string | null;
  } | null;
  dashboardUrl: string;
};

export type DataReport = { subject: string; text: string; html: string };

export function buildDataReport(input: DataReportInput): DataReport {
  const title = input.period === "day" ? "Today" : "This week";
  const trust = trustLine(input.audit);
  // The Close side is always a whole week, so a day report says so rather
  // than letting a week's calls read as today's.
  const leads = num(totalOf(input.channels, "leads"));
  const calls = closeBooked(input);
  const callsPhrase =
    calls === null
      ? `${num(totalOf(input.channels, "booked"))} calls booked`
      : input.period === "day"
        ? `${num(calls)} calls booked this week`
        : `${num(calls)} calls booked`;
  const subject = `${input.period === "day" ? "EOD" : "EOW"} ${input.windowLabel}: ${leads} leads${input.period === "day" ? " today" : ""}, ${callsPhrase}${trust.subjectSuffix}`;

  const sections: string[] = [];
  sections.push(`${title}: ${input.windowLabel}`);
  sections.push("");
  sections.push(trust.line);
  sections.push("");

  sections.push("Site leads by channel (people who filled a form on our site)");
  sections.push(channelTable(input.channels));

  if (input.close) {
    sections.push("");
    sections.push(
      `First calls in Close, ${input.close.label}${input.close.complete ? "" : " (still filling)"}`,
    );
    sections.push(closeTable(input.close.rows));
  }

  if (input.audit) {
    sections.push("");
    sections.push(
      `Checked against the source systems${input.audit.runAt ? ` at ${timeOf(input.audit.runAt)}` : ""}`,
    );
    sections.push(auditTable(input.audit.results));
  }

  sections.push("");
  sections.push(`Full dashboard: ${input.dashboardUrl}`);

  const text = sections.join("\n");
  return { subject, text, html: toHtml(sections) };
}

/** What a reader needs before any number: can these be trusted today? */
function trustLine(audit: DataReportInput["audit"]) {
  if (!audit) {
    return {
      line: "No source check ran for this report, so these numbers are unverified.",
      subjectSuffix: " [unverified]",
    };
  }
  if (audit.summary.status === "pass") {
    return { line: audit.summary.headline, subjectSuffix: "" };
  }
  const problems = audit.summary.problems
    .slice(0, 3)
    .map((problem) => `  - ${problem.label}: ${problem.detail}`)
    .join("\n");
  return {
    line: `${audit.summary.headline}\n${problems}`,
    subjectSuffix:
      audit.summary.status === "fail"
        ? " [CHECK FAILED]"
        : audit.summary.status === "error"
          ? " [a source could not be read]"
          : " [see notes]",
  };
}

function channelTable(rows: readonly ReportChannelRow[]) {
  const header = ["Channel", "Leads", "Sign-ups", "Booked", "Spend"];
  const body = rows.map((row) => [
    row.label,
    num(row.leads),
    num(row.contacts),
    num(row.booked),
    money(row.spend),
  ]);
  body.push([
    "Total",
    num(totalOf(rows, "leads")),
    num(totalOf(rows, "contacts")),
    num(totalOf(rows, "booked")),
    money(totalOf(rows, "spend")),
  ]);
  return table(header, body);
}

function closeTable(rows: readonly ReportCloseRow[]) {
  const header = ["Funnel", "Booked", "Showed", "Qualified", "Won", "Revenue"];
  const body = rows.map((row) => [
    row.label,
    num(row.booked),
    num(row.showed),
    num(row.qualified),
    num(row.won),
    money(row.revenue),
  ]);
  const sum = (key: keyof ReportCloseRow) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  body.push([
    "Total",
    num(sum("booked")),
    num(sum("showed")),
    num(sum("qualified")),
    num(sum("won")),
    money(sum("revenue")),
  ]);
  return table(header, body);
}

function auditTable(results: readonly AuditResult[]) {
  const header = ["", "Check", "Source", "What it found"];
  const body = results.map((result) => [
    mark(result.status),
    result.label,
    result.sourceName,
    result.detail,
  ]);
  return table(header, body);
}

const MARKS: Record<AuditResult["status"], string> = {
  pass: "OK",
  warn: "drift",
  fail: "WRONG",
  skipped: "not checked",
  error: "unreachable",
};

function mark(status: AuditResult["status"]) {
  return MARKS[status];
}

/** Monospace columns: readable in any mail client, no styling needed. */
function table(header: readonly string[], rows: readonly string[][]) {
  const all = [header, ...rows];
  const widths = header.map((_, column) =>
    Math.max(...all.map((row) => (row[column] ?? "").length)),
  );
  const line = (row: readonly string[]) =>
    row
      .map((cell, column) =>
        column === 0 || column === row.length - 1
          ? (cell ?? "").padEnd(widths[column]!)
          : (cell ?? "").padStart(widths[column]!),
      )
      .join("  ")
      .trimEnd();
  return [
    line(header),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

function totalOf(
  rows: readonly ReportChannelRow[],
  key: "leads" | "contacts" | "booked" | "spend",
): number | null {
  const observed = rows.filter((row) => row[key] !== null);
  if (observed.length === 0) return null;
  return observed.reduce((total, row) => total + (row[key] ?? 0), 0);
}

function closeBooked(input: DataReportInput): number | null {
  if (!input.close) return null;
  return input.close.rows.reduce((total, row) => total + row.booked, 0);
}

function num(value: number | null) {
  return value === null ? "-" : Math.round(value).toLocaleString("en-US");
}

function money(value: number | null) {
  return value === null ? "-" : `$${Math.round(value).toLocaleString("en-US")}`;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toHtml(sections: readonly string[]) {
  const body = sections
    .map((section) =>
      section.includes("\n") || /^[A-Za-z].*  /.test(section)
        ? `<pre style="font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 16px">${escape(section)}</pre>`
        : `<p style="font:14px/1.6 -apple-system,Segoe UI,sans-serif;margin:0 0 12px">${escape(section)}</p>`,
    )
    .join("\n");
  return `<div style="max-width:760px">${body}</div>`;
}

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
