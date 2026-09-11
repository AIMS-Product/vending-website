import { INSTAGRAM_DM_CHANNEL } from "@/lib/analytics/channel";
import type { Tables } from "@/types/database";
import {
  type ChannelFact,
  pairedPct,
  pct,
  sumObserved,
} from "@/lib/services/channel-report-rollup";

/**
 * The Lead Gen KPI Framework (Adam's sheet, 2026-09-11) as a report: four
 * sections, one row per asset / event / workflow / rep, the sheet's columns.
 * Pure and client-safe; `getKpiTab` fetches the inputs.
 *
 * Every rate is paired (both sides observed on the same rows) and null means
 * not observed, never zero. Each section says which date basis it uses.
 */

export type KpiFormat = "number" | "money" | "percent";
export type KpiColumn = { key: string; label: string; format: KpiFormat };

export type KpiRow = {
  key: string;
  label: string;
  detail: string | null;
  values: Record<string, number | null>;
  sourceOfTruth: string;
  owner: string | null;
  cadence: string;
  /** Oldest last-run among the connectors behind the row; null if any never ran. */
  lastVerified: string | null;
};

export type KpiSection = {
  key: string;
  title: string;
  basis: string;
  columns: KpiColumn[];
  rows: KpiRow[];
  /** Rows with nothing beyond visits or reach, left out to keep the table clean. */
  hidden: number;
};

export type KpiReport = { sections: KpiSection[] };

export type WebinarEventRow = Pick<
  Tables<"webinar_events">,
  | "date"
  | "label"
  | "format"
  | "registrations"
  | "attendees"
  | "booked_night_of"
  | "showed"
  | "won"
  | "revenue"
  | "spend"
>;

export type EmailSnapshotRow = Pick<
  Tables<"ghl_email_stats">,
  | "snapshot_day"
  | "workflow_id"
  | "workflow_name"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
>;

/** A lead whose sales call was booked in range, on the booking date. */
export type SetterBookingRow = {
  booked_by_setter: string | null;
  call_outcome: string | null;
  closed_won_at: string | null;
};

export type KpiInput = {
  /** Spine facts for the range, already through `normaliseFacts`. */
  facts: ChannelFact[];
  webinars: WebinarEventRow[];
  emailSnapshots: EmailSnapshotRow[];
  setterBookings: SetterBookingRow[];
  /** Connector name to its last finished run (ISO), null when it never ran. */
  lastRun: Record<string, string | null>;
};

/** Owners and cadence from the framework sheet. Unlisted channels show none. */
export const KPI_OWNERS: Record<string, { owner: string; cadence: string }> = {
  YouTube: { owner: "Ayman", cadence: "Weekly" },
  Instagram: { owner: "Makenna", cadence: "Weekly" },
  [INSTAGRAM_DM_CHANNEL]: { owner: "Makenna", cadence: "Weekly" },
  Website: { owner: "Adam", cadence: "Weekly" },
  Chatbot: { owner: "Adam", cadence: "Weekly" },
  Webinar: {
    owner: "Anthony + Marc; Adam (systems)",
    cadence: "Per event + weekly",
  },
  Email: { owner: "Lujan", cadence: "Weekly" },
  SMS: { owner: "Lujan", cadence: "Weekly" },
  Newsletter: { owner: "Lujan", cadence: "Weekly" },
  "Lane 2": { owner: "Anthony (AK)", cadence: "Weekly" },
};

const PATH_LABEL: Record<string, string> = {
  "book-call": "Direct booking",
  "lead-magnet": "Lead magnet",
  apply: "Apply",
  "webinar-register": "Webinar registration",
  content: "Content",
  none: "No CTA",
  unknown: "Untracked path",
};

const RE_ENGAGEMENT_CHANNELS = new Set(["Email", "SMS", "Newsletter"]);

