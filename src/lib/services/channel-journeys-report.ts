/**
 * Live numbers for the channel journeys: one lane per channel, one count per
 * declared step, and the conversion rate from the step above it.
 *
 * The lanes and their order come from `channel-journeys.ts`; nothing is
 * inferred here. This module's whole job is to attach a number to each
 * declared step and to be honest about which pairs of steps can legitimately
 * be divided.
 *
 * The honesty rule that shapes everything: a rate is only printed when both
 * steps count the same population with the same instrument. Impressions come
 * from Meta and YouTube, visits come from GA4, registrations come from the
 * webinar receiver, and leads come from our own table. Dividing across two of
 * those is a number with no meaning, so those edges carry a rate marked
 * `crossSystem` and the page greys it out rather than pretending.
 */

import {
  CHANNEL_JOURNEYS,
  type ChannelJourney,
  type JourneyStep,
} from "@/lib/content/channel-journeys";
import { resolveChannel, resolveGa4Channel } from "@/lib/analytics/channel";
import { groupLeads } from "@/lib/analytics/lead-definition";
import { isChatbotCapture } from "@/lib/services/admin-analytics-internal";
import {
  canonicalFunnelPath,
  classifyBookedCall,
  indexSessions,
  indexShows,
  questionsPerLead,
  type FunnelSessionRow,
  type FunnelShowRow,
} from "@/lib/services/funnel-monthly";

export type JourneyLeadRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  lifecycle_status?: string | null;
  source_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  metadata: unknown;
  call_booked_at: string | null;
  closed_won_at: string | null;
  closed_won_value: number | null;
};

export type JourneyVisitRow = {
  day: string;
  landing_page: string;
  utm_source: string | null;
  utm_campaign: string | null;
  sessions: number;
};

export type JourneyReachRow = {
  day: string;
  channel: string | null;
  source: string | null;
  medium: string | null;
  impressions: number | null;
  clicks: number | null;
};

export type JourneyWebinarRow = { date: string; registrations: number | null };

/**
 * The fixed stage axis every lane is laid out against.
 *
 * Lanes have different numbers of steps — the website has no reach, the
 * chatbot has no page — so without a shared axis the lanes would not line up
 * and "which lane leaks where" becomes unreadable. A lane simply leaves the
 * bands it does not have empty.
 */
export const JOURNEY_BANDS = [
  "Seen",
  "Clicked",
  "Registered",
  "Visited",
  "Lead",
  "Qualified",
  "Booked",
  "Showed",
  "Won",
] as const;

export type JourneyBand = (typeof JOURNEY_BANDS)[number];

function bandOf(step: JourneyStep): JourneyBand {
  switch (step.kind) {
    case "reach":
      return step.metric === "impressions" ? "Seen" : "Clicked";
    case "registrations":
      return "Registered";
    case "page":
      return "Visited";
    case "lead":
      return "Lead";
    case "questions":
      return "Qualified";
    case "booked":
      return "Booked";
    case "showed":
      return "Showed";
    case "won":
      return "Won";
  }
}

export type JourneyStepResult = {
  key: string;
  band: JourneyBand;
  label: string;
  detail?: string;
  /** Null when this step's instrument reported nothing at all. */
  count: number | null;
  /** count / the previous step's count. Null when either side is missing. */
  rate: number | null;
  /**
   * True when the two sides of `rate` were measured by different systems.
   * The rate is still computed where it is nested — it is the only shape of
   * the drop-off we have — but it is not a conversion rate and must not be
   * read as one. Above 100% it is not even that, and comes back null: see
   * `crossSystemRate`.
   */
  crossSystem: boolean;
  /** Set when something about this number needs saying next to it. */
  caveat?: string;
};

export type JourneyLane = {
  key: string;
  label: string;
  channels: readonly string[];
  note?: string;
  steps: JourneyStepResult[];
  /**
   * Leads this channel produced on a page the lane does not declare. Not an
   * error — it is how you find out the map is out of date.
   */
  leadsOffMap: number;
  /** Paths those leads landed on, biggest first. The fix list for the map. */
  offMapPaths: Array<{ path: string; leads: number }>;
};

export type ChannelJourneysReport = {
  lanes: JourneyLane[];
  window: { start: string; end: string };
  /** Last day GA4 reported; every page step stops here. */
  visitsThrough: string | null;
  /** Channels with leads in the window that no lane claims. */
  unmappedChannels: Array<{ channel: string; leads: number }>;
  generatedAt: string;
};

/**
 * The share of the step above, or null when the division says nothing.
 *
 * A same-instrument rate is always meaningful: leads are a subset of the
 * people the page saw. A cross-instrument one is only ever an indication, and
 * once it passes 100% it is not even that — GHL counted 125 email clicks while
 * GA4 counted 185 sessions on the same pages, which does not mean 148% of
 * clickers arrived, it means the two systems are counting different things.
 * Printing 148% next to a funnel is the defect Adam flagged on the Channels
 * tab; a dash is the honest answer.
 */
