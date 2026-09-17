"use client";

import { useActionState } from "react";
import { adminPanelClass } from "@/components/admin/AdminUi";
import {
  saveCacMonth,
  saveCacRoute,
  type CacActionState,
} from "@/app/admin/cac/actions";
import type {
  CacReport,
  CacRouteRow,
  CacStatus,
} from "@/lib/services/cac-report";

const IDLE: CacActionState = { status: "idle" };

const money = (value: number | null) =>
  value == null
    ? null
    : value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

const STATUS_LABEL: Record<CacStatus, string> = {
  beating: "Beating March",
  moderate: "Moderate overrun",
  critical: "Critical overrun",
  "no-closes": "No closes yet",
  "no-benchmark": "No March benchmark",
  "no-model": "No cost model",
};

// Semantic only: green and red mean good and bad, gray means not observed. Nothing
// here is decorative, so a reader never has to ask what a colour is telling them.
const STATUS_CLASS: Record<CacStatus, string> = {
  beating: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  moderate: "bg-amber-50 text-amber-900 ring-amber-200",
  critical: "bg-red-50 text-red-800 ring-red-200",
  "no-closes": "bg-ui-surface-subtle text-ui-text-subtle ring-ui-border",
  "no-benchmark": "bg-ui-surface-subtle text-ui-text-subtle ring-ui-border",
  "no-model": "bg-ui-surface-subtle text-ui-text-subtle ring-ui-border",
};

/** A dash is a real answer: nothing has been observed, which is not zero. */
function Cell({ value }: { value: string | null }) {
  return value == null ? (
    <span className="text-ui-text-subtle" title="Not observed">
      &mdash;
    </span>
  ) : (
    <>{value}</>
  );
}

