/**
 * The channel flow: every channel, Captured -> Booked -> Showed -> Qualified
 * -> Won, as one pure computation so the chart only draws.
 *
 * Populations (METRICS.md §5, §6, §16 "Channel flow"):
 *   - Captured: leads + contacts on the channel spine (§4), by channel.
 *   - Booked: Close first calls scheduled in the window, SteelTrap rule
 *     applied (§3, §5 Close mirror). One per lead.
 *   - Showed / Qualified: of those calls, the rep's logged "Yes" (§6). Each
 *     stage is what Close records for that call; a qualification never implies
 *     a show, so the two are counted independently and never inferred.
 *   - Won: of those calls, leads with a won Close opportunity dated on or
 *     after the window's first day. A won deal is the furthest stage a lead
 *     can reach, so it is read from the opportunity, not from the lead's
 *     current status, which moves on after the sale.
 *
 * Booked onward is a cohort (the window's calls, followed to today); Captured
 * is the window's own captures. The two are different people, which is why
 * the first conversion is a ratio, not a share (§7 "Flow booking ratio").
 */

import { GOAL_CHANNELS } from "@/lib/services/channel-targets";
import {
  isExcludedCall,
  isYes,
  type CloseCall,
} from "@/lib/services/close-week-view";

export const FLOW_STAGES = [
  "Captured",
  "Booked",
  "Showed",
  "Qualified",
  "Won",
] as const;

export type FlowChannelKey =
  | "webinar"
  | "youtube"
  | "instagram"
  | "website"
  | "google-ads"
  | "meta-ads"
  | "email"
  | "social"
  | "reactivation"
  | "other";

type FlowChannelDef = {
  key: FlowChannelKey;
  label: string;
  /** Spine channel labels (the `resolveChannel` vocabulary). */
  spine: readonly string[];
  /** Close "Funnel Name DEAL (Opp)" values, as Close spells them. */
  funnels: readonly string[];
};

const LANE_2_FUNNELS =
  GOAL_CHANNELS.find((channel) => channel.key === "lane-2")?.funnels ?? [];

/**
 * The bands. `buildChannelFlow` orders them by size; ties keep this order. Chatbot leads sit in Website & search because
 * Close files a chat-booked call under the funnel the visitor arrived on,
 * mostly Website (13 of 18 matched calls, 2026-10-02); a Chatbot band would
 * carry its captures and none of its calls.
 */
export const FLOW_CHANNELS: readonly FlowChannelDef[] = [
  {
    key: "webinar",
    label: "Webinar",
    spine: ["Webinar"],
    funnels: ["Internal Webinar"],
  },
  {
    key: "youtube",
    label: "YouTube",
    spine: ["YouTube"],
    funnels: ["YouTube"],
  },
  {
    key: "instagram",
    label: "Instagram",
    spine: ["Instagram", "Instagram DM"],
    funnels: ["Instagram", "Anthony IG"],
  },
  {
    key: "website",
    label: "Website & search",
    spine: [
      "Website",
      "Organic search",
      "AI assistants",
      "Referral",
      "Chatbot",
    ],
    funnels: ["Website", "Website - OG - Cam"],
  },
  {
    key: "google-ads",
    label: "Google Ads",
    spine: ["Google Ads"],
    funnels: ["Google Ads"],
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    spine: ["Meta Ads", "Meta"],
    funnels: ["Meta Ads"],
  },
  {
    key: "email",
    label: "Email & newsletter",
    spine: ["Newsletter", "Email", "Instantly"],
    funnels: ["Newsletter", "Mike Newsletter", "Reactivation Email"],
  },
  {
    key: "social",
    label: "LinkedIn & X",
    spine: ["LinkedIn", "X"],
    funnels: ["Linkedin", "LinkedIn Ads", "X", "Anthony X"],
  },
  {
    key: "reactivation",
    label: "Sales reactivation",
    spine: [],
    funnels: LANE_2_FUNNELS,
  },
  { key: "other", label: "Other and not recorded", spine: [], funnels: [] },
];

const bySpine = new Map(
  FLOW_CHANNELS.flatMap((c) => c.spine.map((s) => [s.toLowerCase(), c.key])),
);
const byFunnel = new Map(
  FLOW_CHANNELS.flatMap((c) => c.funnels.map((f) => [f.toLowerCase(), c.key])),
);

