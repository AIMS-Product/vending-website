"use client";

import { useActionState } from "react";
import {
  updateLinkMeta,
  type LinkMetaActionState,
} from "@/app/admin/links/actions";
import {
  adminInputClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import { FUNNEL_NAMES } from "@/lib/analytics/funnel-names";
import type { RegistryLink } from "@/lib/services/marketing-links";
import { cn } from "@/lib/utils";

/**
 * The funnel side of /admin/links: which funnel each link feeds, editing it
 * in place, and each funnel's totals. Replaces the UTM master sheet's
 * "Funnel Name" column.
 */

/** Where a funnel came from, so a guess is never read as a decision. */
export function funnelSetBy(setBy: string | null): string {
  if (setBy === "sheet") return "from the old sheet";
  if (setBy === "close") return "from Close records";
  if (setBy === "rule") return "by source";
  return setBy ? `set by ${setBy.split("@")[0]}` : "set";
}

const idleMeta: LinkMetaActionState = { status: "idle" };

/** Funnel, owner and note on one row. The five tags are fixed once a link is out. */
export function LinkMetaForm({
  link,
  onDone,
}: {
  link: RegistryLink;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: LinkMetaActionState, data: FormData) => {
      const next = await updateLinkMeta(prev, data);
      if (next.status === "saved") onDone();
      return next;
    },
    idleMeta,
  );
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 lg:flex-row lg:items-end"
    >
      <input type="hidden" name="id" value={link.id} />
      <label className="text-ui-text-muted block text-xs">
        Funnel
        <select
          name="funnelName"
          defaultValue={link.funnel_name ?? ""}
          className={cn(adminInputClass, "mt-1")}
        >
          <option value="">No funnel</option>
          {FUNNEL_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-ui-text-muted block text-xs">
        Owner
        <input
          name="owner"
          type="text"
          defaultValue={link.owner ?? ""}
          placeholder="Mike, Anthony, a setter"
          className={cn(adminInputClass, "mt-1")}
        />
      </label>
      <label className="text-ui-text-muted block min-w-0 flex-1 text-xs">
        Note
        <input
          name="label"
          type="text"
          defaultValue={link.label ?? ""}
          className={cn(adminInputClass, "mt-1")}
        />
      </label>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className={adminSmallButtonClass}
        >
          {pending ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className={adminSmallButtonClass}
        >
          Cancel
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-ui-bad text-xs">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export type FunnelTotal = {
  funnel: string;
  links: number;
  leads: number;
  booked: number;
  calendarBookings: number;
};

/**
 * Each funnel's links and what they brought in. A lead matches exactly one
 * link (the whole five-tag tuple), so summing the rows never counts one twice.
 */
export function totalsByFunnel(links: readonly RegistryLink[]): FunnelTotal[] {
  const totals = new Map<string, FunnelTotal>();
  for (const link of links) {
    if (!link.funnel_name) continue;
    const row = totals.get(link.funnel_name) ?? {
      funnel: link.funnel_name,
      links: 0,
      leads: 0,
      booked: 0,
      calendarBookings: 0,
    };
    totals.set(link.funnel_name, {
      ...row,
      links: row.links + 1,
      leads: row.leads + (link.stats?.leads ?? 0),
      booked: row.booked + (link.stats?.booked ?? 0),
      calendarBookings:
        row.calendarBookings + (link.stats?.calendarBookings ?? 0),
    });
  }
  return [...totals.values()].sort(
    (a, b) => b.leads + b.calendarBookings - (a.leads + a.calendarBookings),
  );
}

export function FunnelTotals({
  rows,
  statsFailed,
  onPick,
}: {
  rows: FunnelTotal[];
  statsFailed: boolean;
  onPick: (funnel: string) => void;
}) {
  if (rows.length === 0) return null;
  const show = (value: number) => (statsFailed ? "–" : value.toLocaleString());
  return (
    <details className="text-sm">
      <summary className="text-ui-text-muted cursor-pointer">
        Totals by funnel ({rows.length})
      </summary>
      <div className="relative mt-2 overflow-x-auto">
        <table className="divide-ui-line w-full min-w-[32rem] divide-y text-left">
          <thead className="text-ui-text-subtle text-xs font-semibold uppercase">
            <tr>
              <th scope="col" className="py-1.5 pr-4">
                Funnel
              </th>
              {["Links", "Leads", "Booked", "Calendar"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-1.5 text-right"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {rows.map((row) => (
              <tr key={row.funnel}>
                <td className="py-1.5 pr-4">
                  <button
                    type="button"
                    onClick={() => onPick(row.funnel)}
                    className="text-ui-accent underline-offset-2 hover:underline"
                  >
                    {row.funnel}
                  </button>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {row.links}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {show(row.leads)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {show(row.booked)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {show(row.calendarBookings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
