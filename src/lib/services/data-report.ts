/**
 * The end-of-day and end-of-week report, as text and HTML.
 *
 * Two things in one email, in this order: what happened (leads and calls
 * booked by channel, and what each source produced), and whether it can be
 * trusted (the night's audit against each source system). The trust line comes
 * first when something failed, so a reader never acts on a number the audit
 * already doubts.
 *
 * One section model renders both bodies. The HTML is a real table that stacks
 * into one card per row under 520px: a monospace block wraps into nonsense on
 * a phone, which is what the first version did.
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

/** A source's own headline numbers: one label, a few name/value pairs. */
export type ReportSourceBlock = {
  label: string;
  note?: string;
  values: ReadonlyArray<{ label: string; value: string }>;
};

export type DataReportInput = {
  period: "day" | "week";
  /** e.g. "Friday 19 September" or "Sep 12 to Sep 18". */
  windowLabel: string;
  channels: readonly ReportChannelRow[];
  /** The same window on the Close side: every first call, including people who never touched the site. */
  close: {
    label: string;
    rows: readonly ReportCloseRow[];
    complete: boolean;
  } | null;
  /** Webinar, email, chatbot, reach: sources with no place in the channel table. */
  sources?: readonly ReportSourceBlock[];
  audit: {
    summary: AuditSummary;
    results: readonly AuditResult[];
    runAt: string | null;
  } | null;
  dashboardUrl: string;
};

export type DataReport = { subject: string; text: string; html: string };

type Column = { label: string; align?: "left" | "right" };

type Section =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; tone?: "muted" | "alert" }
  | { kind: "list"; items: readonly string[] }
  | {
      kind: "table";
      columns: readonly Column[];
      rows: readonly (readonly string[])[];
      /** Renders bold with a rule above, and never stacks its label. */
      totalRow?: readonly string[];
    }
  | { kind: "blocks"; blocks: readonly ReportSourceBlock[] };

export function buildDataReport(input: DataReportInput): DataReport {
  const trust = trustLine(input.audit);
  const leads = num(totalOf(input.channels, "leads"));
  const calls = closeBooked(input);
  // The Close side is always a whole week, so a day report says so rather
  // than letting a week's calls read as today's.
  const callsPhrase =
    calls === null
      ? `${num(totalOf(input.channels, "booked"))} calls booked`
      : input.period === "day"
        ? `${num(calls)} calls booked this week`
        : `${num(calls)} calls booked`;
  const subject = `${input.period === "day" ? "EOD" : "EOW"} ${input.windowLabel}: ${leads} leads${input.period === "day" ? " today" : ""}, ${callsPhrase}${trust.subjectSuffix}`;

  const sections: Section[] = [
    {
      kind: "heading",
      text: `${input.period === "day" ? "Today" : "This week"}: ${input.windowLabel}`,
    },
    {
      kind: "paragraph",
      text: trust.line,
      tone: trust.ok ? "muted" : "alert",
    },
    ...(trust.problems.length > 0
      ? [{ kind: "list" as const, items: trust.problems }]
      : []),
    { kind: "heading", text: "Site leads by channel" },
    {
      kind: "paragraph",
      text: "People who filled a form on our site. Sign-ups are registrations and off-site contacts, which are never counted as leads.",
      tone: "muted",
    },
    channelTable(input.channels),
  ];

  if (input.close) {
    sections.push({
      kind: "heading",
      text: `First calls in Close, ${input.close.label}${input.close.complete ? "" : " (still filling)"}`,
    });
    sections.push({
      kind: "paragraph",
      text: "Every first call on the closers' calendar, including people who never touched the site.",
      tone: "muted",
    });
    sections.push(closeTable(input.close.rows));
  }

  if (input.sources && input.sources.length > 0) {
    sections.push({ kind: "heading", text: "The other sources" });
    sections.push({ kind: "blocks", blocks: input.sources });
  }

  if (input.audit) {
    sections.push({
      kind: "heading",
      text: `Checked against the source systems${input.audit.runAt ? ` at ${timeOf(input.audit.runAt)}` : ""}`,
    });
    sections.push(auditTable(input.audit.results));
  }

  sections.push({
    kind: "paragraph",
    text: `Full dashboard: ${input.dashboardUrl}`,
  });

  return { subject, text: toText(sections), html: toHtml(sections) };
}