export function flowChannelForSpine(channel: string | null): FlowChannelKey {
  return bySpine.get((channel ?? "").trim().toLowerCase()) ?? "other";
}

export function flowChannelForFunnel(funnel: string | null): FlowChannelKey {
  return byFunnel.get((funnel ?? "").trim().toLowerCase()) ?? "other";
}

export type FlowBand = {
  key: FlowChannelKey;
  label: string;
  /** One value per FLOW_STAGES entry. */
  values: [number, number, number, number, number];
  /** Value of the cohort's won deals, dollars. */
  revenue: number;
  /** Won deals with no value in Close: counted in Won, absent from revenue. */
  unvalued: number;
};

export type ChannelFlow = {
  bands: FlowBand[];
  totals: [number, number, number, number, number];
  revenue: number;
  unvalued: number;
  /** First calls the SteelTrap rule left out, shown rather than absorbed. */
  excluded: number;
  /** Qualified with no show logged: disclosed, never turned into a show. */
  qualifiedWithoutShow: number;
};

export type FlowWin = { leadId: string; value: number | null };

export function buildChannelFlow(input: {
  calls: readonly CloseCall[];
  captured: ReadonlyArray<{ channel: string; count: number }>;
  /** Won deals dated from the window's first day to today. */
  wins: readonly FlowWin[];
}): ChannelFlow {
  const bands = new Map<FlowChannelKey, FlowBand>(
    FLOW_CHANNELS.map((c) => [
      c.key,
      {
        key: c.key,
        label: c.label,
        values: [0, 0, 0, 0, 0],
        revenue: 0,
        unvalued: 0,
      },
    ]),
  );
  const band = (key: FlowChannelKey) => bands.get(key)!;

  for (const row of input.captured) {
    if (row.count > 0)
      band(flowChannelForSpine(row.channel)).values[0] += row.count;
  }

  const winsByLead = new Map<string, Array<number | null>>();
  for (const win of input.wins) {
    winsByLead.set(win.leadId, [
      ...(winsByLead.get(win.leadId) ?? []),
      win.value,
    ]);
  }

  let excluded = 0;
  let qualifiedWithoutShow = 0;
  const seen = new Set<string>();
  for (const call of input.calls) {
    if (isExcludedCall(call)) {
      excluded += 1;
      continue;
    }
    // The mirror is one row per lead; a duplicate would be a read bug, and
    // must not count twice.
    if (seen.has(call.leadId)) continue;
    seen.add(call.leadId);
    const b = band(flowChannelForFunnel(call.funnel));
    const showed = isYes(call.showUp);
    const qualified = isYes(call.qualified);
    b.values[1] += 1;
    if (showed) b.values[2] += 1;
    if (qualified) b.values[3] += 1;
    if (qualified && !showed) qualifiedWithoutShow += 1;
    const deals = winsByLead.get(call.leadId);
    if (deals) {
      b.values[4] += 1;
      for (const value of deals) {
        if (value === null) b.unvalued += 1;
        else b.revenue += value;
      }
    }
  }

  // Largest band first by Booked (then Captured), so the rail, the chart and
  // the Bookings card read in one order; "Other and not recorded" is always
  // last because it is a remainder, not a channel.
  const list = FLOW_CHANNELS.map((c) => band(c.key))
    .filter((b) => b.values.some((v) => v > 0))
    .sort(
      (a, b) =>
        Number(a.key === "other") - Number(b.key === "other") ||
        b.values[1] - a.values[1] ||
        b.values[0] - a.values[0],
    );
  const totals = [0, 1, 2, 3, 4].map((i) =>
    list.reduce((sum, b) => sum + b.values[i]!, 0),
  ) as ChannelFlow["totals"];
  return {
    bands: list,
    totals,
    revenue: list.reduce((sum, b) => sum + b.revenue, 0),
    unvalued: list.reduce((sum, b) => sum + b.unvalued, 0),
    excluded,
    qualifiedWithoutShow,
  };
}

/** A stage over the one before it as a percentage, one decimal; null at zero. */
export function stageRate(
  numerator: number,
  denominator: number,
): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}
