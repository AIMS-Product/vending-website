import type { Decision } from "@/lib/booked-calls-v2/engine";
import {
  newestFirst,
  personBuilder,
  UNKNOWN_CHANNEL,
  type BookedPerson,
  type PeopleInputs,
  type ShowStatus,
} from "@/lib/services/google-ads-booked-people";

/** Every call Dom's rule counts, grouped by the channel it credits. */

export type ChannelPeople = {
  channel: string;
  booked: number;
  marketing: number;
  lane2: number;
  socialDms: number;
  shows: Record<ShowStatus, number>;
  qualified: number;
  won: number;
  people: BookedPerson[];
};

const noShows = (): Record<ShowStatus, number> => ({
  Showed: 0,
  "No-show": 0,
  Rescheduled: 0,
  Canceled: 0,
  Upcoming: 0,
  "Not logged": 0,
});

export function summarizeChannel(
  channel: string,
  people: BookedPerson[],
): ChannelPeople {
  const row: ChannelPeople = {
    channel,
    booked: people.length,
    marketing: 0,
    lane2: 0,
    socialDms: 0,
    shows: noShows(),
    qualified: 0,
    won: 0,
    people,
  };
  for (const p of people) {
    if (p.bookedBy === "Marketing") row.marketing += 1;
    if (p.bookedBy === "Lane 2") row.lane2 += 1;
    if (p.bookedBy === "Social DMs") row.socialDms += 1;
    row.shows[p.show] += 1;
    if (p.qualified?.trim().toLowerCase() === "yes") row.qualified += 1;
    if (/\bwon\b/i.test(p.closeStatus ?? "")) row.won += 1;
  }
  return row;
}

/** Booked calls Dom's scope drops, kept visible: their lead owner is not a VP closer. */
export function buildOutsideScope(input: PeopleInputs): BookedPerson[] {
  const person = personBuilder(input);
  return input.decisions
    .filter((d) => d.reason === "outside_booking_scope")
    .map((d) => ({
      ...person(d.leadId, d, null),
      channel: d.origin.source ?? UNKNOWN_CHANNEL,
    }))
    .sort(newestFirst);
}

/** Most booked first; Unknown always last, because it is the to-do pile. */
export function buildPeopleByChannel(input: PeopleInputs): ChannelPeople[] {
  const person = personBuilder(input);
  const groups = new Map<string, BookedPerson[]>();
  const counted = input.decisions.filter(
    (d: Decision) => d.disposition === "counted",
  );
  for (const d of counted) {
    const p = person(d.leadId, d, null);
    const channel = p.channel ?? UNKNOWN_CHANNEL;
    groups.set(channel, [...(groups.get(channel) ?? []), p]);
  }
  return [...groups]
    .map(([channel, people]) =>
      summarizeChannel(channel, [...people].sort(newestFirst)),
    )
    .sort(
      (a, b) =>
        Number(a.channel === UNKNOWN_CHANNEL) -
          Number(b.channel === UNKNOWN_CHANNEL) ||
        b.booked - a.booked ||
        a.channel.localeCompare(b.channel),
    );
}

export type HostLogging = { host: string; held: number; notLogged: number };

/**
 * Calls whose time has passed, per person holding them, and how many have no
 * show or no-show recorded. Worst first; hosts with none logged missing drop off.
 */
export function notLoggedByHost(
  people: readonly BookedPerson[],
): HostLogging[] {
  const hosts = new Map<string, HostLogging>();
  for (const p of people) {
    if (p.show === "Upcoming") continue;
    const host = p.host?.trim() || "No host on the meeting";
    const row = hosts.get(host) ?? { host, held: 0, notLogged: 0 };
    hosts.set(host, {
      host,
      held: row.held + 1,
      notLogged: row.notLogged + (p.show === "Not logged" ? 1 : 0),
    });
  }
  return [...hosts.values()]
    .filter((row) => row.notLogged > 0)
    .sort((a, b) => b.notLogged - a.notLogged || a.host.localeCompare(b.host));
}
