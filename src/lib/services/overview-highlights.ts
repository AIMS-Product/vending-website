import type { ChannelReportRow } from "@/lib/services/channel-report-rollup";

/**
 * The overview's verdict on which channels moved. Pure and client-safe: it
 * reads the rows the Channels report already produced and decides only what
 * can be said honestly about them.
 */

/**
 * The larger side of a comparison needs this many leads before the overview
 * calls a channel a mover. Two leads becoming four is a +100% that means
 * nothing, and a headline built on it sends someone to spend a morning
 * chasing noise.
 */
export const MIN_LEADS_FOR_MOVE = 5;

/**
 * A booking rate needs this many leads behind it. One lead out of two booking
 * is not a 50% channel, it is two people.
 */
export const MIN_LEADS_FOR_RATE = 10;

export type ChannelMove = {
  key: string;
  label: string;
  leads: number;
  prior: number;
  /** Leads now minus leads in the period before. Never zero. */
  change: number;
  /** Null when the prior period had no leads: there is no share of nothing. */
  changePct: number | null;
};

export type ChannelMoves = {
  gaining: ChannelMove[];
  slipping: ChannelMove[];
  /**
   * Channels carrying leads that cannot be judged — too few leads, or no
   * observation of the period before. Reported as a count so the panel can
   * say what it is leaving out instead of quietly showing a short list.
   */
  unrated: number;
};

/**
 * Biggest movers by absolute lead change, not by percentage. A channel going
 * from 6 leads to 12 doubles; one going from 120 to 150 is worth thirty more
 * conversations. Ranking on percentage puts the small one on top every time.
 */
export function rankChannelMoves(
  rows: readonly ChannelReportRow[],
  limit = 3,
): ChannelMoves {
  const moves: ChannelMove[] = [];
  let unrated = 0;

  for (const row of rows) {
    const leads = row.metrics.leads;
    const prior = row.prior.leads;

    // No lead connector covers this channel in either period, so it is not a
    // channel we failed to judge — it is one nobody measures leads for.
    if (leads == null && prior == null) continue;

    if (
      leads == null ||
      prior == null ||
      Math.max(leads, prior) < MIN_LEADS_FOR_MOVE
    ) {
      unrated += 1;
      continue;
    }

    const change = leads - prior;
    if (change === 0) continue;

    moves.push({
      key: row.key,
      label: row.label,
      leads,
      prior,
      change,
      changePct: prior > 0 ? Math.round((change / prior) * 100) : null,
    });
  }

  const byMagnitude = (a: ChannelMove, b: ChannelMove) =>
    Math.abs(b.change) - Math.abs(a.change) || a.label.localeCompare(b.label);

  return {
    gaining: moves
      .filter((move) => move.change > 0)
      .sort(byMagnitude)
      .slice(0, limit),
    slipping: moves
      .filter((move) => move.change < 0)
      .sort(byMagnitude)
      .slice(0, limit),
    unrated,
  };
}

/**
 * A rate, or nothing. Two things make a percentage a lie on this page: too
 * few leads behind it, and a numerator drawn from a different population than
 * its denominator — bookings that arrived on a direct Calendly link with no
 * lead form can push a channel's book rate past 100%. Both come back as null
 * so the panel prints a dash instead of a number nobody can act on.
 */
export function rateWithSample(
  pct: number | null,
  sample: number | null,
  minSample = MIN_LEADS_FOR_RATE,
): number | null {
  if (pct == null || pct > 100 || sample == null || sample < minSample) {
    return null;
  }
  return pct;
}
