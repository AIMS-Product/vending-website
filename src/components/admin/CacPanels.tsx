"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const usd = (value: number, cents = false) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

const STATUS_LABEL: Record<CacStatus, string> = {
  beating: "Beating March",
  moderate: "Over March",
  critical: "Well over March",
  "no-closes": "No closes",
  "no-benchmark": "No benchmark",
  "no-model": "No cost model",
};

// Colour is reserved for the verdict. Everything unobserved shares one neutral, so
// a reader scanning the column sees three real states rather than six chips.
const STATUS_CLASS: Record<CacStatus, string> = {
  beating: "bg-ui-ok-fill text-ui-ok-ink",
  moderate: "bg-ui-warn-fill text-ui-warn-ink",
  critical: "bg-ui-bad-fill text-ui-bad-ink",
  "no-closes": "bg-ui-canvas text-ui-text-subtle",
  "no-benchmark": "bg-ui-canvas text-ui-text-subtle",
  "no-model": "bg-ui-canvas text-ui-text-subtle",
};

/** Nothing observed. Never a zero, and never the same weight as a real number. */
function Dash() {
  return (
    <span className="text-ui-text-subtle" title="Not recorded">
      &ndash;
    </span>
  );
}

/**
 * Borderless until you touch it. Fifty-five bordered boxes made the table read as a
 * form, so the chrome only appears on hover and focus; at rest a typed number looks
 * like the number it is.
 */
const cellInput =
  "w-full rounded-ui border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums text-ui-text " +
  "placeholder:text-ui-text-subtle hover:border-ui-line focus:border-ui-accent focus:bg-ui-surface focus:outline-none";

const headCell =
  "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ui-text-subtle";

