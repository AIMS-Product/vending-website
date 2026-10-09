/**
 * The funnel board: the sales floor's "Funnel Details" sheet, rebuilt on our
 * attribution.
 *
 * Population: every Close lead whose "First Sales Call Booked Date" falls in
 * the window, counted on that call day. That is the Q4 plan's booked-call
 * basis (`channel-targets.ts`), so the board's TOTAL row is Close's total.
 *
 * Credit: the sheet files each call under Close's "Funnel Name DEAL (Opp)".
 * Here, a call whose lead filled a form on vendingpreneurs.com is credited to
 * the channel that brought them to the site (`resolveChannel`, the rule every
 * other tab uses), taking the latest fill on or before the call day. A call
 * with no site fill keeps its Close funnel. The crosswalk shows every move, so
 * the two views reconcile call for call.
 *
 * Pure: no I/O. The loader is `funnel-board-data.ts`.
 */

import { resolveChannel } from "@/lib/analytics/channel";
import {
  isChatbotCapture,
  isInternalLead,
} from "@/lib/services/admin-analytics-internal";

export type BoardCall = {
  lead_id: string;
  email: string | null;
  display_name: string | null;
  funnel: string | null;
  first_sales_call_booked_date: string;
  setter_name: string | null;
};

export type BoardFill = {
  created_at: string;
  email: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  referrer: string | null;
  metadata: unknown;
  close_lead_id: string | null;
};

export type ChannelGroup =
  | "Website"
  | "Paid search"
  | "Social"
  | "Paid social"
  | "Webinar & email"
  | "Sales outbound"
  | "Other";

export const GROUP_ORDER: readonly ChannelGroup[] = [
  "Website",
  "Paid search",
  "Social",
  "Paid social",
  "Webinar & email",
  "Sales outbound",
  "Other",
];

const GROUP_OF: Record<string, ChannelGroup> = {
  Website: "Website",
  "Organic search": "Website",
  Chatbot: "Website",
  Referral: "Website",
  "AI assistants": "Website",
  "Google Ads": "Paid search",
  YouTube: "Social",
  Instagram: "Social",
  "Instagram DM": "Social",
  LinkedIn: "Social",
  X: "Social",
  TikTok: "Social",
  Facebook: "Social",
  Meta: "Social",
  "Meta Ads": "Paid social",
  Webinar: "Webinar & email",
  Newsletter: "Webinar & email",
  Email: "Webinar & email",
  "Reactivation Email": "Webinar & email",
  "Reactivation Scrapers": "Sales outbound",
  "Sales Reactivation": "Sales outbound",
};

export function groupFor(channel: string): ChannelGroup {
  return GROUP_OF[channel] ?? "Other";
}

/** A call whose lead has no funnel in Close and no site fill. */
export const NO_FUNNEL = "No funnel in Close";

/**
 * Close funnels that name the same thing as one of our channels, so a call
 * without a site fill lands on the same row as one with. Anything not listed
 * keeps Close's own name.
 */
const FUNNEL_AS_CHANNEL: Record<string, string> = {
  website: "Website",
  youtube: "YouTube",
  instagram: "Instagram",
  "anthony ig": "Instagram",
  linkedin: "LinkedIn",
  "google ads": "Google Ads",
  "meta ads": "Meta Ads",
  "internal webinar": "Webinar",
  newsletter: "Newsletter",
  "mike newsletter": "Newsletter",
};

export function channelOfFunnel(funnel: string | null): string {
  const name = funnel?.trim();
  if (!name) return NO_FUNNEL;
  return FUNNEL_AS_CHANNEL[name.toLowerCase()] ?? name;
}

const PACIFIC = "America/Los_Angeles";

export function pacificDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: PACIFIC });
}

/** The Monday on or before `day` (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** The channel a site fill came from, using the referrer when untagged. */
export function channelOfFill(fill: BoardFill): string {
  let source = fill.utm_source;
  if (!source?.trim() && fill.referrer) {
    try {
      source = new URL(fill.referrer).hostname;
    } catch {
      // A malformed referrer is an untagged visit, which resolves to Website.
      source = null;
    }
  }
  return resolveChannel(source, {
    medium: fill.utm_medium,
    capturedByChatbot: isChatbotCapture(fill.metadata),
  }).channel;
}

