import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import {
  GOAL_CHANNELS,
  OTHER_CHANNEL,
  UNTRACKED_LABEL,
  channelKeyForFunnel,
} from "@/lib/services/channel-targets";
import { FIELD_LABELS } from "@/lib/services/close-lead-funnel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Won deals as Close records them: every won opportunity, dated by the day it
 * was won, credited to the lead's "Funnel Name DEAL (Opp)".
 *
 * This exists because every other won number on the dashboard hangs off a
 * row in our own lead table, and most buyers never filled a site form.
 * Webinar registrants register on GHL, so a webinar sale had nowhere to land
 * and the tabs printed 0 while Close held $145K of webinar deals since June.
 * These are never leads. They are the sales, by channel, from the system that
 * records the sale.
 */

export const CLOSE_WINS_SOURCE =
  'Close: every won deal, dated by the day it was won, credited to the lead\'s "Funnel Name DEAL (Opp)".';

export type CloseDeal = {
  leadId: string;
  dateWon: string;
  /** Dollars. Null when the deal carries no value in Close. */
  value: number | null;
  funnel: string | null;
  /**
   * The closer who won it — the opportunity's owner in Close.
   *
   * A win has always had two people behind it: whoever set the call and
   * whoever closed it. Only the funnel was ever recorded here, so "whose close
   * was that" could not be answered from this system at all, which is how a
   * deal ends up argued over in Slack. The setter lives on the booking
   * (`call-credit.ts`); this is the other half.
   */
  closer: string | null;
};

export type CloseWinRow = { label: string; won: number; revenue: number };

export type CloseWinsPeriod = {
  key: string;
  won: number;
  revenue: number;
  /** Won deals with no value in Close. Counted in `won`, absent from `revenue`. */
  unvalued: number;
  rows: CloseWinRow[];
};

export type CloseWinsReport =
  | {
      ok: true;
      periods: CloseWinsPeriod[];
      /** The same deals and the same totals, grouped by who closed them. */
      byCloser: CloseWinsPeriod[];
    }
  | { ok: false; error: string };

const LABEL_BY_KEY = new Map(
  [...GOAL_CHANNELS, OTHER_CHANNEL].map((channel) => [
    channel.key,
    channel.label,
  ]),
);

/** The channel a Close funnel rolls into, named as the goals page names it. */
export function closeChannelLabel(funnel: string | null): string {
  const key = channelKeyForFunnel(funnel);
  return key === null
    ? UNTRACKED_LABEL
    : (LABEL_BY_KEY.get(key) ?? OTHER_CHANNEL.label);
}

/** Who or what a deal is credited to. Channel by default, closer on request. */
export const byChannel = (deal: CloseDeal): string =>
  closeChannelLabel(deal.funnel);

/** The closer who won it, or a named gap rather than a blank row. */
export const byCloser = (deal: CloseDeal): string =>
  deal.closer ?? "No closer in Close";

/**
 * Groups deals into periods; `periodOf` returns null to leave a deal out.
 * `labelOf` picks the row each deal lands on, so the same arithmetic serves
 * "which channel won it" and "who closed it" — two questions, one code path,
 * no chance of the two disagreeing on the totals.
 */
