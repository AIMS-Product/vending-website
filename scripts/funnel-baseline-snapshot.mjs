#!/usr/bin/env node
/**
 * Freezes the per-funnel conversion baseline to a dated markdown file.
 *
 * The admin tab recomputes from live tables every load, which is right for a
 * dashboard and useless as a baseline: Close keeps reconciling outcomes for
 * weeks, so the "before" numbers keep moving after the change they are meant
 * to be measured against. This writes them down once.
 *
 * Usage:  node scripts/funnel-baseline-snapshot.mjs [--out docs/marketing/...]
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = process.cwd();

// .env.local goes into the process BEFORE anything is imported: the module
// chain reaches src/lib/config.ts, which validates the environment the moment
// it loads and throws if a key is missing.
const env = readEnv(path.join(ROOT, ".env.local"));
for (const [name, value] of Object.entries(env)) {
  process.env[name] ??= value;
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(ROOT, "src"),
    // The pure module reaches funnel-cohort for the maturity constants, and
    // that file's import chain reaches a server-only module. Same shim the
    // test runner uses.
    "server-only": path.join(ROOT, "vitest.server-only-shim.ts"),
  },
  interopDefault: true,
});

const { buildFunnelMonthly, FUNNEL_REBUILD_DAY } = await jiti.import(
  path.join(ROOT, "src/lib/services/funnel-monthly.ts"),
);

const HEADERS = [
  "Visits",
  "Leads",
  "Opt-in %",
  "Qs offered",
  "Qs left",
  "Qs done %",
  "Booked",
  "Book %",
  "Held",
  "Show %",
  "Won",
  "Win %",
  "Revenue",
];

const now = new Date();
const [leads, visits, shows, sessions] = await Promise.all([
  read(
    "lead_submissions",
    "id,email,full_name,created_at,source_path,call_booked_at,closed_won_at,closed_won_value",
    "created_at",
  ),
  read("ga4_page_views", "day,landing_page,sessions", "day"),
  read(
    "close_lead_funnel",
    "email,first_sales_call_booked_date,first_call_show_up",
    "lead_id",
  ),
  read(
    "qualification_sessions",
    "lead_submission_id,completed_at,answer_count",
    "created_at",
  ),
]);

const report = buildFunnelMonthly({ leads, visits, shows, sessions, now });
const outPath =
  argValue("--out") ??
  `docs/marketing/funnel-baseline-${now.toISOString().slice(0, 10)}.md`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, render(report), "utf8");
console.log(`Wrote ${outPath}`);

function render(report) {
  const lines = [];
  lines.push(
    `# Funnel conversion baseline — ${now.toISOString().slice(0, 10)}`,
  );
  lines.push("");
  lines.push(
    `Frozen snapshot. The admin tab recomputes from live tables and will drift from this as Close reconciles later outcomes; this file is the record of where we started. Booking funnels were rebuilt on **${FUNNEL_REBUILD_DAY}**.`,
  );
  lines.push("");
  lines.push("## How to read it");
  lines.push("");
  lines.push("- A dash means not observed. It is never a zero.");
  lines.push(
    `- **Opt-in %** is measured only over days GA4 had finished counting (through ${report.visitsThrough ?? "—"}), on both sides of the division.`,
  );
  lines.push(
    "- **Qs** is the questions after the contact details. Somebody who typed into the form and left before the first submit writes no row anywhere, so they are not counted here or anywhere else.",
  );
  lines.push(
    `- **Show %** covers ${pct(report.showCoverage.pct)} of booked calls (${report.showCoverage.known} of ${report.showCoverage.total} old enough to judge carry a yes/no in Close). The rest leave the denominator rather than counting as no-shows.`,
  );
  lines.push(
    "- **Win %** waits 30 days. The Won count does not — a sale is a fact the day it happens; the rate only opens once the calls behind it are old enough that a missing sale means something.",
  );
  lines.push(
    "- Every row is a lead cohort: the month is the month the person arrived, and their later booking, call and sale count in that month whenever they happened.",
  );
  lines.push("");

  if (report.beforeAfter) {
    const { before, after, changedOn } = report.beforeAfter;
    lines.push(`## Either side of the rebuild (${changedOn})`);
    lines.push("");
    lines.push(
      `${after.label} against ${before.label} — same weekdays, a week apart.`,
    );
    lines.push("");
    if (after.visitsEnd && after.visitsEnd < after.end) {
      lines.push(
        `> Visit counts in the later window stop at ${after.visitsEnd}, so it holds fewer days of traffic than the earlier one. The rates are unaffected — both sides of each division use the same days — but do not read the two visit totals against each other.`,
      );
      lines.push("");
    }
    lines.push(
      table(
        ["Window", ...HEADERS],
        [row(before.label, before.totals), row(after.label, after.totals)],
      ),
    );
    lines.push("");
  }

  for (const month of report.months) {
    lines.push(`## ${month.label}`);
    lines.push("");
    lines.push(
      table(
        ["Funnel", ...HEADERS],
        [
          ...month.rows.map((r) =>
            row(r.isBookingFunnel ? `${r.funnel} *` : r.funnel, r),
          ),
          row("**All funnels**", month.totals),
        ],
      ),
    );
    lines.push("");
    lines.push(
      "`*` = a registered booking funnel. Everything else is a page that happens to carry a form.",
    );
    lines.push("");
  }

  lines.push(
    `Generated ${report.generatedAt} by \`scripts/funnel-baseline-snapshot.mjs\`.`,
  );
  lines.push("");
  return lines.join("\n");
}

function row(label, r) {
  return [
    label,
    r.visits ?? "—",
    r.leads,
    pct(r.rates.visitToLead),
    r.questionsOffered || "—",
    r.questionsOffered ? r.questionsAbandoned : "—",
    pct(r.rates.questionsCompleted),
    r.booked,
    pct(r.rates.leadToBook),
    r.showable ? r.held : "—",
    pct(r.rates.bookToShow),
    r.won,
    pct(r.rates.showToWin),
    r.revenue === null
      ? "—"
      : `$${r.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  ];
}

function table(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, rule, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function pct(value) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [
          line.slice(0, at).trim(),
          line
            .slice(at + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

/** PostgREST caps a response at 1000 rows; walk until a short page. */
async function read(table, select, order) {
  const rows = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${order}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Range: `${from}-${from + 999}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`${table}: ${response.status} ${await response.text()}`);
    }
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}