export function CacMonthControls({ report }: { report: CacReport }) {
  const [state, action, pending] = useActionState(saveCacMonth, IDLE);
  return (
    <form
      action={action}
      className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3"
    >
      <input type="hidden" name="month" value={report.month} />
      <label className="text-sm">
        <span className="text-ui-text-muted mb-1 block text-xs">
          Days in month
        </span>
        <input
          className="border-ui-line-strong rounded-ui bg-ui-surface text-ui-text focus:border-ui-accent w-24 border px-2 py-1 text-sm tabular-nums focus:outline-none"
          name="daysInMonth"
          defaultValue={report.daysInMonth}
          inputMode="numeric"
        />
      </label>
      <label className="text-sm">
        <span className="text-ui-text-muted mb-1 block text-xs">
          Days elapsed
        </span>
        <input
          className="border-ui-line-strong rounded-ui bg-ui-surface text-ui-text focus:border-ui-accent w-40 border px-2 py-1 text-sm tabular-nums focus:outline-none"
          name="daysElapsed"
          defaultValue={report.daysElapsedIsDerived ? "" : report.daysElapsed}
          placeholder={`${report.daysElapsed} from today`}
          inputMode="numeric"
        />
      </label>
      <p className="text-ui-text-muted pb-1.5 text-sm">
        Prorating at{" "}
        <span className="text-ui-text font-semibold tabular-nums">
          {(report.prorationFactor * 100).toFixed(1)}%
        </span>{" "}
        of the month
        {report.daysElapsedIsDerived ? ", tracking today" : ", pinned"}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="bg-ui-accent hover:bg-ui-accent-hover rounded-ui px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving" : "Save"}
      </button>
      {state.status !== "idle" ? (
        <p
          className={`pb-1.5 text-sm ${state.status === "saved" ? "text-ui-ok" : "text-ui-bad"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function RouteRow({ row }: { row: CacRouteRow }) {
  const [state, action, pending] = useActionState(saveCacRoute, IDLE);
  const [dirty, setDirty] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // A save writes only what changed, so the row must forget what it changed once the
  // write lands. The signal is the row version: a successful save revalidates and the
  // server sends a new `updatedAt`, which is also exactly when the inputs are showing
  // saved values again. Adjusting during render rather than in an effect, because an
  // effect here would render the stale dirty set first.
  const [seenVersion, setSeenVersion] = useState(row.updatedAt);
  if (row.updatedAt !== seenVersion) {
    setSeenVersion(row.updatedAt);
    if (dirty.length) setDirty([]);
  }

  // A refused write means somebody else got there first, so pull their value in.
  useEffect(() => {
    if (state.status === "conflict") router.refresh();
  }, [state, router]);

  const markDirty = (name: string) =>
    setDirty((current) =>
      current.includes(name) ? current : [...current, name],
    );

  const overBenchmark = row.deltaPercent != null && row.deltaPercent > 0;

  return (
    <tr className="border-ui-line hover:bg-ui-canvas/60 border-t align-middle">
      <td className="py-2 pr-3 pl-4">
        <form
          ref={formRef}
          action={action}
          id={`cac-${row.id}`}
          className="contents"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="updatedAt" value={row.updatedAt} />
          <input type="hidden" name="changed" value={dirty.join(",")} />
        </form>
        <div className="text-ui-text text-sm font-medium">{row.route}</div>
        <input
          form={`cac-${row.id}`}
          name="owner"
          defaultValue={row.owner ?? ""}
          onChange={() => markDirty("owner")}
          placeholder="Unowned"
          aria-label={`Owner of ${row.route}`}
          className="text-ui-text-muted rounded-ui hover:border-ui-line focus:border-ui-accent focus:bg-ui-surface -mx-1 mt-0.5 w-40 border border-transparent bg-transparent px-1 text-xs focus:outline-none"
        />
      </td>

      <td className="px-1 py-2">
        <input
          form={`cac-${row.id}`}
          className={cellInput}
          name="fixedMonthlyCost"
          defaultValue={row.fixedMonthlyCost ?? ""}
          onChange={() => markDirty("fixedMonthlyCost")}
          placeholder="none"
          inputMode="decimal"
          aria-label={`Fixed monthly cost for ${row.route}`}
        />
      </td>

      <td className="px-1 py-2">
        <input
          form={`cac-${row.id}`}
          className={cellInput}
          name="variableSpend"
          defaultValue={row.variableSpend ?? ""}
          onChange={() => markDirty("variableSpend")}
          placeholder="none"
          inputMode="decimal"
          aria-label={`Variable spend for ${row.route}`}
        />
        {row.spendChannel ? (
          <label className="text-ui-text-muted mt-1 flex items-center justify-end gap-1.5 pr-2 text-[11px]">
            <input
              form={`cac-${row.id}`}
              type="checkbox"
              name="spendSource"
              value="auto"
              defaultChecked={row.spendSource === "auto"}
              onChange={() => markDirty("spendSource")}
            />
            use {row.observedSpend == null ? "feed" : usd(row.observedSpend)}
          </label>
        ) : null}
        {row.spendDisagreement != null ? (
          <p className="text-ui-warn mt-0.5 pr-2 text-right text-[11px]">
            {usd(Math.abs(row.spendDisagreement))}{" "}
            {row.spendDisagreement > 0 ? "over" : "under"} the ads feed
          </p>
        ) : null}
      </td>

      <td className="px-1 py-2">
        <input
          form={`cac-${row.id}`}
          className={cellInput}
          name="closedWon"
          defaultValue={row.closedWon ?? ""}
          onChange={() => markDirty("closedWon")}
          placeholder="none"
          inputMode="numeric"
          aria-label={`Closed won for ${row.route}`}
        />
        {row.closedWonClose != null ? (
          <p className="text-ui-text-muted mt-1 pr-2 text-right text-[11px]">
            Close: {row.closedWonClose} (used)
          </p>
        ) : (
          <p className="text-ui-text-subtle mt-1 pr-2 text-right text-[11px]">
            typed (no Close count)
          </p>
        )}
      </td>

      {/* Everything right of here is computed. The fill is the boundary. */}
      <td className="bg-ui-canvas border-ui-line text-ui-text-muted border-l px-3 py-2 text-right text-sm tabular-nums">
        {row.totalCost == null ? <Dash /> : usd(row.totalCost)}
        {row.proratedFixedCost != null && row.proratedFixedCost > 0 ? (
          <span className="text-ui-text-subtle block text-[11px]">
            {usd(row.proratedFixedCost)} prorated
          </span>
        ) : null}
      </td>

      <td className="bg-ui-canvas px-3 py-2 text-right">
        {row.cac == null ? (
          <Dash />
        ) : (
          <>
            <span className="text-ui-text block text-base font-semibold tabular-nums">
              {usd(row.cac)}
            </span>
            {row.deltaPercent != null ? (
              <span
                className={`block text-[11px] tabular-nums ${overBenchmark ? "text-ui-bad" : "text-ui-ok"}`}
              >
                {overBenchmark ? "+" : ""}
                {row.deltaPercent.toFixed(0)}% vs March
              </span>
            ) : null}
          </>
        )}
      </td>

      <td className="bg-ui-canvas px-1 py-2">
        <input
          form={`cac-${row.id}`}
          className={`${cellInput} text-ui-text-muted`}
          name="marchCac"
          defaultValue={row.marchCac ?? ""}
          onChange={() => markDirty("marchCac")}
          placeholder="none"
          inputMode="decimal"
          aria-label={`March benchmark for ${row.route}`}
        />
      </td>

      <td className="bg-ui-canvas px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_CLASS[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
      </td>

      {/* One save button, and only once there is something to save. */}
      <td className="bg-ui-canvas w-24 py-2 pr-4 pl-1 text-right">
        {dirty.length > 0 ? (
          <button
            form={`cac-${row.id}`}
            type="submit"
            disabled={pending}
            className="bg-ui-accent hover:bg-ui-accent-hover rounded-ui px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving" : "Save"}
          </button>
        ) : state.status === "saved" ? (
          <span className="text-ui-ok text-[11px]">Saved</span>
        ) : null}
        {state.status === "conflict" || state.status === "error" ? (
          <p className="text-ui-bad mt-1 text-left text-[11px] leading-tight">
            {state.message}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Other people are editing this too. A quiet reload every half minute keeps the page
 * current without a socket, and it holds off while somebody is mid-edit so a refresh
 * never throws away a number being typed.
 */
export function CacAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement;
      if (!typing && !document.hidden) router.refresh();
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}

export function CacTable({ report }: { report: CacReport }) {
  const groups = [...new Set(report.rows.map((row) => row.groupLabel))];
  return (
    <div className={`${adminPanelClass} overflow-x-auto`}>
      <table className="w-full min-w-[60rem] border-collapse text-left">
        <thead className="bg-ui-surface">
          <tr className="border-ui-line border-b">
            <th scope="col" className={`${headCell} pl-4`}>
              Route
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Fixed / month
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Variable spend
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Closed won
            </th>
            <th
              scope="col"
              className={`${headCell} bg-ui-canvas border-ui-line border-l text-right`}
            >
              Total cost
            </th>
            <th scope="col" className={`${headCell} bg-ui-canvas text-right`}>
              CAC
            </th>
            <th scope="col" className={`${headCell} bg-ui-canvas text-right`}>
              March
            </th>
            <th scope="col" className={`${headCell} bg-ui-canvas`}>
              Status
            </th>
            <th scope="col" className={`${headCell} bg-ui-canvas`}>
              <span className="sr-only">Save</span>
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group}>
            <tr>
              <th
                scope="colgroup"
                colSpan={9}
                className="text-ui-text-subtle border-ui-line bg-ui-sidebar border-t px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
              >
                {group.replace(" ROUTES", "")}
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
          <tr className="border-ui-line-strong bg-ui-surface border-t-2">
            <td className="text-ui-text py-3 pl-4 text-sm font-semibold">
              All routes
            </td>
            <td colSpan={2} />
            <td className="text-ui-text px-1 py-3 pr-2 text-right text-sm font-semibold tabular-nums">
              {report.total.closedWon ?? <Dash />}
            </td>
            <td className="bg-ui-canvas border-ui-line text-ui-text border-l px-3 py-3 text-right text-sm font-semibold tabular-nums">
              {report.total.totalCost == null ? (
                <Dash />
              ) : (
                usd(report.total.totalCost)
              )}
            </td>
            <td className="bg-ui-canvas text-ui-text px-3 py-3 text-right text-lg font-semibold tabular-nums">
              {report.total.cac == null ? <Dash /> : usd(report.total.cac)}
            </td>
            <td className="bg-ui-canvas" colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
