/**
 * How much of our lead volume arrived on a link that is actually in the
 * marketing link registry.
 *
 * `marketing_links` is the only thing that knows a link's destination, because
 * the destination is `utm_term` and `utm_term` is typed when the link is built.
 * With the registry empty, `channel_daily.destination` is `unknown` on nearly
 * every row and channel x page x CTA cannot be recovered by any report. This
 * module measures that gap and names the links that caused it, so there is a
 * worklist instead of a complaint.
 *
 * Adam's rule, and the reason this file infers nothing: a link that carried no
 * `utm_term` stays unknown. The landing page is evidence of where someone went,
 * never of where the link meant to send them, and guessing would turn a visible
 * gap into an invisible error.
 *
 * Leads only, deliberately. `ga4_page_views` stores `utm_source` and
 * `utm_campaign` and nothing else, so a visit cannot be tested for registry
 * membership at all — the columns that would answer it do not exist. Counting
 * visits here would divide a number we can check by one we cannot.
 */

import { checkLinkUtms, type LinkUtms } from "@/lib/analytics/link-standard";
import { resolveChannel } from "@/lib/analytics/channel";

/** A lead as the coverage report needs it: the five UTMs and where it landed. */
export type CoverageLeadRow = {
  created_at: string;
  source_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

/** A registry row. `utm_term` is the destination the builder made the link for. */
export type CoverageLinkRow = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  label: string | null;
};

export type LinkCoverageTotals = {
  leads: number;
  /** Carried UTMs that match a registry row exactly. */
  registered: number;
  /** Carried UTMs, but no registry row has them. This is the worklist. */
  unregistered: number;
  /**
   * Carried no UTM at all: direct, organic, or a click from one of our own
   * pages. There is no link to register, so these are reported beside the
   * rate rather than inside it.
   */
  untagged: number;
  /** registered / (registered + unregistered). Null when nothing was tagged. */
  registeredPct: number | null;
};

export type LinkCoverageChannel = LinkCoverageTotals & { channel: string };

/** One untagged or unregistered link, with the leads it brought. */
export type UnregisteredLink = {
  key: string;
  channel: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  leads: number;
  /**
   * Where these leads landed. Evidence for whoever rebuilds the link, so they
   * can recognise it. Never read as the destination.
   */
  landingPaths: string[];
  /** What the link standard says is missing, in the words of the person fixing it. */
  problems: string[];
};

export type LinkCoverageReport = {
  window: { start: string; end: string };
  /** Rows in `marketing_links`, so an empty registry explains itself. */
  registrySize: number;
  totals: LinkCoverageTotals;
  byChannel: LinkCoverageChannel[];
  worklist: UnregisteredLink[];
};

/** Landing paths listed per worklist row before it stops being a hint. */
const MAX_LANDING_PATHS = 4;

export function buildLinkCoverage(input: {
  leads: CoverageLeadRow[];
  links: CoverageLinkRow[];
  window: { start: string; end: string };
}): LinkCoverageReport {
  const registry = new Set(
    input.links.map((link) =>
      tupleKey({
        source: link.utm_source,
        medium: link.utm_medium,
        campaign: link.utm_campaign,
        content: link.utm_content,
        term: link.utm_term,
      }),
    ),
  );

  const totals = emptyTotals();
  const byChannel = new Map<string, LinkCoverageTotals>();
  const worklist = new Map<string, UnregisteredLink>();

  for (const lead of input.leads) {
    const utms = leadUtms(lead);
    const channel = resolveChannel(lead.utm_source, {
      medium: lead.utm_medium,
    }).channel;
    const bucket =
      byChannel.get(channel) ??
      byChannel.set(channel, emptyTotals()).get(channel)!;

    totals.leads += 1;
    bucket.leads += 1;

    if (!isTagged(utms)) {
      totals.untagged += 1;
      bucket.untagged += 1;
      continue;
    }
    if (registry.has(tupleKey(utms))) {
      totals.registered += 1;
      bucket.registered += 1;
      continue;
    }

    totals.unregistered += 1;
    bucket.unregistered += 1;
    addToWorklist(worklist, utms, channel, lead.source_path);
  }

  return {
    window: input.window,
    registrySize: input.links.length,
    totals: withPct(totals),
    byChannel: [...byChannel.entries()]
      .map(([channel, counts]) => ({ channel, ...withPct(counts) }))
      .sort((a, b) => b.leads - a.leads || a.channel.localeCompare(b.channel)),
    worklist: [...worklist.values()].sort(
      (a, b) => b.leads - a.leads || a.key.localeCompare(b.key),
    ),
  };
}

function addToWorklist(
  worklist: Map<string, UnregisteredLink>,
  utms: LinkUtms,
  channel: string,
  sourcePath: string | null,
) {
  const key = tupleKey(utms);
  const existing = worklist.get(key);
  if (existing) {
    existing.leads += 1;
    if (
      sourcePath &&
      existing.landingPaths.length < MAX_LANDING_PATHS &&
      !existing.landingPaths.includes(sourcePath)
    ) {
      existing.landingPaths.push(sourcePath);
    }
    return;
  }
  worklist.set(key, {
    key,
    channel,
    source: utms.source,
    medium: utms.medium,
    campaign: utms.campaign,
    content: utms.content,
    term: utms.term,
    leads: 1,
    landingPaths: sourcePath ? [sourcePath] : [],
    problems: checkLinkUtms(utms).problems,
  });
}

function leadUtms(lead: CoverageLeadRow): LinkUtms {
  return {
    source: clean(lead.utm_source),
    medium: clean(lead.utm_medium),
    campaign: clean(lead.utm_campaign),
    content: clean(lead.utm_content),
    term: clean(lead.utm_term),
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isTagged(utms: LinkUtms): boolean {
  return Object.values(utms).some((value) => value !== null);
}

/**
 * The registry is keyed on the whole tuple, lowercased. Matching on fewer than
 * five fields would let two links that differ only in destination collapse into
 * one, which is the exact confusion the registry exists to end.
 */
function tupleKey(utms: LinkUtms): string {
  return (
    [utms.source, utms.medium, utms.campaign, utms.content, utms.term]
      .map((value) => value?.trim().toLowerCase() ?? "")
      // NUL, not "|": Google Ads campaign names carry pipes.
      .join("\u0000")
  );
}

function emptyTotals(): LinkCoverageTotals {
  return {
    leads: 0,
    registered: 0,
    unregistered: 0,
    untagged: 0,
    registeredPct: null,
  };
}

/**
 * Coverage is measured over tagged leads only: an untagged lead had no link, so
 * counting it as a miss would blame the team for organic traffic. A window with
 * nothing tagged returns null, which the page prints as a dash.
 */
function withPct(totals: LinkCoverageTotals): LinkCoverageTotals {
  const tagged = totals.registered + totals.unregistered;
  return {
    ...totals,
    registeredPct: tagged === 0 ? null : (totals.registered / tagged) * 100,
  };
}
