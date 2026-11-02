import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import type {
  BookedPerson,
  ShowStatus,
} from "@/lib/services/google-ads-booked-people";
import { getGoogleAdsBookedPeople } from "@/lib/services/google-ads-booked-people-data";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";

const SHOW_TONE: Record<ShowStatus, "ok" | "warn" | "bad" | "idle"> = {
  Showed: "ok",
  "No-show": "bad",
  Canceled: "bad",
  Rescheduled: "warn",
  Upcoming: "idle",
  "Not logged": "warn",
};

const shortDay = (day: string | null) =>
  day
    ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "–";

export function AdCell({ person }: { person: BookedPerson }) {
  const { ad } = person;
  if (ad.note) return <span className="text-ui-text-muted">{ad.note}</span>;
  return (
    <div className="max-w-md">
      <p className="text-ui-text font-medium">
        {ad.adGroup ?? "Ad group unknown"}
      </p>
      <p className="text-ui-text-muted">{ad.campaign}</p>
      <p className="text-ui-text-muted">
        Keyword: {ad.keyword ?? "not captured"}
      </p>
      {ad.headlines.length ? (
        <p className="text-ui-text-subtle">
          Ad: {ad.headlines.slice(0, 3).join(" | ")}
        </p>
      ) : ad.possibleAds > 1 ? (
        <p className="text-ui-text-subtle">
          One of {ad.possibleAds} ads in this group
        </p>
      ) : null}
    </div>
  );
}

export function PeopleTable({
  people,
  lastColumn,
  adColumn = "Ad",
  showChannel = false,
}: {
  people: BookedPerson[];
  lastColumn: "Booked by" | "Why not counted";
  adColumn?: string;
  showChannel?: boolean;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[68rem] text-[0.8125rem]">
        <thead>
          <tr
            className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
          >
            {[
              "Person",
              ...(showChannel ? ["Channel"] : []),
              "Came in",
              "Booked",
              "Call",
              "Showed",
              "Capital",
              "Qualified",
              "Close status",
              lastColumn,
              adColumn,
            ].map((c) => (
              <th key={c} className="py-2 pr-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-ui-line divide-y">
          {people.map((p) => (
            <tr key={p.key} className="align-top">
              <td className="text-ui-text py-2 pr-3 font-medium">
                {p.closeUrl ? (
                  <a
                    href={p.closeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </td>
              {showChannel ? <td className="py-2 pr-3">{p.channel}</td> : null}
              <td className="py-2 pr-3 whitespace-nowrap">
                {shortDay(p.leadDay)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {shortDay(p.bookedDay)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {shortDay(p.callDay)}
              </td>
              <td className="py-2 pr-3">
                <AdminStatusBadge status={p.show} tone={SHOW_TONE[p.show]} />
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {p.capital ?? "No answer"}
              </td>
              <td className="py-2 pr-3">{p.qualified ?? "–"}</td>
              <td className="py-2 pr-3">{p.closeStatus ?? "–"}</td>
              <td className="py-2 pr-3">
                {lastColumn === "Booked by"
                  ? [p.bookedBy, p.bookedBy === "Marketing" ? null : p.setter]
                      .filter(Boolean)
                      .join(" · ") || "–"
                  : p.whyNotCounted}
              </td>
              <td className="py-2 pr-3">
                <AdCell person={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function showSummary(people: BookedPerson[]) {
  const count = (status: ShowStatus) =>
    people.filter((p) => p.show === status).length;
  return [
    `${count("Showed")} showed`,
    `${count("No-show")} no-show`,
    `${count("Rescheduled")} rescheduled`,
    `${count("Canceled")} canceled`,
    `${count("Upcoming")} upcoming`,
    `${count("Not logged")} not logged`,
  ].join(" · ");
}

export async function GoogleAdsBookedPeople({
  range,
}: {
  range: AdminAnalyticsRangeKey;
}) {
  const read = await getGoogleAdsBookedPeople(range);
  const title = "People booked from Google Ads";
  if (!read.ok)
    return (
      <section className={adminCardClass} aria-label={title}>
        <h2 className={adminEyebrowClass}>{title}</h2>
        <p className="text-ui-text-muted mt-3 text-sm">{read.error}</p>
      </section>
    );
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>
        {title}: {read.counted.length}
      </h2>
      <p className="text-ui-text-muted mt-2 max-w-3xl text-[0.8125rem]">
        Counted the way the company MTD counts calls: by the day the call was
        booked, on Dom&apos;s rule, on leads owned by his nine VP closers.{" "}
        {showSummary(read.counted)}. Names open in Close.
      </p>
      {read.counted.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No calls booked from Google Ads in this range.
        </p>
      ) : (
        <PeopleTable people={read.counted} lastColumn="Booked by" />
      )}
      {read.alsoInHeadline.length ? (
        <details className="mt-5">
          <summary className={`${adminEyebrowClass} cursor-pointer`}>
            Also in the booked count above, not on Dom&apos;s rule:{" "}
            {read.alsoInHeadline.length}
          </summary>
          <p className="text-ui-text-muted mt-2 max-w-3xl text-[0.8125rem]">
            The booked count at the top of this page is every ad-click lead who
            came in during this range and has a booked date, whenever and
            whatever the call.
          </p>
          <PeopleTable
            people={read.alsoInHeadline}
            lastColumn="Why not counted"
          />
        </details>
      ) : null}
    </section>
  );
}