function crossSystemRate(
  count: number | null,
  denominator: number | null,
  crossSystem: boolean,
): number | null {
  if (count === null || denominator === null || denominator <= 0) return null;
  const rate = (count / denominator) * 100;
  if (crossSystem && rate > 100) return null;
  return rate;
}

/** Which instrument a step's number comes from. Two different ones cannot divide. */
type Instrument = "platform" | "ga4" | "webinar" | "ours";

function instrumentOf(step: JourneyStep): Instrument {
  if (step.kind === "reach") return "platform";
  if (step.kind === "page") return "ga4";
  if (step.kind === "registrations") return "webinar";
  return "ours";
}

export function buildChannelJourneys(input: {
  leads: JourneyLeadRow[];
  visits: JourneyVisitRow[];
  reach: JourneyReachRow[];
  webinars: JourneyWebinarRow[];
  shows: FunnelShowRow[];
  sessions: FunnelSessionRow[];
  window: { start: string; end: string };
  now: Date;
  includeInternal?: boolean;
  journeys?: readonly ChannelJourney[];
}): ChannelJourneysReport {
  const journeys = input.journeys ?? CHANNEL_JOURNEYS;
  const today = input.now.toISOString().slice(0, 10);
  const { start, end } = input.window;

  const showByEmail = indexShows(input.shows);

  const visitsThrough = latestDay(input.visits.map((row) => row.day));
  // GA4 lags, so a page step measured to `end` would be short its last day
  // while every step around it is not.
  const visitEnd = visitsThrough && visitsThrough < end ? visitsThrough : end;

  // One row per person (see lead-definition); the loader reads 30 days early
  // so a repeat just inside the window is recognised.
  const groups = groupLeads(input.leads, {
    includeInternal: input.includeInternal,
  }).filter(
    ({ lead }) =>
      lead.created_at.slice(0, 10) >= start &&
      lead.created_at.slice(0, 10) <= end,
  );
  const leads = groups.map((group) => group.lead);
  const questionsByLead = questionsPerLead(
    groups,
    indexSessions(input.sessions),
  );
  const leadsByChannel = groupBy(leads, channelOfLead);

  const lanes = journeys.map((journey) =>
    buildLane({
      journey,
      leads: journey.channels.flatMap(
        (channel) => leadsByChannel.get(channel) ?? [],
      ),
      visits: input.visits,
      reach: input.reach,
      webinars: input.webinars,
      showByEmail,
      questionsByLead,
      start,
      end,
      visitEnd,
      visitsObserved: visitsThrough !== null && visitEnd >= start,
      today,
    }),
  );

  const claimed = new Set(journeys.flatMap((journey) => journey.channels));
  const unmappedChannels = [...leadsByChannel.entries()]
    .filter(([channel]) => !claimed.has(channel))
    .map(([channel, rows]) => ({ channel, leads: rows.length }))
    .sort((a, b) => b.leads - a.leads);

  return {
    lanes,
    window: input.window,
    visitsThrough,
    unmappedChannels,
    generatedAt: input.now.toISOString(),
  };
}

