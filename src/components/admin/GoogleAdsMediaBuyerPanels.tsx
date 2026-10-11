import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { formatCount, formatUsd } from "@/lib/admin/format-number";
import {
  CHANGE_DATE,
  GOOGLE_ADS_CHANGES,
} from "@/lib/services/google-ads-changelog";
import type {
  BeforeAfter,
  CampaignHealth,
  PeriodStats,
  WastedTerm,
  Week,
} from "@/lib/services/google-ads-insights";

/** Google moves bidding to booked calls only after this many in 30 days. */
const BOOKINGS_ONLY_AT = 30;

const money = (n: number | null) => (n === null ? "–" : formatUsd(n));
const shortDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const th = "py-2 pr-3 font-semibold";
const td = "text-ui-text py-2.5 pr-3 text-right tabular-nums";

const NOT_SET_UP =
  "Waiting for a one-time database update (migration 20261011120000_google_ads_health_reports.sql in the Supabase SQL editor).";

export function GoogleAdsHealth({
  health,
  bookedInAds30d,
  setUp,
}: {
  health: CampaignHealth[];
  bookedInAds30d: number | null;
  setUp: boolean;
}) {
  return (
    <section className={adminCardClass} aria-label="Campaign health">
      <h2 className={adminEyebrowClass}>Campaign health</h2>
      {health.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          {setUp
            ? "No status yet. It arrives with the daily Google Ads script."
            : NOT_SET_UP}
        </p>
      ) : (
        <ul className="divide-ui-line mt-2 divide-y text-[0.8125rem]">
          {health.map((c) => (
            <li key={c.campaignId} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ui-text font-medium">{c.name}</span>
                <span className="text-ui-text-subtle tabular-nums">
                  {c.status === "ENABLED" ? "On" : "Paused"}
                  {c.dailyBudget === null
                    ? ""
                    : ` · ${formatUsd(c.dailyBudget)}/day`}
                  {` · ${c.approvedAds} approved, ${c.underReview} in review, ${c.disapproved} disapproved`}
                </span>
              </div>
              {c.flags.length > 0 ? (
                <p className="text-ui-warn-ink mt-1">{c.flags.join(" · ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-ui-text-subtle mt-3 text-sm">
        Booked calls Google has counted (CRM - Booked Call, last 30 days):{" "}
        <span className="text-ui-text font-medium tabular-nums">
          {bookedInAds30d === null ? "not synced yet" : bookedInAds30d}
        </span>{" "}
        of the {BOOKINGS_ONLY_AT} needed before bidding moves to booked calls
        only.
      </p>
    </section>
  );
}

function PeriodColumn({ title, stats }: { title: string; stats: PeriodStats }) {
  const items: Array<[string, string]> = [
    ["Cost per booked call", money(stats.costPerBooked)],
    ["Booked calls a week", String(stats.bookedPerWeek)],
    ["Spend a week", formatUsd(stats.spendPerWeek)],
  ];
  return (
    <div>
      <p className={adminEyebrowClass}>{title}</p>
      <p className="text-ui-text-subtle text-xs">
        {shortDay(stats.from)} to {shortDay(stats.to)} ({stats.days} days)
      </p>
      <dl className="mt-2 grid gap-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ui-text-subtle text-xs">{label}</dt>
            <dd className="text-ui-text text-xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function GoogleAdsBeforeAfter({ data }: { data: BeforeAfter }) {
  return (
    <section
      className={adminCardClass}
      aria-label="Before and after the booked-call change"
    >
      <h2 className={adminEyebrowClass}>
        Before vs after {shortDay(CHANGE_DATE)}
      </h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <PeriodColumn title="Baseline (frozen)" stats={data.before} />
        {data.after ? (
          <PeriodColumn title="Since the change" stats={data.after} />
        ) : (
          <p className="text-ui-text-subtle text-sm">No days since yet.</p>
        )}
      </div>
      <p className="text-ui-text-subtle mt-3 text-sm">
        {data.settled
          ? "Past the two-week learning period: this is the readout."
          : `Early signal only: Google is still learning, and recent leads are still booking. Full readout after ${shortDay(data.readoutAfter)}.`}
      </p>
    </section>
  );
}

export function GoogleAdsWeekly({ weeks }: { weeks: Week[] }) {
  return (
    <section className={adminCardClass} aria-label="Weekly trend">
      <h2 className={adminEyebrowClass}>Weekly trend</h2>
      {weeks.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No weeks in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className={th}>Week of</th>
                {[
                  "Spend",
                  "Leads",
                  "Booked calls",
                  "Cost per booked call",
                  "Won value",
                ].map((c) => (
                  <th key={c} className={`${th} text-right`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {weeks.map((w) => (
                <tr key={w.weekStart}>
                  <td className="text-ui-text py-2.5 pr-3 font-medium">
                    {shortDay(w.weekStart)}
                    {w.weekStart <= CHANGE_DATE &&
                    CHANGE_DATE < addWeek(w.weekStart) ? (
                      <span className="text-ui-text-subtle font-normal">
                        {" "}
                        · change
                      </span>
                    ) : null}
                  </td>
                  <td className={td}>{formatUsd(w.spend)}</td>
                  <td className={td}>{formatCount(w.leads)}</td>
                  <td className={td}>{formatCount(w.booked)}</td>
                  <td className={td}>{money(w.costPerBooked)}</td>
                  <td className={td}>{formatUsd(w.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function addWeek(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function GoogleAdsWaste({
  wasted,
  setUp,
}: {
  wasted: WastedTerm[];
  setUp: boolean;
}) {
  const negatives = GOOGLE_ADS_CHANGES.filter((c) => c.kind === "negatives");
  return (
    <section className={adminCardClass} aria-label="Wasted search terms">
      <h2 className={adminEyebrowClass}>Search terms with spend and no lead</h2>
      {wasted.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          {setUp
            ? "No search term spent $25 or more without a lead in this range."
            : NOT_SET_UP}
        </p>
      ) : (
        <ul className="divide-ui-line mt-2 divide-y text-[0.8125rem]">
          {wasted.map((t) => (
            <li key={t.term} className="flex justify-between gap-3 py-2">
              <span className="text-ui-text min-w-0 truncate">{t.term}</span>
              <span className="text-ui-text-subtle shrink-0 tabular-nums">
                {formatUsd(t.cost)} · {formatCount(t.clicks)} clicks
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ui-text-subtle mt-3 text-sm">
        Not every term here is waste: a few clicks with no lead is normal.
        Negatives applied:{" "}
        {negatives.map((n) => `${n.entity} (${n.at.slice(0, 10)})`).join("; ")}.
      </p>
    </section>
  );
}

export function GoogleAdsChangeLog() {
  const changes = [...GOOGLE_ADS_CHANGES].reverse();
  return (
    <section className={adminCardClass} aria-label="Account change log">
      <h2 className={adminEyebrowClass}>Account change log</h2>
      <ol className="divide-ui-line mt-2 divide-y text-[0.8125rem]">
        {changes.map((c) => (
          <li key={`${c.at}-${c.entity}`} className="py-3">
            <p className="text-ui-text font-medium">
              <span className="text-ui-text-subtle font-normal tabular-nums">
                {c.at}
              </span>{" "}
              {c.entity}
            </p>
            <p className="text-ui-text-muted mt-1">
              <span className="text-ui-text-subtle">Was:</span> {c.before}.{" "}
              <span className="text-ui-text-subtle">Now:</span> {c.after}.
            </p>
            <p className="text-ui-text-subtle mt-1">
              Why: {c.evidence}. Expected: {c.expected}.
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