function StatusChip({ status }: { status: CacStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const inputClass =
  "w-full rounded border border-ui-border bg-ui-surface px-2 py-1 text-sm text-ui-text focus:border-ui-accent focus:outline-none";

export function CacMonthControls({ report }: { report: CacReport }) {
  const [state, action, pending] = useActionState(saveCacMonth, IDLE);
  return (
    <form action={action} className={`${adminPanelClass} mb-6 p-4`}>
      <input type="hidden" name="month" value={report.month} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-ui-text text-sm">
          <span className="mb-1 block font-medium">Days in month</span>
          <input
            className={inputClass}
            name="daysInMonth"
            defaultValue={report.daysInMonth}
            inputMode="numeric"
          />
        </label>
        <label className="text-ui-text text-sm">
          <span className="mb-1 block font-medium">Days elapsed</span>
          <input
            className={inputClass}
            name="daysElapsed"
            defaultValue={report.daysElapsedIsDerived ? "" : report.daysElapsed}
            placeholder={`${report.daysElapsed} (from today)`}
            inputMode="numeric"
          />
        </label>
        <div className="text-ui-text-subtle text-sm">
          <span className="mb-1 block font-medium">Proration</span>
          {(report.prorationFactor * 100).toFixed(1)}% of the month
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-ui-accent rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving" : "Save month"}
        </button>
        {state.status !== "idle" ? (
          <p
            className={
              state.status === "error"
                ? "text-sm text-red-700"
                : "text-sm text-emerald-700"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
      <p className="text-ui-text-subtle mt-3 text-xs">
        Leave days elapsed blank and the tracker prorates against today, every
        time the page loads. A number pins it, which is what a closed month
        wants and what made the spreadsheet go stale between weekly updates.
      </p>
    </form>
  );
}

function RouteRow({ row }: { row: CacRouteRow }) {
  const [state, action, pending] = useActionState(saveCacRoute, IDLE);
  return (
    <tr className="border-ui-border border-t align-top">
      <td className="px-3 py-2">
        <form action={action} id={`cac-${row.id}`}>
          <input type="hidden" name="id" value={row.id} />
          <div className="text-ui-text font-medium">{row.route}</div>
          <input
            className={`${inputClass} mt-1`}
            name="owner"
            defaultValue={row.owner ?? ""}
            placeholder="Owner"
            aria-label={`Owner for ${row.route}`}
          />
        </form>
      </td>
      <td className="px-3 py-2">
        <input
          form={`cac-${row.id}`}
          className={inputClass}
          name="fixedMonthlyCost"
          defaultValue={row.fixedMonthlyCost ?? ""}
          placeholder="No model"
          inputMode="decimal"
          aria-label={`Fixed monthly cost for ${row.route}`}
        />
      </td>
      <td className="text-ui-text-subtle px-3 py-2 tabular-nums">
        <Cell value={money(row.proratedFixedCost)} />
      </td>
      <td className="px-3 py-2">
        <input
          form={`cac-${row.id}`}
          className={inputClass}
          name="variableSpend"
          defaultValue={row.variableSpend ?? ""}
          placeholder="Not recorded"
          inputMode="decimal"
          aria-label={`Variable spend for ${row.route}`}
        />
        {row.spendChannel ? (
          <label className="text-ui-text-subtle mt-1 flex items-center gap-1.5 text-xs">
            <input
              form={`cac-${row.id}`}
              type="checkbox"
              name="spendSource"
              value="auto"
              defaultChecked={row.spendSource === "auto"}
            />
            Use {row.spendChannel}: <Cell value={money(row.observedSpend)} />
          </label>
        ) : (
          <p className="text-ui-text-subtle mt-1 text-xs">
            No live spend source
          </p>
        )}
        {row.spendDisagreement != null ? (
          <p className="mt-1 text-xs text-amber-800">
            Typed is {money(Math.abs(row.spendDisagreement))}{" "}
            {row.spendDisagreement > 0 ? "above" : "below"} what the ads data
            shows.
          </p>
        ) : null}
      </td>
      <td className="text-ui-text px-3 py-2 font-medium tabular-nums">
        <Cell value={money(row.totalCost)} />
      </td>
      <td className="px-3 py-2">
        <input
          form={`cac-${row.id}`}
          className={inputClass}
          name="closedWon"
          defaultValue={row.closedWon ?? ""}
          placeholder="Not recorded"
          inputMode="numeric"
          aria-label={`Closed won for ${row.route}`}
        />
      </td>
      <td className="text-ui-text px-3 py-2 font-semibold tabular-nums">
        <Cell value={money(row.cac)} />
      </td>
      <td className="px-3 py-2">
        <input
          form={`cac-${row.id}`}
          className={inputClass}
          name="marchCac"
          defaultValue={row.marchCac ?? ""}
          placeholder="No benchmark"
          inputMode="decimal"
          aria-label={`March CAC for ${row.route}`}
        />
      </td>
      <td className="px-3 py-2 tabular-nums">
        <Cell
          value={
            row.deltaPercent == null
              ? null
              : `${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent.toFixed(0)}%`
          }
        />
      </td>
      <td className="px-3 py-2">
        <StatusChip status={row.status} />
      </td>
      <td className="px-3 py-2">
        <button
          form={`cac-${row.id}`}
          type="submit"
          disabled={pending}
          className="border-ui-border text-ui-text rounded border px-2 py-1 text-xs disabled:opacity-60"
        >
          {pending ? "Saving" : "Save"}
        </button>
        {state.status === "error" ? (
          <p className="mt-1 text-xs text-red-700">{state.message}</p>
        ) : null}
        {state.status === "saved" ? (
          <p className="mt-1 text-xs text-emerald-700">{state.message}</p>
        ) : null}
      </td>
    </tr>
  );
}

export function CacTable({ report }: { report: CacReport }) {
  const groups = [...new Set(report.rows.map((row) => row.groupLabel))];
  return (
    <div className={`${adminPanelClass} overflow-x-auto`}>
      <table className="w-full min-w-[68rem] text-left text-sm">
        <thead className="text-ui-text-subtle text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              Route / owner
            </th>
            <th scope="col" className="px-3 py-2">
              Fixed monthly
            </th>
            <th scope="col" className="px-3 py-2">
              Prorated
            </th>
            <th scope="col" className="px-3 py-2">
              Variable spend
            </th>
            <th scope="col" className="px-3 py-2">
              Total cost
            </th>
            <th scope="col" className="px-3 py-2">
              Closed won
            </th>
            <th scope="col" className="px-3 py-2">
              CAC
            </th>
            <th scope="col" className="px-3 py-2">
              March CAC
            </th>
            <th scope="col" className="px-3 py-2">
              Delta
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Save</span>
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group}>
            <tr className="bg-ui-surface-subtle">
              <th
                scope="colgroup"
                colSpan={11}
                className="text-ui-text-subtle px-3 py-1.5 text-xs font-semibold uppercase"
              >
                {group}
              </th>
            </tr>
            {report.rows
              .filter((row) => row.groupLabel === group)
              .map((row) => (
                <RouteRow key={row.id} row={row} />
              ))}
          </tbody>
        ))}
        <tfoot>
          <tr className="border-ui-border text-ui-text border-t-2 font-semibold">
            <td className="px-3 py-2">All routes</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2 tabular-nums">
              <Cell value={money(report.total.totalCost)} />
            </td>
            <td className="px-3 py-2 tabular-nums">
              <Cell value={report.total.closedWon?.toString() ?? null} />
            </td>
            <td className="px-3 py-2 tabular-nums">
              <Cell value={money(report.total.cac)} />
            </td>
            <td className="px-3 py-2" colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
