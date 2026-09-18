import { isInternalLead } from "@/lib/services/admin-analytics-internal";

/**
 * THE definition of a lead. Every surface that counts leads — the analytics
 * tabs, the channel spine, the reporting API — goes through `collapseToLeads`,
 * so a lead is counted the same way everywhere or not at all.
 *
 * A lead is one person who gave us a name and email on the site (any form, at
 * the contact step) or an email to the site chatbot:
 *
 *  - One person, not one submit. The same email again within
 *    REPEAT_WINDOW_DAYS of their previous submission is the same lead. Before
 *    this, 597 August rows were 539 people: /contact then /book-now counted
 *    twice. Rolling days, not calendar month, so the rule is additive by day
 *    and a month, a 30-day range and the daily spine all agree.
 *  - Newsletter signups are subscribers, not leads.
 *  - Test and internal submissions are excluded unless asked for.
 *
 * Client-safe: pure, no server imports.
 */
export const REPEAT_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export const LEAD_DEFINITION = {
  title: "What counts as a lead",
  body: "One person who gave their name and email on a vendingpreneurs.com form, or an email to the site chatbot. Counted when they submit contact details, before the questions or a booking. The same email again within 30 days is the same lead.",
  notLeads:
    "Not leads: newsletter signups, test and team submissions, webinar registrations, off-site GHL forms (Instagram lead magnets, VSL) and ManyChat contacts. Channels shows the last three as Registrations & contacts.",
} as const;

export type LeadLike = {
  email: string | null;
  created_at: string;
  full_name?: string | null;
  lifecycle_status?: string | null;
};

export function isNewsletterSignup(row: {
  lifecycle_status?: string | null;
}): boolean {
  return row.lifecycle_status === "newsletter_subscribed";
}

/**
 * Outcomes that may land on any of one person's rows (they booked from the
 * second form, say). The lead keeps its first row's attribution and takes the
 * first observed value of each of these from the rows it absorbed.
 */
const OUTCOME_KEYS = [
  "call_booked_at",
  "call_outcome",
  "closed_won_at",
  "closed_won_value",
  "closed_won_source",
  "latest_qualification_completed_at",
  "qualification_summary",
] as const;

/**
 * Rows in, leads out: one row per lead, the person's first submission in each
 * run of submissions no more than REPEAT_WINDOW_DAYS apart, with outcomes
 * folded in from the rest. Input order does not matter; output is by
 * created_at. Returns new objects; input rows are not modified.
 *
 * Callers counting a window must read from `lookbackStart(windowStart)` so a
 * repeat whose first submission falls just before the window is recognised,
 * then keep the leads created inside the window (`inLeadWindow`).
 */
export function collapseToLeads<T extends LeadLike>(
  rows: readonly T[],
  options: { includeInternal?: boolean } = {},
): T[] {
  return groupLeads(rows, options).map((group) => group.lead);
}

/**
 * The same collapse, keeping which rows each lead absorbed, for readers that
 * join other tables on the row id (qualification sessions, say).
 */
export function groupLeads<T extends LeadLike>(
  rows: readonly T[],
  options: { includeInternal?: boolean } = {},
): { lead: T; rows: T[] }[] {
  const eligible = rows
    .filter((row) => !isNewsletterSignup(row))
    .filter(
      (row) =>
        options.includeInternal || !isInternalLead(row.email, row.full_name),
    )
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const groups: { lead: T; rows: T[] }[] = [];
  const openByEmail = new Map<string, { index: number; lastAt: number }>();

  for (const row of eligible) {
    const email = row.email?.trim().toLowerCase() ?? "";
    const at = new Date(row.created_at).getTime();
    const open = email ? openByEmail.get(email) : undefined;

    if (open && at - open.lastAt <= REPEAT_WINDOW_DAYS * DAY_MS) {
      const group = groups[open.index];
      groups[open.index] = {
        lead: absorb(group.lead, row),
        rows: [...group.rows, row],
      };
      openByEmail.set(email, { index: open.index, lastAt: at });
      continue;
    }
    groups.push({ lead: { ...row }, rows: [row] });
    if (email) openByEmail.set(email, { index: groups.length - 1, lastAt: at });
  }
  return groups;
}

function absorb<T extends LeadLike>(lead: T, repeat: T): T {
  const merged: Record<string, unknown> = { ...lead };
  const from = repeat as Record<string, unknown>;
  for (const key of OUTCOME_KEYS) {
    if (!(key in from)) continue;
    if (merged[key] == null && from[key] != null) merged[key] = from[key];
  }
  if (repeat.lifecycle_status === "qualified") {
    merged.lifecycle_status = "qualified";
  }
  return merged as T;
}

/** Where a windowed read must start so repeats are recognised. */
export function lookbackStart(windowStart: Date | string): Date {
  const start =
    typeof windowStart === "string" ? new Date(windowStart) : windowStart;
  return new Date(start.getTime() - REPEAT_WINDOW_DAYS * DAY_MS);
}

/** Half-open [start, end) on created_at. */
export function inLeadWindow(
  lead: { created_at: string },
  start: Date,
  end: Date,
): boolean {
  const at = new Date(lead.created_at).getTime();
  return at >= start.getTime() && at < end.getTime();
}
