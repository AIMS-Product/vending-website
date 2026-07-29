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
  adminDangerButtonClass,
  adminInputClass,
  adminPanelClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import { cn } from "@/lib/utils";
import type { RoutePrefix } from "@/lib/services/route-prefixes";

const initialState: RouteSettingsActionState = { status: "idle" };

// The shared input already is the admin's input. This only strips the label
// gap it assumes and adds the disabled state, rather than restating a shape.
const controlClass = cn(
  adminInputClass,
  "mt-0 min-w-0 disabled:cursor-not-allowed disabled:opacity-50",
);

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
        <section className="rounded-ui-lg border-ui-warn/25 bg-ui-warn-fill text-ui-warn-ink border px-4 py-3 text-sm">
          Route prefix management is read-only for your account. Super admins
          can add custom prefixes and delete unused ones.
        </section>
      ) : null}

      <section className={adminPanelClass}>
        <div className="border-ui-line border-b p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="shrink-0 lg:max-w-sm">
              <h2 className="text-ui-text text-base font-semibold">
                Add route prefix
              </h2>
              <p className="text-ui-text-muted mt-1 text-sm">
                A single lowercase segment like <code>/guides</code>. Builder
                pages can publish under any prefix in this list.
              </p>
            </div>
            <AddPrefixForm disabled={!canManage} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="divide-ui-line w-full min-w-[560px] divide-y text-left text-sm">
            <thead className="bg-ui-canvas text-ui-text-subtle text-xs font-semibold tracking-normal uppercase">
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
            <tbody className="divide-ui-line bg-ui-surface divide-y">
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
                    className="text-ui-text-subtle px-4 py-8 text-center text-sm"
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
      <td className="text-ui-text px-4 py-2.5 font-medium">
        <code>{entry.prefix}</code>
      </td>
      <td className="text-ui-text-muted px-4 py-2.5">{entry.label || "—"}</td>
      <td className="px-4 py-2.5">
        {entry.isDefault ? (
          <span className="bg-ui-idle-fill text-ui-idle-ink rounded-ui inline-flex items-center px-2 py-0.5 text-xs font-semibold">
            Default
          </span>
        ) : (
          <span className="text-ui-accent bg-ui-accent-soft rounded-ui inline-flex items-center px-2 py-0.5 text-xs font-semibold">
            Custom
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end">
          {entry.isDefault ? (
            <span className="text-ui-text-subtle text-xs font-semibold">
              Built-in
            </span>
          ) : canManage ? (
            <DeletePrefixForm prefix={entry.prefix} />
          ) : (
            <span className="text-ui-text-subtle text-xs font-semibold">
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
      className={`${adminPrimaryButtonClass} w-full whitespace-nowrap sm:w-auto`}
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
      className={cn(adminDangerButtonClass, "size-8 px-0")}
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
        state.status === "error" ? "text-ui-bad" : "text-ui-ok"
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}