const FUNNEL_COLUMNS: KpiColumn[] = [
  { key: "reach", label: "Views / reach", format: "number" },
  { key: "ctr", label: "CTR", format: "percent" },
  { key: "visits", label: "Landing page visits", format: "number" },
  { key: "optIn", label: "Opt-in %", format: "percent" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "leadToBook", label: "Lead to book %", format: "percent" },
  { key: "booked", label: "First booked calls", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Calls shown", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Closed won", format: "number" },
  { key: "leadToClose", label: "Lead to close %", format: "percent" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "spend", label: "Spend", format: "money" },
  { key: "costPerBooked", label: "Cost / booked call", format: "money" },
];

const WEBINAR_COLUMNS: KpiColumn[] = [
  { key: "registrations", label: "Registrations", format: "number" },
  { key: "attendanceRate", label: "Attendance %", format: "percent" },
  { key: "attendees", label: "Attendees", format: "number" },
  { key: "regToBook", label: "Registration to book %", format: "percent" },
  { key: "booked", label: "First booked calls", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Calls shown", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Closed won", format: "number" },
  { key: "regToClose", label: "Registration to close %", format: "percent" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "spend", label: "Spend", format: "money" },
  { key: "costPerBooked", label: "Cost / booked call", format: "money" },
];

const RE_ENGAGEMENT_COLUMNS: KpiColumn[] = [
  { key: "sent", label: "Sent", format: "number" },
  { key: "deliveryRate", label: "Delivery %", format: "percent" },
  { key: "delivered", label: "Delivered", format: "number" },
  { key: "opened", label: "Opened", format: "number" },
  { key: "clicked", label: "Clicked", format: "number" },
  { key: "replyRate", label: "Reply %", format: "percent" },
  { key: "replied", label: "Replies", format: "number" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "leadToBook", label: "Lead to book %", format: "percent" },
  { key: "booked", label: "First booked calls", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Calls shown", format: "number" },
  { key: "won", label: "Closed won", format: "number" },
];

const LANE2_COLUMNS: KpiColumn[] = [
  { key: "leads", label: "New conversations", format: "number" },
  { key: "clicks", label: "Booking links sent", format: "number" },
  { key: "booked", label: "First booked calls", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Calls shown", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Closed won", format: "number" },
];

/** Which connector observes each spine metric, for "source of truth". */
const METRIC_CONNECTOR: Array<
  [keys: ReadonlyArray<keyof ChannelFact>, connector: string]
> = [
  [["visits"], "ga4-visits"],
  [["leads", "booked", "showed", "won"], "leads"],
  [["impressions", "reach"], "metricool-posts"],
  [["clicks"], "bitly-clicks"],
  [["spend"], "webinar-ingest"],
];

export function buildKpiReport(input: KpiInput): KpiReport {
  return {
    sections: [
      buildFunnelSection(input),
      buildWebinarSection(input),
      buildReEngagementSection(input),
      buildLane2Section(input),
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 1: content and website funnels, one row per channel x CTA path.
// ---------------------------------------------------------------------------

function buildFunnelSection(input: KpiInput): KpiSection {
  const groups = new Map<string, ChannelFact[]>();
  for (const fact of input.facts) {
    if (fact.channel === "Webinar") continue;
    if (fact.channel === INSTAGRAM_DM_CHANNEL) continue;
    if (RE_ENGAGEMENT_CHANNELS.has(fact.channel)) continue;
    const id = `${fact.channel}|${fact.destination}`;
    groups.set(id, [...(groups.get(id) ?? []), fact]);
  }

  const rows: KpiRow[] = [];
  let hidden = 0;
  for (const [id, facts] of groups) {
    const [channel, destination] = id.split("|") as [string, string];
    const values = funnelValues(facts);
    if (!hasOutcome(values)) {
      hidden += 1;
      continue;
    }
    rows.push({
      key: id,
      label: channel,
      detail: PATH_LABEL[destination] ?? destination,
      values,
      ...provenance(facts, input.lastRun),
      ...ownerFor(channel),
    });
  }
  rows.sort(byOutcome);

  return {
    key: "funnels",
    title: "Content and website funnels",
    basis:
      "Booked, shown and won are credited to the day the lead arrived, so every rate is over one cohort. Row = channel x CTA path (utm_term).",
    columns: FUNNEL_COLUMNS,
    rows,
    hidden,
  };
}

function funnelValues(facts: ChannelFact[]): Record<string, number | null> {
  const spend = sumObserved(facts.map((fact) => fact.spend));
  const booked = sumObserved(facts.map((fact) => fact.booked));
  return {
    reach: sumObserved(facts.map((fact) => fact.reach ?? fact.impressions)),
    ctr: pairedPct(facts, "clicks", "impressions"),
    visits: sumObserved(facts.map((fact) => fact.visits)),
    optIn: pairedPct(facts, "leads", "visits"),
    leads: sumObserved(facts.map((fact) => fact.leads)),
    leadToBook: pairedPct(facts, "booked", "leads"),
    booked,
    showRate: pairedPct(facts, "showed", "booked"),
    showed: sumObserved(facts.map((fact) => fact.showed)),
    closeRate: pairedPct(facts, "won", "showed"),
    won: sumObserved(facts.map((fact) => fact.won)),
    leadToClose: pairedPct(facts, "won", "leads"),
    revenue: sumObserved(facts.map((fact) => fact.revenue)),
    spend,
    costPerBooked: ratio(spend, booked),
  };
}

// ---------------------------------------------------------------------------
// Section 2: webinar funnel, one row per event plus a total.
// ---------------------------------------------------------------------------

function buildWebinarSection(input: KpiInput): KpiSection {
  const events = [...input.webinars].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const owner = ownerFor("Webinar");
  const meta = {
    sourceOfTruth: "webinar-ingest (GHL + Zoom + Close)",
    lastVerified: input.lastRun["webinar-ingest"] ?? null,
    ...owner,
  };
  const rows: KpiRow[] = events.map((event) => ({
    key: `webinar|${event.date}|${event.label}`,
    label: event.label,
    detail: `${event.date} · ${event.format}`,
    values: webinarValues([event]),
    ...meta,
  }));
  if (events.length > 1) {
    rows.unshift({
      key: "webinar|all",
      label: "All webinars",
      detail: `${events.length} events`,
      values: webinarValues(events),
      ...meta,
    });
  }
  return {
    key: "webinar",
    title: "Webinar funnel",
    basis:
      "One row per event. Booked = calls booked the night of; registration page visits are not observed (the page is GHL-hosted).",
    columns: WEBINAR_COLUMNS,
    rows,
    hidden: 0,
  };
}

function webinarValues(
  events: WebinarEventRow[],
): Record<string, number | null> {
  const sum = (key: keyof WebinarEventRow) =>
    sumObserved(events.map((event) => event[key] as number | null));
  const registrations = sum("registrations");
  const attendees = sum("attendees");
  const booked = sum("booked_night_of");
  const showed = sum("showed");
  const won = sum("won");
  const spend = sum("spend");
  return {
    registrations,
    attendanceRate: pct(attendees, registrations),
    attendees,
    regToBook: pct(booked, registrations),
    booked,
    showRate: pct(showed, booked),
    showed,
    closeRate: pct(won, showed),
    won,
    regToClose: pct(won, registrations),
    revenue: sum("revenue"),
    spend,
    costPerBooked: ratio(spend, booked),
  };
}

// ---------------------------------------------------------------------------
// Section 3: marketing re-engagement. GHL reports lifetime totals per
// workflow; the difference between the first and last snapshot in range is
// what was sent in range. One snapshot means nothing to difference: null.
// ---------------------------------------------------------------------------

function buildReEngagementSection(input: KpiInput): KpiSection {
  const byWorkflow = new Map<string, EmailSnapshotRow[]>();
  for (const snapshot of input.emailSnapshots) {
    byWorkflow.set(snapshot.workflow_id, [
      ...(byWorkflow.get(snapshot.workflow_id) ?? []),
      snapshot,
    ]);
  }
  const owner = ownerFor("Email");
  const rows: KpiRow[] = [];
  let hidden = 0;
  for (const [workflowId, snapshots] of byWorkflow) {
    const ordered = [...snapshots].sort((a, b) =>
      a.snapshot_day.localeCompare(b.snapshot_day),
    );
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const diff = (
      key: "sent" | "delivered" | "opened" | "clicked" | "replied",
    ) => (ordered.length > 1 ? Math.max(0, last[key] - first[key]) : null);
    const sent = diff("sent");
    const delivered = diff("delivered");
    const replied = diff("replied");
    if (sent == null || sent === 0) {
      hidden += 1;
      continue;
    }
    rows.push({
      key: `workflow|${workflowId}`,
      label: last.workflow_name,
      detail: "GHL email workflow",
      values: {
        sent,
        deliveryRate: pct(delivered, sent),
        delivered,
        opened: diff("opened"),
        clicked: diff("clicked"),
        replyRate: pct(replied, delivered),
        replied,
        leads: null,
        leadToBook: null,
        booked: null,
        showRate: null,
        showed: null,
        won: null,
      },
      sourceOfTruth: "ghl-email (snapshot difference)",
      lastVerified: input.lastRun["ghl-email"] ?? null,
      ...owner,
    });
  }
  rows.sort((a, b) => (b.values.sent ?? 0) - (a.values.sent ?? 0));

  const facts = input.facts.filter((fact) =>
    RE_ENGAGEMENT_CHANNELS.has(fact.channel),
  );
  if (facts.length > 0) {
    rows.push({
      key: "re-engagement|spine",
      label: "Email + SMS links",
      detail: "Leads and bookings from tagged ghl_email / ghl_sms links",
      values: {
        sent: null,
        deliveryRate: null,
        delivered: null,
        opened: null,
        clicked: sumObserved(facts.map((fact) => fact.clicks)),
        replyRate: null,
        replied: null,
        leads: sumObserved(facts.map((fact) => fact.leads)),
        leadToBook: pairedPct(facts, "booked", "leads"),
        booked: sumObserved(facts.map((fact) => fact.booked)),
        showRate: pairedPct(facts, "showed", "booked"),
        showed: sumObserved(facts.map((fact) => fact.showed)),
        won: sumObserved(facts.map((fact) => fact.won)),
      },
      ...provenance(facts, input.lastRun),
      ...owner,
    });
  }

  return {
    key: "re-engagement",
    title: "Marketing re-engagement",
    basis:
      "Sends are the change in GHL's lifetime totals across the range. GHL has no per-workflow SMS stats; SMS shows only through tagged links.",
    columns: RE_ENGAGEMENT_COLUMNS,
    rows,
    hidden,
  };
}

// ---------------------------------------------------------------------------
// Section 4: Lane 2. Setters by booking date (the sheet's "First Sales Call
// Booked Date"), plus the Instagram DM stage funnel from ManyChat.
// ---------------------------------------------------------------------------

function buildLane2Section(input: KpiInput): KpiSection {
  const bySetter = new Map<string, SetterBookingRow[]>();
  for (const booking of input.setterBookings) {
    const setter = booking.booked_by_setter?.trim() || "Unassigned";
    bySetter.set(setter, [...(bySetter.get(setter) ?? []), booking]);
  }
  const owner = ownerFor("Lane 2");
  const rows: KpiRow[] = [];
  const setterRow = (label: string, bookings: SetterBookingRow[]): KpiRow => {
    const booked = bookings.length;
    const showed = bookings.filter(
      (b) => b.call_outcome !== "no_show" && b.call_outcome !== "canceled",
    ).length;
    const won = bookings.filter(
      (b) => Boolean(b.closed_won_at) || b.call_outcome === "won",
    ).length;
    return {
      key: `setter|${label}`,
      label,
      detail: "Setter, by booking date",
      values: {
        leads: null,
        clicks: null,
        booked,
        showRate: pct(showed, booked),
        showed,
        closeRate: pct(won, showed),
        won,
      },
      sourceOfTruth:
        "lead_submissions (booked_by_setter, call_outcome, closed_won_at)",
      lastVerified: input.lastRun.leads ?? null,
      ...owner,
    };
  };
  if (input.setterBookings.length > 0) {
    rows.push(setterRow("Team total", input.setterBookings));
    for (const [setter, bookings] of [...bySetter].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      rows.push(setterRow(setter, bookings));
    }
  }

  const dm = input.facts.filter(
    (fact) => fact.channel === INSTAGRAM_DM_CHANNEL,
  );
  if (dm.length > 0) {
    rows.push({
      key: "lane2|instagram-dm",
      label: INSTAGRAM_DM_CHANNEL,
      detail: "ManyChat stages (Pearl)",
      values: {
        leads: sumObserved(dm.map((fact) => fact.leads)),
        clicks: sumObserved(dm.map((fact) => fact.clicks)),
        booked: sumObserved(dm.map((fact) => fact.booked)),
        showRate: pairedPct(dm, "showed", "booked"),
        showed: sumObserved(dm.map((fact) => fact.showed)),
        closeRate: pairedPct(dm, "won", "showed"),
        won: sumObserved(dm.map((fact) => fact.won)),
      },
      sourceOfTruth: "manychat-ingest",
      lastVerified: input.lastRun["manychat-ingest"] ?? null,
      ...ownerFor(INSTAGRAM_DM_CHANNEL),
    });
  }

  return {
    key: "lane2",
    title: "Lane 2",
    basis:
      "Setter rows count calls by the date they were booked, not by lead cohort. Instagram DM counts ManyChat stage events.",
    columns: LANE2_COLUMNS,
    rows,
    hidden: 0,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

function ownerFor(channel: string): { owner: string | null; cadence: string } {
  const entry = KPI_OWNERS[channel];
  return { owner: entry?.owner ?? null, cadence: entry?.cadence ?? "Weekly" };
}

/** Connectors that observed something in these facts, and the oldest run among them. */
function provenance(
  facts: ChannelFact[],
  lastRun: Record<string, string | null>,
): { sourceOfTruth: string; lastVerified: string | null } {
  const connectors: string[] = [];
  for (const [keys, connector] of METRIC_CONNECTOR) {
    if (facts.some((fact) => keys.some((key) => fact[key] != null)))
      connectors.push(connector);
  }
  if (connectors.length === 0)
    return { sourceOfTruth: "nothing observed", lastVerified: null };
  const runs = connectors.map((connector) => lastRun[connector] ?? null);
  const lastVerified = runs.includes(null)
    ? null
    : (runs as string[]).sort()[0]!;
  return { sourceOfTruth: connectors.join(" + "), lastVerified };
}

function hasOutcome(values: Record<string, number | null>): boolean {
  return ["leads", "booked", "won", "spend"].some(
    (key) => (values[key] ?? 0) > 0,
  );
}

function byOutcome(a: KpiRow, b: KpiRow): number {
  for (const key of ["leads", "booked", "visits", "reach"]) {
    const diff = (b.values[key] ?? 0) - (a.values[key] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.label.localeCompare(b.label);
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0)
    return null;
  return Math.round(numerator / denominator);
}

// ---------------------------------------------------------------------------
// CSV: one block per section, blank line between, so a sheet can IMPORT it.
// ---------------------------------------------------------------------------

export function kpiReportToCsv(report: KpiReport): string {
  const blocks = report.sections.map((section) => {
    const header = [
      "Section",
      "Row",
      "Detail",
      ...section.columns.map((column) => column.label),
      "Source of truth",
      "Owner",
      "Cadence",
      "Last verified",
    ];
    const lines = section.rows.map((row) => [
      section.title,
      row.label,
      row.detail ?? "",
      ...section.columns.map((column) =>
        csvNumber(row.values[column.key] ?? null),
      ),
      row.sourceOfTruth,
      row.owner ?? "",
      row.cadence,
      row.lastVerified ?? "",
    ]);
    return [header, ...lines]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\n");
  });
  return `${blocks.join("\n\n")}\n`;
}

function csvNumber(value: number | null): string {
  return value == null ? "" : String(value);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