/** What a reader needs before any number: can these be trusted today? */
function trustLine(audit: DataReportInput["audit"]) {
  if (!audit) {
    return {
      line: "No source check ran for this report, so these numbers are unverified.",
      problems: [] as string[],
      ok: false,
      subjectSuffix: " [unverified]",
    };
  }
  if (audit.summary.status === "pass") {
    return {
      line: audit.summary.headline,
      problems: [] as string[],
      ok: true,
      subjectSuffix: "",
    };
  }
  return {
    line: audit.summary.headline,
    problems: audit.summary.problems
      .slice(0, 4)
      .map((problem) => `${problem.label}: ${problem.detail}`),
    ok: false,
    subjectSuffix:
      audit.summary.status === "fail"
        ? " [CHECK FAILED]"
        : audit.summary.status === "error"
          ? " [a source could not be read]"
          : " [see notes]",
  };
}

function channelTable(rows: readonly ReportChannelRow[]): Section {
  return {
    kind: "table",
    columns: [
      { label: "Channel", align: "left" },
      { label: "Leads" },
      { label: "Sign-ups" },
      { label: "Booked" },
      { label: "Spend" },
    ],
    rows: rows.map((row) => [
      row.label,
      num(row.leads),
      num(row.contacts),
      num(row.booked),
      money(row.spend),
    ]),
    totalRow: [
      "Total",
      num(totalOf(rows, "leads")),
      num(totalOf(rows, "contacts")),
      num(totalOf(rows, "booked")),
      money(totalOf(rows, "spend")),
    ],
  };
}

function closeTable(rows: readonly ReportCloseRow[]): Section {
  const sum = (key: keyof ReportCloseRow) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return {
    kind: "table",
    columns: [
      { label: "Funnel", align: "left" },
      { label: "Booked" },
      { label: "Showed" },
      { label: "Qualified" },
      { label: "Won" },
      { label: "Revenue" },
    ],
    rows: rows.map((row) => [
      row.label,
      num(row.booked),
      num(row.showed),
      num(row.qualified),
      num(row.won),
      money(row.revenue),
    ]),
    totalRow: [
      "Total",
      num(sum("booked")),
      num(sum("showed")),
      num(sum("qualified")),
      num(sum("won")),
      money(sum("revenue")),
    ],
  };
}

function auditTable(results: readonly AuditResult[]): Section {
  return {
    kind: "table",
    columns: [
      { label: "Check", align: "left" },
      { label: "Verdict" },
      { label: "What it found", align: "left" },
    ],
    rows: results.map((result) => [
      result.label,
      MARKS[result.status],
      result.detail,
    ]),
  };
}

const MARKS: Record<AuditResult["status"], string> = {
  pass: "OK",
  warn: "drift",
  fail: "WRONG",
  skipped: "not checked",
  error: "unreachable",
};

/* ------------------------------------------------------------------ text */

function toText(sections: readonly Section[]) {
  const parts: string[] = [];
  for (const section of sections) {
    if (section.kind === "heading") parts.push("", section.text, "");
    if (section.kind === "paragraph") parts.push(section.text);
    if (section.kind === "list") {
      parts.push(...section.items.map((item) => `  - ${item}`));
    }
    if (section.kind === "table") {
      parts.push(
        textTable(
          section.columns.map((column) => column.label),
          section.totalRow
            ? [...section.rows, section.totalRow]
            : [...section.rows],
        ),
      );
    }
    if (section.kind === "blocks") {
      for (const block of section.blocks) {
        parts.push(
          `${block.label}: ${block.values
            .map((value) => `${value.value} ${value.label.toLowerCase()}`)
            .join(", ")}${block.note ? ` (${block.note})` : ""}`,
        );
      }
    }
  }
  return parts.join("\n").trim();
}

function textTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
) {
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

/* ------------------------------------------------------------------ html */

/**
 * Inline attributes carry the layout, so a client that strips `<style>`
 * (Gmail with a non-Google account) still gets a readable table. The stylesheet
 * only adds the phone treatment: under 520px every row becomes its own card,
 * each figure labelled by the column it came from.
 */
const STYLES = `
  body { margin:0; padding:20px; background:#ffffff; color:#111111;
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:720px; margin:0 auto; }
  h2 { font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:#6b7280;
       margin:28px 0 8px; font-weight:600; }
  p { margin:0 0 10px; }
  p.muted { color:#6b7280; font-size:13px; }
  p.alert { color:#b91c1c; font-weight:600; }
  ul { margin:0 0 12px; padding-left:18px; color:#b91c1c; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin:4px 0 4px; }
  th { font-size:12px; font-weight:600; color:#6b7280; padding:6px 10px;
       border-bottom:1px solid #d1d5db; white-space:nowrap; }
  td { padding:9px 10px; border-bottom:1px solid #f0f0f0; font-size:14px;
       font-variant-numeric:tabular-nums; }
  tr.total td { font-weight:700; border-top:2px solid #d1d5db; border-bottom:0; }
  .label::before { content:""; }
  @media only screen and (max-width:520px) {
    body { padding:14px; }
    table, tbody, tr, td { display:block; width:100%; box-sizing:border-box; }
    thead { display:none; }
    tr { border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; margin:0 0 10px; }
    tr.total { border-color:#111111; }
    td { border:0; padding:3px 0; display:flex; justify-content:space-between;
         align-items:baseline; gap:12px; text-align:right; }
    td.label { display:block; font-weight:700; font-size:15px; text-align:left;
               padding-bottom:6px; }
    td::before { content:attr(data-label); color:#6b7280; font-size:12px;
                 text-align:left; flex:0 0 auto; }
    td.label::before { content:""; }
  }
`;

function toHtml(sections: readonly Section[]) {
  const body = sections.map(htmlSection).join("\n");
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>${STYLES}</style>
</head>
<body><div class="wrap">
${body}
</div></body></html>`;
}

function htmlSection(section: Section): string {
  if (section.kind === "heading") return `<h2>${escape(section.text)}</h2>`;
  if (section.kind === "paragraph") {
    return `<p${section.tone ? ` class="${section.tone}"` : ""}>${escape(section.text)}</p>`;
  }
  if (section.kind === "list") {
    return `<ul>${section.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
  }
  if (section.kind === "blocks") {
    return section.blocks
      .map(
        (block) =>
          `<table role="presentation"><tbody><tr>` +
          `<td class="label">${escape(block.label)}</td>` +
          block.values
            .map(
              (value) =>
                `<td align="right" data-label="${escape(value.label)}">` +
                `<span class="label">${escape(value.label)}: </span>${escape(value.value)}</td>`,
            )
            .join("") +
          (block.note
            ? `<td align="right" data-label="Note">${escape(block.note)}</td>`
            : "") +
          `</tr></tbody></table>`,
      )
      .join("\n");
  }

  const head = section.columns
    .map(
      (column) =>
        `<th align="${column.align ?? "right"}">${escape(column.label)}</th>`,
    )
    .join("");
  const row = (cells: readonly string[], total = false) =>
    `<tr${total ? ' class="total"' : ""}>` +
    cells
      .map((cell, index) => {
        const column = section.columns[index]!;
        const align = column.align ?? "right";
        const classes = index === 0 ? ' class="label"' : "";
        return `<td align="${align}"${classes} data-label="${escape(column.label)}">${escape(cell)}</td>`;
      })
      .join("") +
    `</tr>`;
  return (
    `<table><thead><tr>${head}</tr></thead><tbody>` +
    section.rows.map((cells) => row(cells)).join("") +
    (section.totalRow ? row(section.totalRow, true) : "") +
    `</tbody></table>`
  );
}

/* --------------------------------------------------------------- helpers */

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

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
