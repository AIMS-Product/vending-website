/**
 * Rebuild Jess's marketing MTD reference (handoff of 2026-10-14) from our
 * Close mirror and Close itself, read-only, with the dashboard's own rules.
 *
 *   npx tsx --env-file=.env.local scripts/marketing-mtd-validate.ts [YYYY-MM-DD]
 *
 * The date (default 2026-10-14) is the current month's last day; its prior
 * month to the same day is checked against Jess's certified September figures
 * when it is Oct 14. Exit 0 = September matches, 2 = differences, 1 = error.
 * October is printed beside her 11 AM snapshot: Close is live, so it drifts.
 */
import {
  buildGoalPlan,
  buildMarketingMtd,
  median,
} from "../src/lib/services/marketing-mtd";
import type { CloseCall } from "../src/lib/services/close-week-view";
import type { CloseDeal } from "../src/lib/services/close-wins";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOSE = process.env.CLOSE_API_KEY;
if (!SUPABASE || !SERVICE || !CLOSE) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CLOSE_API_KEY must be set.",
  );
  process.exit(1);
}

/** Jess's handoff, "Reference metric" and acceptance criteria. */
const SEPTEMBER = {
  booked: 154,
  shown: 95,
  qualified: 66,
  rawQualified: 73,
  won: 15,
  revenue: 103_290,
  cycle: 10,
  cycleN: 15,
};
const OCTOBER_SNAPSHOT = {
  booked: 122,
  shown: 74,
  qualified: 54,
  rawQualified: 57,
  won: 10,
  revenue: 73_679,
  cycle: 8,
  cycleN: 10,
};

async function mirror<Row>(query: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${SUPABASE}/rest/v1/${query}`, {
      headers: {
        apikey: SERVICE!,
        Authorization: `Bearer ${SERVICE}`,
        Range: `${offset}-${offset + 999}`,
      },
    });
    if (!response.ok)
      throw new Error(`mirror ${response.status}: ${await response.text()}`);
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function close<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.close.com/api/v1/${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLOSE}:`).toString("base64")}`,
    },
  });
  if (!response.ok) throw new Error(`Close ${path}: ${response.status}`);
  return (await response.json()) as T;
}

type LeadRow = {
  lead_id: string;
  display_name: string | null;
  funnel: string | null;
  status_label: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
  qualified: string | null;
  lead_owner: string | null;
  business_line: string | null;
  lead_created_at: string | null;
};
type Opportunity = {
  id: string;
  lead_id: string;
  date_won: string | null;
  value: number | null;
  user_id: string | null;
};

async function main() {
  const today = process.argv[2] ?? "2026-10-14";
  const current = { from: `${today.slice(0, 7)}-01`, to: today };
  const priorFrom = (() => {
    const [y, m] = current.from.split("-").map(Number) as [number, number];
    return m === 1
      ? `${y - 1}-12-01`
      : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  })();

  const leads = await mirror<LeadRow>(
    `close_lead_funnel?select=lead_id,display_name,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,lead_owner,business_line,lead_created_at&first_sales_call_booked_date=gte.${priorFrom}&first_sales_call_booked_date=lte.${today}&order=lead_id`,
  );
  const calls: CloseCall[] = leads.map((row) => ({
    leadId: row.lead_id,
    funnel: row.funnel,
    status: row.status_label,
    bookedDate: row.first_sales_call_booked_date!,
    showUp: row.first_call_show_up,
    qualified: row.qualified,
    leadOwner: row.lead_owner,
    businessLine: row.business_line,
  }));

  const opportunities: Opportunity[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await close<{ data: Opportunity[]; has_more: boolean }>(
      `opportunity/?status_type=won&date_won__gte=${priorFrom}&date_won__lte=${today}&_limit=100&_skip=${skip}&_fields=id,lead_id,date_won,value,user_id`,
    );
    opportunities.push(...page.data);
    if (!page.has_more) break;
  }
  const ids = [...new Set(opportunities.map((o) => o.lead_id))];
  const byLead = new Map<
    string,
    Pick<
      LeadRow,
      "funnel" | "status_label" | "business_line" | "lead_created_at"
    >
  >();
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await mirror<LeadRow>(
      `close_lead_funnel?select=lead_id,funnel,status_label,business_line,lead_created_at&lead_id=in.(${ids.slice(i, i + 100).join(",")})`,
    );
    for (const row of rows) byLead.set(row.lead_id, row);
  }
  for (const id of ids.filter((x) => !byLead.has(x))) {
    const lead = await close<{
      status_label: string | null;
      date_created: string | null;
      custom?: Record<string, unknown>;
    }>(`lead/${id}/?_fields=status_label,date_created,custom`);
    const text = (value: unknown) =>
      typeof value === "string" && value.trim() ? value : null;
    byLead.set(id, {
      funnel: text(lead.custom?.["Funnel Name DEAL (Opp)"]),
      status_label: lead.status_label,
      business_line: text(lead.custom?.["BTC Business Line"]),
      lead_created_at: lead.date_created,
    });
  }
  const deals: CloseDeal[] = opportunities.flatMap((o) =>
    o.date_won
      ? [
          {
            id: o.id,
            leadId: o.lead_id,
            dateWon: o.date_won.slice(0, 10),
            value: o.value === null ? null : o.value / 100,
            funnel: byLead.get(o.lead_id)?.funnel ?? null,
            closer: null,
            closerId: o.user_id,
            status: byLead.get(o.lead_id)?.status_label ?? null,
            businessLine: byLead.get(o.lead_id)?.business_line ?? null,
            leadCreatedAt: byLead.get(o.lead_id)?.lead_created_at ?? null,
          },
        ]
      : [],
  );

  const mtd = buildMarketingMtd({ calls, deals, current });
  const summary = (f: typeof mtd.total.current) => ({
    booked: f.booked,
    shown: f.shown,
    qualified: f.qualified,
    rawQualified: f.qualified + f.conflicts.length,
    won: f.won,
    revenue: Math.round(f.revenue),
    cycle: median(f.cycleDays),
    cycleN: f.cycleDays.length,
  });
  const prior = summary(mtd.total.prior);
  const now = summary(mtd.total.current);
  console.log(`${mtd.prior.from}..${mtd.prior.to}`, prior);
  console.log(`${mtd.current.from}..${mtd.current.to}`, now);
  console.log(
    "channels",
    mtd.rows
      .map((row) => `${row.label} ${row.current.booked}/${row.prior.booked}`)
      .join(", "),
  );
  console.log("goal", buildGoalPlan({ booked: now.booked, today }));

  if (today !== "2026-10-14") return 0;
  console.log("Oct vs Jess's 11 AM snapshot", OCTOBER_SNAPSHOT);
  const diffs = (Object.keys(SEPTEMBER) as (keyof typeof SEPTEMBER)[]).filter(
    (key) => prior[key] !== SEPTEMBER[key],
  );
  for (const key of diffs)
    console.log(`September ${key}: ours ${prior[key]}, Jess ${SEPTEMBER[key]}`);
  console.log(
    diffs.length === 0
      ? "September matches Jess exactly."
      : `${diffs.length} September differences.`,
  );
  return diffs.length === 0 ? 0 : 2;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
