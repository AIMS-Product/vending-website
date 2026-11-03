import "server-only";

import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import { getBookedCallsV2 } from "@/lib/services/booked-calls-v2-data";
import {
  MAX_PEOPLE_DAYS,
  readPeopleSources,
} from "@/lib/services/google-ads-booked-people-data";
import { googleAdsWindow } from "@/lib/services/google-ads-dashboard";
import type { BookedPerson } from "@/lib/services/google-ads-booked-people";
import {
  buildOutsideScope,
  buildPeopleByChannel,
  type ChannelPeople,
} from "@/lib/services/people-by-channel";

export type PeopleByChannelRead =
  | {
      ok: true;
      ruleVersion: string;
      channels: ChannelPeople[];
      outsideScope: BookedPerson[];
    }
  | { ok: false; error: string };

export async function getPeopleByChannel(
  range: AdminAnalyticsRangeKey,
  now = new Date(),
): Promise<PeopleByChannelRead> {
  const { start, endsAt, days } = googleAdsWindow(range, now);
  if (days > MAX_PEOPLE_DAYS)
    return {
      ok: false,
      error: `Pick ${MAX_PEOPLE_DAYS} days or less to see the people.`,
    };
  try {
    const report = await getBookedCallsV2({
      from: start.toISOString(),
      to: endsAt.toISOString(),
    });
    if (!report.ok) return { ok: false, error: report.error };
    const leadIds = [
      ...new Set(
        report.decisions
          .filter(
            (d) =>
              d.disposition === "counted" ||
              d.reason === "outside_booking_scope",
          )
          .map((d) => d.leadId),
      ),
    ];
    const inputs = {
      decisions: report.decisions,
      meetings: report.meetings,
      ...(await readPeopleSources(leadIds, start)),
      now,
    };
    return {
      ok: true,
      ruleVersion: report.ruleVersion,
      channels: buildPeopleByChannel(inputs),
      outsideScope: buildOutsideScope(inputs),
    };
  } catch (error) {
    console.error("people by channel: read failed", error);
    return { ok: false, error: "Could not load the people booked." };
  }
}
