"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import { createBuilderRedirectAction, type RedirectFormState } from "./actions";
import { FieldError } from "./FieldError";
import { REDIRECT_STATUS_OPTIONS } from "./redirect-status-labels";
import { RedirectTypeLegend } from "./RedirectTypeLegend";

const initialState: RedirectFormState = { status: "idle" };

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminPrimaryButtonClass}
    >
      {pending ? "Creating…" : "Create redirect"}
    </button>
  );
}

export function RedirectCreateForm() {
  const [state, formAction] = useActionState(
    createBuilderRedirectAction,
    initialState,
  );

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <section className={`${adminPanelClass} mb-5 p-5`}>
      {state.status === "error" && !state.fieldErrors ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {state.message}
        </p>
      ) : null}
      {/* Re-key the form on each action result so the echoed `values` re-mount
          as fresh defaults — uncontrolled inputs ignore changed defaultValue
          across renders, so a stable key would blank the form after a failed
          submit. */}
      <form
        key={JSON.stringify(values ?? {})}
        action={formAction}
        className="grid gap-4 lg:grid-cols-4"
      >
        <label className={adminLabelClass}>
          Old address (path)
          <input
            name="sourcePath"
            required
            defaultValue={values?.sourcePath ?? ""}
            placeholder="/resources/old-page"
            aria-invalid={Boolean(fieldErrors.sourcePath)}
            className={adminInputClass}
          />
          <FieldError message={fieldErrors.sourcePath} />
        </label>
        <label className={adminLabelClass}>
          New address (destination)
          <input
            name="destinationPath"
            required
            defaultValue={values?.destinationPath ?? ""}
            placeholder="/blog/new-page"
            aria-invalid={Boolean(fieldErrors.destinationPath)}
            className={adminInputClass}
          />
          <FieldError message={fieldErrors.destinationPath} />
        </label>
        <label className={adminLabelClass}>
          Redirect type
          <select
            name="statusCode"
            defaultValue={values?.statusCode ?? "301"}
            aria-invalid={Boolean(fieldErrors.statusCode)}
            className={adminInputClass}
          >
            {REDIRECT_STATUS_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Use permanent for most renamed or moved pages.
          </span>
          <FieldError message={fieldErrors.statusCode} />
        </label>
        <div className="flex items-end">
          <CreateButton />
        </div>
        <div className="lg:col-span-4">
          <RedirectTypeLegend />
        </div>
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            Advanced page association
          </summary>
          <label className={`${adminLabelClass} mt-4 max-w-md`}>
            Related builder page
            <input
              name="pageId"
              placeholder="Optional page ID"
              className={adminInputClass}
              aria-describedby="redirect-page-id-help"
            />
            <span
              id="redirect-page-id-help"
              className="mt-1 block text-xs leading-5 text-slate-500"
            >
              Use only when linking this redirect to a specific builder page.
            </span>
          </label>
        </details>
      </form>
    </section>
  );
}
