"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addRoutePrefix,
  removeRoutePrefix,
  type RouteSettingsActionState,
} from "@/app/admin/settings/routes/actions";
import {
  AdminIcon,
  adminPanelClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import type { RoutePrefix } from "@/lib/services/route-prefixes";

const initialState: RouteSettingsActionState = { status: "idle" };

const controlClass =
  "box-border h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm leading-none text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminRoutePrefixesManager({
  prefixes,
  currentUserRole,
}: {
  prefixes: RoutePrefix[];
  currentUserRole: "admin" | "super_admin";
}) {
  const canManage = currentUserRole === "super_admin";

  return (
    <div className="grid gap-5">
      {!canManage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Route prefix management is read-only for your account. Super admins
          can add custom prefixes and delete unused ones.
        </section>
      ) : null}

      <section className={adminPanelClass}>
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="shrink-0 lg:max-w-sm">
              <h2 className="text-base font-semibold text-slate-950">
                Add route prefix
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                A single lowercase segment like <code>/guides</code>. Builder
                pages can publish under any prefix in this list.
              </p>
            </div>
            <AddPrefixForm disabled={!canManage} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Prefix
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Label
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Type
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {prefixes.length ? (
                prefixes.map((entry) => (
                  <PrefixRow
                    key={entry.prefix}
                    entry={entry}
                    canManage={canManage}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No route prefixes configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PrefixRow({
  entry,
  canManage,
}: {
  entry: RoutePrefix;
  canManage: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium text-slate-950">
        <code>{entry.prefix}</code>
      </td>
      <td className="px-4 py-2.5 text-slate-700">{entry.label || "—"}</td>
      <td className="px-4 py-2.5">
        {entry.isDefault ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Default
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-xs font-semibold text-[#0b63f6]">
            Custom
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end">
          {entry.isDefault ? (
            <span className="text-xs font-semibold text-slate-500">
              Built-in
            </span>
          ) : canManage ? (
            <DeletePrefixForm prefix={entry.prefix} />
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              Super-admin only
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddPrefixForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useActionState(addRoutePrefix, initialState);
  return (
    <form action={formAction} className="w-full min-w-0 lg:max-w-3xl lg:flex-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
        <input
          id="route-prefix"
          name="prefix"
          type="text"
          required
          disabled={disabled}
          aria-label="Route prefix"
          placeholder="/guides"
          className={controlClass}
        />
        <input
          id="route-prefix-label"
          name="label"
          type="text"
          disabled={disabled}
          aria-label="Route prefix label"
          placeholder="Guides"
          className={controlClass}
        />
        <AddSubmitButton disabled={disabled} />
      </div>
      <ActionMessage state={state} className="mt-2" />
    </form>
  );
}

function AddSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${adminPrimaryButtonClass} h-11 w-full whitespace-nowrap sm:w-auto`}
    >
      <span aria-hidden="true">
        <AdminIcon icon="plus" />
      </span>
      {pending ? "Working..." : "Add prefix"}
    </button>
  );
}

function DeletePrefixForm({ prefix }: { prefix: string }) {
  const [state, formAction] = useActionState(removeRoutePrefix, initialState);
  return (
    <form action={formAction} className="grid justify-items-end gap-1.5">
      <input type="hidden" name="prefix" value={prefix} />
      <DeleteSubmitButton prefix={prefix} />
      <ActionMessage state={state} />
    </form>
  );
}

function DeleteSubmitButton({ prefix }: { prefix: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Delete route prefix ${prefix}`}
      title="Delete prefix"
      className="inline-flex size-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true">
        <AdminIcon icon="trash" />
      </span>
      <span className="sr-only">{pending ? "Working..." : "Delete"}</span>
    </button>
  );
}

function ActionMessage({
  state,
  className = "",
}: {
  state: RouteSettingsActionState;
  className?: string;
}) {
  if (state.status === "idle") return null;
  return (
    <p
      className={`${className} text-xs font-medium ${
        state.status === "error" ? "text-red-600" : "text-emerald-700"
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}