export function summariseCloseWins(
  deals: readonly CloseDeal[],
  periodOf: (day: string) => string | null,
  labelOf: (deal: CloseDeal) => string = byChannel,
): CloseWinsPeriod[] {
  const periods = new Map<string, CloseWinsPeriod>();
  for (const deal of deals) {
    const key = periodOf(deal.dateWon);
    if (key === null) continue;
    const period = periods.get(key) ?? {
      key,
      won: 0,
      revenue: 0,
      unvalued: 0,
      rows: [],
    };
    const label = labelOf(deal);
    const existing = period.rows.find((row) => row.label === label);
    const row = existing ?? { label, won: 0, revenue: 0 };
    const value = deal.value ?? 0;
    const nextRow = { ...row, won: row.won + 1, revenue: row.revenue + value };
    periods.set(key, {
      ...period,
      won: period.won + 1,
      revenue: period.revenue + value,
      unvalued: period.unvalued + (deal.value === null ? 1 : 0),
      rows: existing
        ? period.rows.map((entry) => (entry === existing ? nextRow : entry))
        : [...period.rows, nextRow],
    });
  }
  return [...periods.values()]
    .map((period) => ({
      ...period,
      rows: [...period.rows].sort(
        (a, b) => b.revenue - a.revenue || b.won - a.won,
      ),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

type MirrorClient = Pick<SupabaseClient<Database>, "from">;
type WinsCloseClient = Pick<CloseClient, "listWonOpportunities" | "getLead">;

/**
 * Close reads for the reporting tabs, cached for five minutes (Adam,
 * 2026-09-22). Every load of Month over month and the Close view re-read every
 * won deal since January from Close, which was most of their load time and
 * what tripped Close's rate limit. Our own mirror is still read fresh; only
 * Close's answers are held, so revenue and closed-won can trail Close by up to
 * five minutes. Failures are never cached.
 */
const CLOSE_READ_CACHE_SECONDS = 300;

function liveCloseClient(): CloseClient {
  return createCloseClient({ apiKey: config.CLOSE_API_KEY });
}

const cachedWonOpportunities = unstable_cache(
  (from: string, to: string, skip: number) =>
    liveCloseClient().listWonOpportunities({ from, to, skip }),
  ["close-won-opportunities"],
  { revalidate: CLOSE_READ_CACHE_SECONDS },
);

const cachedLead = unstable_cache(
  (leadId: string) => liveCloseClient().getLead(leadId),
  ["close-lead-for-wins"],
  { revalidate: CLOSE_READ_CACHE_SECONDS },
);

export function cachedCloseReads(): WinsCloseClient {
  return {
    listWonOpportunities: ({ from, to, skip }) =>
      cachedWonOpportunities(from, to, skip),
    getLead: (leadId) => cachedLead(leadId),
  };
}

/** 100 per page; 50 pages is 5,000 wins, far above any range the tabs ask for. */
const MAX_PAGES = 50;
const LEAD_READ_CONCURRENCY = 4;

/**
 * Every won deal in [from, to] with its lead's funnel. The funnel comes from
 * our `close_lead_funnel` mirror when the lead is in it, and from Close
 * directly when it is not (the mirror only holds leads that booked a first
 * call, and some buyers never did).
 */
export async function fetchCloseDeals(input: {
  from: string;
  to: string;
  close: WinsCloseClient;
  mirror: MirrorClient;
}): Promise<CloseDeal[]> {
  const opportunities = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await input.close.listWonOpportunities({
      from: input.from,
      to: input.to,
      skip: page * 100,
    });
    opportunities.push(...(result.data ?? []));
    if (!result.has_more) break;
  }
  const dated = opportunities.flatMap((opportunity) =>
    opportunity.date_won
      ? [{ ...opportunity, dateWon: opportunity.date_won.slice(0, 10) }]
      : [],
  );

  const leadIds = [...new Set(dated.map((opportunity) => opportunity.lead_id))];
  const funnelByLead = new Map<string, string | null>();
  for (let from = 0; from < leadIds.length; from += 100) {
    const { data, error } = await input.mirror
      .from("close_lead_funnel")
      .select("lead_id,funnel")
      .in("lead_id", leadIds.slice(from, from + 100));
    if (error)
      throw new Error(`close_lead_funnel read failed: ${error.message}`);
    for (const row of data ?? []) funnelByLead.set(row.lead_id, row.funnel);
  }

  // A handful at a time, never all at once: every won lead the mirror lacks
  // is one Close read, and firing them together is what tripped Close's rate
  // limit on the month-over-month tab (2026-09-22).
  const missing = leadIds.filter((id) => !funnelByLead.has(id));
  let next = 0;
  const workers = Array.from(
    { length: Math.min(LEAD_READ_CONCURRENCY, missing.length) },
    async () => {
      while (next < missing.length) {
        const id = missing[next];
        next += 1;
        const lead = await input.close.getLead(id);
        const funnel = lead?.custom?.[FIELD_LABELS.funnel];
        funnelByLead.set(
          id,
          typeof funnel === "string" && funnel.trim() ? funnel : null,
        );
      }
    },
  );
  await Promise.all(workers);

  return dated.map((opportunity) => ({
    leadId: opportunity.lead_id,
    dateWon: opportunity.dateWon,
    value: opportunity.value === null ? null : opportunity.value / 100,
    funnel: funnelByLead.get(opportunity.lead_id) ?? null,
    closer: opportunity.user_name?.trim() || null,
  }));
}

/**
 * Won deals in [from, to], grouped by `periodOf`. Never throws: a Close
 * failure comes back as `ok: false` so the panel says Close could not be read
 * instead of printing 0.
 */
export async function getCloseWins(input: {
  from: string;
  to: string;
  periodOf: (day: string) => string | null;
  close?: WinsCloseClient;
  mirror?: MirrorClient;
}): Promise<CloseWinsReport> {
  const close =
    input.close ??
    (config.CLOSE_API_KEY
      ? createCloseClient({ apiKey: config.CLOSE_API_KEY })
      : null);
  if (!close) return { ok: false, error: "CLOSE_API_KEY is not set." };
  try {
    const deals = await fetchCloseDeals({
      from: input.from,
      to: input.to,
      close,
      mirror: input.mirror ?? createAdminClient(),
    });
    return {
      ok: true,
      periods: summariseCloseWins(deals, input.periodOf),
      byCloser: summariseCloseWins(deals, input.periodOf, byCloser),
    };
  } catch (error) {
    console.error("Close won-deal read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
