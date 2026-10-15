import {
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  pct,
  rangeLabel,
  TD,
  TH,
} from "@/components/admin/marketing-mtd-format";
import type { GoalPlan } from "@/lib/services/marketing-mtd";

/** Jess's 125-a-week goal: where the month stands and the catch-up plan. */
export function MarketingGoalPanel({
  goal,
  booked,
}: {
  goal: GoalPlan;
  booked: number;
}) {
  const tiles = [
    {
      label: "MTD target",
      value: goal.mtdTarget.toLocaleString("en-US"),
      note: `${goal.dailyGoal} a workday × ${goal.workdaysElapsed}`,
    },
    {
      label: "Against target",
      value: `${goal.mtdGap > 0 ? "+" : goal.mtdGap < 0 ? "−" : ""}${Math.abs(goal.mtdGap)}`,
      note: `${pct(goal.attainment)} of target`,
    },
    {
      label: "Weekly average",
      value:
        goal.weeklyAverage === null
          ? "—"
          : Math.round(goal.weeklyAverage).toLocaleString("en-US"),
      note: `against ${goal.weeklyGoal} a week`,
    },
    {
      label: "Month goal",
      value: goal.monthGoal.toLocaleString("en-US"),
      note: `${goal.needed} more needed`,
    },
    {
      label: "Needed per full week",
      value:
        goal.requiredWeek === null
          ? "—"
          : goal.requiredWeek.toLocaleString("en-US"),
      note:
        goal.requiredWeek === null
          ? goal.needed > 0
            ? `Month over: ${goal.needed} short of goal`
            : "Goal met"
          : `${goal.requiredWeek - goal.weeklyGoal > 0 ? `${goal.requiredWeek - goal.weeklyGoal} above` : "within"} the weekly goal`,
    },
  ];
  return (
    <section className={adminPanelClass} aria-label="Booking goal">
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>
          Booking goal: {goal.weeklyGoal} a week
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Planned over a Monday to Friday week ({goal.dailyGoal} a workday, no
          holiday adjustment); weekend bookings still count. {booked} booked
          over {goal.workdaysElapsed} workdays so far, today included,{" "}
          {goal.workdaysLeft} workdays left. No per-channel quotas.
        </p>
      </div>
      <dl className="divide-ui-line mt-3 grid grid-cols-2 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {tiles.map((tile) => (
          <div key={tile.label} className="px-4 py-3">
            <dt className={adminEyebrowClass}>{tile.label}</dt>
            <dd className="text-ui-text mt-1.5 text-lg font-semibold tabular-nums">
              {tile.value}
            </dd>
            <dd className="text-ui-text-muted mt-0.5 text-xs">{tile.note}</dd>
          </div>
        ))}
      </dl>
      {goal.segments.length > 0 && (
        <div className="border-ui-line border-t">
          <p
            id="catch-up-plan"
            className="text-ui-text-muted px-4 py-3 text-left text-xs"
          >
            Catch-up plan: {goal.requiredDaily?.toFixed(2)} a workday from
            tomorrow, rounded up per week. Recomputed on every load.
          </p>
          <div className="overflow-x-auto">
            <table
              aria-describedby="catch-up-plan"
              className="w-full min-w-[26rem] text-sm"
            >
              <thead className="bg-ui-canvas text-ui-text-muted text-xs">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-semibold"
                  >
                    Remaining window
                  </th>
                  <th scope="col" className={TH}>
                    Workdays
                  </th>
                  <th scope="col" className={TH}>
                    Calls to book
                  </th>
                  <th scope="col" className={TH}>
                    Month to date after
                  </th>
                </tr>
              </thead>
              <tbody>
                {goal.segments.map((segment) => (
                  <tr key={segment.from} className="border-ui-line/60 border-t">
                    <th
                      scope="row"
                      className="px-4 py-2 text-left font-normal whitespace-nowrap"
                    >
                      {rangeLabel({ from: segment.from, to: segment.to })}
                    </th>
                    <td className={TD}>{segment.workdays}</td>
                    <td className={TD}>{segment.calls}</td>
                    <td className={TD}>{segment.milestone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