/** The fill that brought this lead to the call: latest on or before the call day. */
function creditingFill(
  call: BoardCall,
  fills: readonly BoardFill[],
): BoardFill | null {
  const before = fills
    .filter(
      (fill) =>
        pacificDay(fill.created_at) <= call.first_sales_call_booked_date,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return before[0] ?? null;
}

export type BoardRow = {
  channel: string;
  group: ChannelGroup;
  days: number[];
  total: number;
  /** Calls Close's own funnel field files under this row's name. */
  closeTotal: number;
};
export type BoardGroup = {
  group: ChannelGroup;
  rows: BoardRow[];
  days: number[];
  total: number;
};
export type CrosswalkRow = {
  channel: string;
  group: ChannelGroup;
  total: number;
  /** Close funnel name (as Close spells it) -> calls. */
  funnels: Record<string, number>;
};

export type FunnelBoard = {
  days: string[];
  groups: BoardGroup[];
  dayTotals: number[];
  total: number;
  /** Calls credited to a different row than Close's funnel puts them on. */
  moved: number;
  /** Calls whose lead filled a form on the site. */
  withSiteFill: number;
  crosswalk: CrosswalkRow[];
  closeFunnels: string[];
  setters: { name: string; calls: number }[];
  internalExcluded: number;
};

export function buildFunnelBoard(input: {
  calls: readonly BoardCall[];
  fills: readonly BoardFill[];
  days: readonly string[];
}): FunnelBoard {
  const index = new Map(input.days.map((day, i) => [day, i]));
  const fillsByLead = new Map<string, BoardFill[]>();
  const fillsByEmail = new Map<string, BoardFill[]>();
  for (const fill of input.fills) {
    if (fill.close_lead_id)
      fillsByLead.set(fill.close_lead_id, [
        ...(fillsByLead.get(fill.close_lead_id) ?? []),
        fill,
      ]);
    const email = fill.email?.trim().toLowerCase();
    if (email)
      fillsByEmail.set(email, [...(fillsByEmail.get(email) ?? []), fill]);
  }

  const rows = new Map<string, BoardRow>();
  const rowFor = (channel: string) => {
    const row = rows.get(channel) ?? {
      channel,
      group: groupFor(channel),
      days: input.days.map(() => 0),
      total: 0,
      closeTotal: 0,
    };
    rows.set(channel, row);
    return row;
  };
  const cross = new Map<string, CrosswalkRow>();
  const setters = new Map<string, number>();
  const dayTotals = input.days.map(() => 0);
  let total = 0;
  let moved = 0;
  let withSiteFill = 0;
  let internalExcluded = 0;

  for (const call of input.calls) {
    const i = index.get(call.first_sales_call_booked_date);
    if (i === undefined) continue;
    if (isInternalLead(call.email, call.display_name)) {
      internalExcluded += 1;
      continue;
    }
    const email = call.email?.trim().toLowerCase();
    const fills =
      fillsByLead.get(call.lead_id) ??
      (email ? fillsByEmail.get(email) : undefined) ??
      [];
    const fill = creditingFill(call, fills);
    const closeChannel = channelOfFunnel(call.funnel);
    const channel = fill ? channelOfFill(fill) : closeChannel;
    if (fill) withSiteFill += 1;
    if (channel !== closeChannel) moved += 1;

    const row = rowFor(channel);
    row.days[i]! += 1;
    row.total += 1;
    rowFor(closeChannel).closeTotal += 1;
    dayTotals[i]! += 1;
    total += 1;

    const funnelName = call.funnel?.trim() || NO_FUNNEL;
    const entry = cross.get(channel) ?? {
      channel,
      group: groupFor(channel),
      total: 0,
      funnels: {},
    };
    entry.funnels[funnelName] = (entry.funnels[funnelName] ?? 0) + 1;
    entry.total += 1;
    cross.set(channel, entry);

    const setter = call.setter_name?.trim();
    if (setter) setters.set(setter, (setters.get(setter) ?? 0) + 1);
  }

  const groups = GROUP_ORDER.map((group): BoardGroup => {
    const members = [...rows.values()]
      .filter((row) => row.group === group)
      .sort((a, b) => b.total - a.total || b.closeTotal - a.closeTotal);
    return {
      group,
      rows: members,
      days: input.days.map((_, d) =>
        members.reduce((sum, row) => sum + row.days[d]!, 0),
      ),
      total: members.reduce((sum, row) => sum + row.total, 0),
    };
  }).filter((group) => group.rows.length > 0);

  const funnelTotals = new Map<string, number>();
  for (const entry of cross.values())
    for (const [funnel, n] of Object.entries(entry.funnels))
      funnelTotals.set(funnel, (funnelTotals.get(funnel) ?? 0) + n);

  return {
    days: [...input.days],
    groups,
    dayTotals,
    total,
    moved,
    withSiteFill,
    crosswalk: [...cross.values()].sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        b.total - a.total,
    ),
    closeFunnels: [...funnelTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([f]) => f),
    setters: [...setters.entries()]
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls),
    internalExcluded,
  };
}
