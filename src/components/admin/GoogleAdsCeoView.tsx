import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { formatCount, formatUsd } from "@/lib/admin/format-number";
import type { CeoSummary, Verdict } from "@/lib/services/google-ads-ceo";
import { CHANGE_DATE } from "@/lib/services/google-ads-changelog";
import type { GoogleAdsRow } from "@/lib/services/google-ads-dashboard";
import type { BeforeAfter } from "@/lib/services/google-ads-insights";

interface GoogleAdsCeoViewProps {
  rangeLabel: string;
  totals: GoogleAdsRow;
  beforeAfter: BeforeAfter;
  summary: CeoSummary;
}

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const money = (n: number | null) => (n === null ? "–" : formatUsd(n));

const VERDICT: Record<
  Verdict,
  { label: string; tone: "ok" | "warn" | "bad" | "idle" }
> = {
  better: { label: "Working", tone: "ok" },
  flat: { label: "No change", tone: "idle" },
  worse: { label: "Worse", tone: "bad" },
  "too-early": { label: "Too early to call", tone: "idle" },
};

const ACTION_TONE = { bad: "bad", warn: "warn", good: "ok" } as const;
const ACTION_LABEL = { bad: "Fix", warn: "Cut", good: "Grow" } as const;

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className={adminEyebrowClass}>{label}</p>
      <p className="text-ui-text mt-1 text-3xl font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-ui-text-subtle mt-1 text-[0.8125rem]">{sub}</p>
    </div>
  );
}

/** The page's first screen: what Google Ads cost, what it returned, and what needs a decision. */
export function GoogleAdsCeoView({
  rangeLabel,
  totals,
  beforeAfter,
  summary,
}: GoogleAdsCeoViewProps) {
  const before = beforeAfter.before.costPerBooked;
  const after = beforeAfter.after?.costPerBooked ?? null;
  const verdict = VERDICT[summary.verdict];
  return (
    <section className={adminCardClass} aria-label="Google Ads at a glance">
      <p className="text-ui-text text-lg font-medium">
        {rangeLabel}: Google Ads turned {formatUsd(totals.spend)} into{" "}
        {formatCount(totals.booked)} booked sales calls and{" "}
        {formatUsd(totals.wonValue)} in closed deals.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat
          label="Spent"
          value={formatUsd(totals.spend)}
          sub={`${formatCount(totals.leads)} leads`}
        />
        <Stat
          label="Booked calls"
          value={formatCount(totals.booked)}
          sub={
            totals.leads
              ? `${Math.round((totals.booked / totals.leads) * 100)}% of leads book`
              : "–"
          }
        />
        <Stat
          label="Cost per booked call"
          value={money(totals.costPerBooked)}
          sub={`${money(before)} before the ${day(CHANGE_DATE)} changes`}
        />
        <Stat
          label="Closed deals"
          value={formatUsd(totals.wonValue)}
          sub={
            summary.returnPerDollar === null
              ? `${formatCount(totals.won)} won`
              : `${formatCount(totals.won)} won · $${summary.returnPerDollar.toFixed(2)} back per $1 so far`
          }
        />
      </div>

      <div className="border-ui-line mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
        <AdminStatusBadge
          status={summary.verdict}
          label={verdict.label}
          tone={verdict.tone}
        />
        <span className="text-ui-text-muted">
          Since the {day(CHANGE_DATE)} fixes: {money(after)} per booked call vs{" "}
          {money(before)} before.
          {beforeAfter.settled
            ? ""
            : ` Final read on ${day(beforeAfter.readoutAfter)}.`}
        </span>
      </div>

      <div className="border-ui-line mt-4 border-t pt-4">
        <h2 className={adminEyebrowClass}>Needs a decision</h2>
        {summary.actions.length === 0 ? (
          <p className="text-ui-text-muted mt-2 text-sm">Nothing right now.</p>
        ) : (
          <ul className="mt-2 grid gap-3">
            {summary.actions.map((a) => (
              <li key={a.title} className="flex gap-3 text-sm">
                <AdminStatusBadge
                  status={a.tone}
                  label={ACTION_LABEL[a.tone]}
                  tone={ACTION_TONE[a.tone]}
                />
                <div>
                  <p className="text-ui-text font-medium">{a.title}</p>
                  <p className="text-ui-text-muted">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-ui-text-subtle mt-4 text-[0.75rem]">
        Closed deals count Google leads from this period that have since won;
        deals keep closing for weeks, so this grows.
      </p>
    </section>
  );
}
