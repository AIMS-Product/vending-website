"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminDangerButtonClass,
  adminInputClass,
  adminSecondaryButtonClass,
  adminSmallButtonClass,
  AdminIcon,
} from "@/components/admin/AdminUi";
import { formatPacificDate } from "@/lib/page-builder/datetime-format";
import {
  deleteBuilderRedirectAction,
  updateBuilderRedirectAction,
  type RedirectFormState,
} from "./actions";
import { FieldError } from "./FieldError";
import {
  REDIRECT_STATUS_OPTIONS,
  redirectStatusLabel,
} from "./redirect-status-labels";
import { RedirectTypeLegend } from "./RedirectTypeLegend";

export type RedirectRowData = {
  id: string;
  source_path: string;
  destination_path: string;
  status_code: number;
  created_reason: string;
  created_at: string;
};

const initialState: RedirectFormState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={adminSmallButtonClass}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete redirect"}
    </button>
  );
}

export function RedirectRow({ redirect }: { redirect: RedirectRowData }) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogTitleId = useId();

  if (editing) {
    return (
      <RedirectEditForm redirect={redirect} onClose={() => setEditing(false)} />
    );
  }

  return (
    <tr>
      <td className="px-5 py-3 font-mono text-xs text-slate-700">
        {redirect.source_path}
      </td>
      <td className="px-5 py-3 font-mono text-xs text-slate-700">
        {redirect.destination_path}
      </td>
      <td className="px-5 py-3">{redirectStatusLabel(redirect.status_code)}</td>
      <td className="px-5 py-3">{redirect.created_reason}</td>
      <td className="px-5 py-3">{formatPacificDate(redirect.created_at)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={adminSmallButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="pencil" />
            </span>
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={adminDangerButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="trash" />
            </span>
            Delete
          </button>
        </div>
        {confirmOpen ? (
          <RedirectDeleteDialog
            redirect={redirect}
            titleId={dialogTitleId}
            onClose={() => setConfirmOpen(false)}
          />
        ) : null}
      </td>
    </tr>
  );
}

function RedirectEditForm({
  redirect,
  onClose,
}: {
  redirect: RedirectRowData;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(
    updateBuilderRedirectAction,
    initialState,
  );
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <tr>
      <td colSpan={6} className="px-5 py-4">
        {/* Re-key on each error so the admin's edited (invalid) values survive
            the re-render instead of snapping back to the stored row. */}
        <form
          key={JSON.stringify(values ?? {})}
          action={formAction}
          className="grid gap-3 lg:grid-cols-12"
        >
          <input type="hidden" name="id" value={redirect.id} />
          <label className="text-xs font-medium text-slate-600 lg:col-span-4">
            Old address (path)
            <input
              name="sourcePath"
              defaultValue={values?.sourcePath ?? redirect.source_path}
              aria-invalid={Boolean(fieldErrors.sourcePath)}
              className={adminInputClass}
            />
            <FieldError message={fieldErrors.sourcePath} />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-4">
            New address (destination)
            <input
              name="destinationPath"
              defaultValue={
                values?.destinationPath ?? redirect.destination_path
              }
              aria-invalid={Boolean(fieldErrors.destinationPath)}
              className={adminInputClass}
            />
            <FieldError message={fieldErrors.destinationPath} />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-2">
            Redirect type
            <select
              name="statusCode"
              defaultValue={values?.statusCode ?? String(redirect.status_code)}
              aria-invalid={Boolean(fieldErrors.statusCode)}
              className={adminInputClass}
            >
              {REDIRECT_STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.statusCode} />
          </label>
          <div className="flex items-end gap-2 lg:col-span-2">
            <SaveButton />
            <button
              type="button"
              onClick={onClose}
              className={adminSecondaryButtonClass}
            >
              Cancel
            </button>
          </div>
          <div className="lg:col-span-12">
            <RedirectTypeLegend heading={false} />
          </div>
          {state.status === "error" && !state.fieldErrors ? (
            <p
              role="alert"
              className="text-xs font-semibold text-red-700 lg:col-span-12"
            >
              {state.message}
            </p>
          ) : null}
        </form>
      </td>
    </tr>
  );
}

function RedirectDeleteDialog({
  redirect,
  titleId,
  onClose,
}: {
  redirect: RedirectRowData;
  titleId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(
    deleteBuilderRedirectAction,
    initialState,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6"
    >
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-left shadow-xl">
        <h2 id={titleId} className="text-base font-semibold text-slate-950">
          Delete this redirect?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <span className="font-mono text-xs">{redirect.source_path}</span> will
          stop sending people to{" "}
          <span className="font-mono text-xs">{redirect.destination_path}</span>
          . Anyone visiting the old path will see the live page or a 404
          instead.
        </p>
        {state.status === "error" ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
            {state.message}
          </p>
        ) : null}
        <form action={formAction} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={redirect.id} />
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onClose}
          >
            Cancel
          </button>
          <ConfirmDeleteButton />
        </form>
      </div>
    </div>
  );
}