function buildLane(input: {
  journey: ChannelJourney;
  leads: JourneyLeadRow[];
  visits: JourneyVisitRow[];
  reach: JourneyReachRow[];
  webinars: JourneyWebinarRow[];
  showByEmail: Map<string, FunnelShowRow>;
  questionsByLead: Map<string, { finished: boolean; furthest: number }>;
  start: string;
  end: string;
  visitEnd: string;
  visitsObserved: boolean;
  today: string;
}): JourneyLane {
  const { journey, leads } = input;
  const laneChannels = new Set(journey.channels);

  // The pages this lane declares. Leads on any other page still belong to the
  // channel, but they are not this journey, so they are reported separately
  // rather than silently inflating the lane's conversion.
  const declaredPaths = new Set(
    journey.steps
      .filter((step) => step.kind === "page")
      .flatMap((step) => (step.kind === "page" ? step.paths : []))
      .map((path) => canonicalFunnelPath(path))
      .filter((path): path is string => path !== null),
  );
  const hasPageStep = declaredPaths.size > 0;
  const onMap = hasPageStep
    ? leads.filter((lead) => {
        const path = canonicalFunnelPath(lead.source_path);
        return path !== null && declaredPaths.has(path);
      })
    : leads;
  const offMap = hasPageStep
    ? leads.filter((lead) => !onMap.includes(lead))
    : [];

  const booked = onMap.filter((lead) => lead.call_booked_at);
  const calls = booked.map((lead) => ({
    lead,
    ...classifyBookedCall(lead.email, input.showByEmail, input.today),
  }));
  const held = calls.filter((call) => call.state === "held");

  const counts = (
    step: JourneyStep,
  ): { count: number | null; caveat?: string } => {
    switch (step.kind) {
      case "reach":
        return reachCount(input, laneChannels, step.metric);
      case "page":
        return pageCount(input, laneChannels, step.paths);
      case "registrations":
        return {
          count: sum(
            input.webinars
              .filter((row) => row.date >= input.start && row.date <= input.end)
              .map((row) => row.registrations ?? 0),
          ),
        };
      case "lead":
        return { count: onMap.length };
      case "questions": {
        const offered = onMap.filter((lead) =>
          input.questionsByLead.has(lead.id),
        );
        if (offered.length === 0) {
          return {
            count: null,
            caveat: "These pages do not ask the scored questions.",
          };
        }
        return {
          count: offered.filter(
            (lead) => input.questionsByLead.get(lead.id)?.finished,
          ).length,
        };
      }
      case "booked":
        return { count: booked.length };
      case "showed": {
        const pending = calls.filter((call) => call.state === "pending").length;
        const unlogged = calls.filter(
          (call) => call.state === "unlogged",
        ).length;
        const notes: string[] = [];
        if (pending > 0) notes.push(`${pending} call(s) not held yet`);
        if (unlogged > 0) notes.push(`${unlogged} with no outcome logged`);
        return {
          count: held.length,
          caveat: notes.length
            ? `${notes.join(", ")} — both are out of this step, not counted as no-shows.`
            : undefined,
        };
      }
      case "won": {
        const closeable = calls.filter((call) => call.closeable).length;
        return {
          count: onMap.filter((lead) => lead.closed_won_at).length,
          caveat:
            closeable === 0
              ? "No call here is 30 days old yet, so a missing sale means nothing."
              : undefined,
        };
      }
    }
  };

  const steps: JourneyStepResult[] = [];
  let previous: { count: number | null; instrument: Instrument } | null = null;
  for (const step of journey.steps) {
    const { count, caveat } = counts(step);
    const instrument = instrumentOf(step);
    const denominator = previous?.count ?? null;
    const crossSystem = previous !== null && previous.instrument !== instrument;
    steps.push({
      key: step.key,
      band: bandOf(step),
      label: step.label,
      detail: step.detail,
      count,
      rate: crossSystemRate(count, denominator, crossSystem),
      crossSystem,
      caveat,
    });
    // A step nobody measured must not become the denominator of the next one:
    // the chain skips it and the following step divides by the last real
    // number instead of printing an infinite rate.
    if (count !== null) previous = { count, instrument };
  }

  return {
    key: journey.key,
    label: journey.label,
    channels: journey.channels,
    note: journey.note,
    steps,
    leadsOffMap: offMap.length,
    offMapPaths: topPaths(offMap),
  };
}

function reachCount(
  input: { reach: JourneyReachRow[]; start: string; end: string },
  channels: Set<string>,
  metric: "impressions" | "clicks",
): { count: number | null } {
  const rows = input.reach.filter(
    (row) =>
      row.day >= input.start &&
      row.day <= input.end &&
      channels.has(
        row.channel ??
          resolveChannel(row.source, { medium: row.medium }).channel,
      ),
  );
  const total = sum(rows.map((row) => row[metric] ?? 0));
  // Zero here means the platform reported nothing, which is different from
  // "nobody saw it" — every ads connector writes a row whether or not it has
  // the metric.
  return { count: total > 0 ? total : null };
}

function pageCount(
  input: {
    visits: JourneyVisitRow[];
    start: string;
    visitEnd: string;
    visitsObserved: boolean;
  },
  channels: Set<string>,
  paths: readonly string[],
): { count: number | null; caveat?: string } {
  if (!input.visitsObserved) {
    return { count: null, caveat: "GA4 has not reported for this window." };
  }
  const wanted = new Set(
    paths
      .map((path) => canonicalFunnelPath(path))
      .filter((path): path is string => path !== null),
  );
  const rows = input.visits.filter((row) => {
    if (row.day < input.start || row.day > input.visitEnd) return false;
    const path = canonicalFunnelPath(row.landing_page);
    if (path === null || !wanted.has(path)) return false;
    return channels.has(
      resolveGa4Channel(row.utm_source, row.utm_campaign).channel,
    );
  });
  return { count: sum(rows.map((row) => row.sessions)) };
}

function channelOfLead(lead: JourneyLeadRow): string {
  return resolveChannel(lead.utm_source, {
    medium: lead.utm_medium,
    capturedByChatbot: isChatbotCapture(lead.metadata),
  }).channel;
}

function topPaths(
  leads: JourneyLeadRow[],
): Array<{ path: string; leads: number }> {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const path = canonicalFunnelPath(lead.source_path) ?? "(no page recorded)";
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([path, count]) => ({ path, leads: count }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    const existing = groups.get(value);
    if (existing) existing.push(row);
    else groups.set(value, [row]);
  }
  return groups;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function latestDay(days: string[]): string | null {
  let latest: string | null = null;
  for (const day of days) if (latest === null || day > latest) latest = day;
  return latest;
}
