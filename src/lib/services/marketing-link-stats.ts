import { utmTupleKey, type LinkUtms } from "@/lib/analytics/link-standard";

/**
 * What each registry link brought in, so "did my link work?" is answered on
 * the row itself instead of by asking someone to query the database.
 *
 * Every number joins on the whole five-UTM tuple (`utmTupleKey`), the same
 * key link coverage uses, so a link is credited only with traffic that
 * carried exactly its tags. Two links that differ in one field never share.
 */

type TupleColumns = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

export type StatsLink = TupleColumns & {
  id: string;
  bitly_id: string | null;
  bitly_url: string | null;
};

/** A lead already collapsed the way every surface counts one (collapseToLeads). */
export type StatsLead = TupleColumns & {
  created_at: string;
  call_booked_at: string | null;
};

export type StatsBooking = TupleColumns & {
  invitee_email: string | null;
  status: string | null;
};

export type StatsClick = { bitly_id: string; clicks: number };

export type LinkStats = {
  /** Site leads that arrived carrying this link's five UTMs. */
  leads: number;
  /** Of those leads, how many have a first sales call booked (Close). */
  booked: number;
  /**
   * Calendly bookings made straight from this link: distinct invitees, not
   * canceled. Catches calendar links that skip the site form (webinar CTAs,
   * setter texts), so it can be larger than `booked`.
   */
  calendarBookings: number;
  /** Bitly clicks, all time. Null when the link has no short link to observe. */
  clicks: number | null;
  lastLeadAt: string | null;
};

export function emptyLinkStats(): LinkStats {
  return {
    leads: 0,
    booked: 0,
    calendarBookings: 0,
    clicks: null,
    lastLeadAt: null,
  };
}

export function buildLinkStats(input: {
  links: readonly StatsLink[];
  leads: readonly StatsLead[];
  bookings: readonly StatsBooking[];
  clicks: readonly StatsClick[];
}): Map<string, LinkStats> {
  const leadsByKey = new Map<string, StatsLead[]>();
  for (const lead of input.leads) {
    const key = utmTupleKey(utmsOf(lead));
    if (key === EMPTY_KEY) continue;
    const list = leadsByKey.get(key);
    if (list) list.push(lead);
    else leadsByKey.set(key, [lead]);
  }

  const inviteesByKey = new Map<string, Set<string>>();
  for (const booking of input.bookings) {
    if (booking.status === "canceled") continue;
    const email = booking.invitee_email?.trim().toLowerCase();
    if (!email) continue;
    const key = utmTupleKey(utmsOf(booking));
    if (key === EMPTY_KEY) continue;
    const set = inviteesByKey.get(key) ?? new Set<string>();
    set.add(email);
    inviteesByKey.set(key, set);
  }

  const clicksById = new Map<string, number>();
  for (const row of input.clicks) {
    clicksById.set(
      row.bitly_id,
      (clicksById.get(row.bitly_id) ?? 0) + row.clicks,
    );
  }

  const stats = new Map<string, LinkStats>();
  for (const link of input.links) {
    const key = utmTupleKey(utmsOf(link));
    const leads = leadsByKey.get(key) ?? [];
    const bitlyId = bitlyKey(link);
    stats.set(link.id, {
      leads: leads.length,
      booked: leads.filter((lead) => lead.call_booked_at).length,
      calendarBookings: inviteesByKey.get(key)?.size ?? 0,
      clicks: bitlyId ? (clicksById.get(bitlyId) ?? 0) : null,
      lastLeadAt: leads.reduce<string | null>(
        (latest, lead) =>
          latest && latest > lead.created_at ? latest : lead.created_at,
        null,
      ),
    });
  }
  return stats;
}

const EMPTY_KEY = utmTupleKey({
  source: null,
  medium: null,
  campaign: null,
  content: null,
  term: null,
});

function utmsOf(row: TupleColumns): LinkUtms {
  return {
    source: row.utm_source,
    medium: row.utm_medium,
    campaign: row.utm_campaign,
    content: row.utm_content,
    term: row.utm_term,
  };
}

/**
 * The id `bitly_link_clicks` is keyed on. Imported YouTube rows leave
 * `bitly_id` empty on purpose (youtube_videos already syncs those clicks, and
 * a second owner would sync them twice), so fall back to the short URL, which
 * is the same `{host}/{back-half}` string.
 */
function bitlyKey(link: StatsLink): string | null {
  if (link.bitly_id) return link.bitly_id;
  if (!link.bitly_url) return null;
  return link.bitly_url.replace(/^https?:\/\//, "");
}
