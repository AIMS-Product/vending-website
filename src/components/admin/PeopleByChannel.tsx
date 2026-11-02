import Link from "next/link";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { PeopleTable } from "@/components/admin/GoogleAdsBookedPeople";
import { formatCount } from "@/lib/admin/format-number";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import {
  summarizeChannel,
  type ChannelPeople,
} from "@/lib/services/people-by-channel";
import { getPeopleByChannel } from "@/lib/services/people-by-channel-data";

const NUMBER_COLUMNS = [
  "Booked",
  "Marketing",
  "Lane 2",
  "Social DMs",
  "Showed",
  "No-show",
  "Rescheduled",
  "Upcoming",
  "Not logged",
  "Qualified",
  "Won",
];

const numbers = (row: ChannelPeople) => [
  row.booked,
  row.marketing,
  row.lane2,
  row.socialDms,
  row.shows.Showed,
  row.shows["No-show"],
  row.shows.Rescheduled,
  row.shows.Upcoming,
  row.shows["Not logged"],
  row.qualified,
  row.won,
];

function hrefFor(range: AdminAnalyticsRangeKey, channel: string | null) {
  const params = new URLSearchParams({ range });
  if (channel) params.set("channel", channel);
  return `/admin/analytics/people?${params.toString()}#people`;
}

function SummaryRow({
  row,
  label,
  href,
  active,
}: {
  row: ChannelPeople;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <tr className={active ? "bg-ui-canvas font-semibold" : undefined}>
      <td className="py-2 pr-3">
        <Link
          href={href}
          aria-current={active ? "true" : undefined}
          className="text-ui-text underline underline-offset-2"
        >
          {label}
        </Link>
      </td>
      {numbers(row).map((value, i) => (
        <td
          key={NUMBER_COLUMNS[i]}
          className="py-2 pr-3 text-right tabular-nums"
        >
          {value ? formatCount(value) : "–"}
        </td>
      ))}
    </tr>
  );
}

export async function PeopleByChannel({
  range,
  channel,
}: {
  range: AdminAnalyticsRangeKey;
  channel: string | null;
}) {
  const read = await getPeopleByChannel(range);
  const title = "Booked calls by channel";
  if (!read.ok)
    return (
      <section className={adminCardClass} aria-label={title}>
        <h2 className={adminEyebrowClass}>{title}</h2>
        <p className="text-ui-text-muted mt-3 text-sm">{read.error}</p>
      </section>
    );

  const everyone = read.channels.flatMap((c) => c.people);
  const total = summarizeChannel("All channels", everyone);
  const selected = channel
    ? (read.channels.find((c) => c.channel === channel) ??
      summarizeChannel(channel, []))
    : total;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section className={adminCardClass} aria-label={title}>
        <h2 className={adminEyebrowClass}>{title}</h2>
        <p className="text-ui-text-muted mt-2 max-w-3xl text-[0.8125rem]">
          Counted on Dom&apos;s rule, by the day the call was booked. Click a
          channel to see its people. Lane 2 and Social DMs can differ from the
          company MTD by a few while his newest rule changes are reconciled.
        </p>
        {read.channels.length === 0 ? (
          <p className="text-ui-text-subtle mt-3 text-sm">
            No calls booked in this range.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[60rem] text-[0.8125rem]">
              <thead>
                <tr
                  className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
                >
                  <th className="py-2 pr-3 font-semibold">Channel</th>
                  {NUMBER_COLUMNS.map((c) => (
                    <th key={c} className="py-2 pr-3 text-right font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {read.channels.map((row) => (
                  <SummaryRow
                    key={row.channel}
                    row={row}
                    label={row.channel}
                    href={hrefFor(range, row.channel)}
                    active={channel === row.channel}
                  />
                ))}
                <SummaryRow
                  row={total}
                  label="All channels"
                  href={hrefFor(range, null)}
                  active={!channel}
                />
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section
        id="people"
        className={`${adminCardClass} scroll-mt-4`}
        aria-label="People"
      >
        <h2 className={adminEyebrowClass}>
          {selected.channel}: {formatCount(selected.booked)} booked
        </h2>
        <p className="text-ui-text-muted mt-2 text-[0.8125rem]">
          Names open in Close.
        </p>
        {selected.people.length === 0 ? (
          <p className="text-ui-text-subtle mt-3 text-sm">
            Nobody booked from this channel in this range.
          </p>
        ) : (
          <PeopleTable
            people={selected.people}
            lastColumn="Booked by"
            adColumn="Came from"
            showChannel={!channel}
          />
        )}
      </section>
    </div>
  );
}
