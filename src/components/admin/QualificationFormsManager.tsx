"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  createQualificationForm,
  setDefaultQualificationForm,
  type QualificationFormActionState,
} from "@/app/admin/forms/actions";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import type { AdminQualificationForm } from "@/lib/services/qualification-forms";

const initialActionState: QualificationFormActionState = { status: "idle" };

export function QualificationFormsManager({
  forms,
}: {
  forms: AdminQualificationForm[];
}) {
  const draftCount = forms.filter((form) => form.status === "draft").length;
  const publishedCount = forms.filter(
    (form) => form.status === "published",
  ).length;
  const defaultForm = forms.find((form) => form.isDefault);

  return (
    <div className="grid gap-5">
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="list"
          tone="blue"
          label="Total"
          value={forms.length}
          caption="forms"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Drafts"
          value={draftCount}
          caption="being edited"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Published"
          value={publishedCount}
          caption="versioned"
        />
        <AdminMetricPanel
          icon="crown"
          tone={defaultForm ? "purple" : "slate"}
          label="Default"
          value={defaultForm ? 1 : 0}
          caption={defaultForm?.name ?? "not set"}
        />
      </AdminMetricStrip>

      <section className={adminPanelClass}>
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="shrink-0 lg:max-w-sm">
              <h2 className="text-base font-semibold text-slate-950">
                Create form
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Start a draft for the post-submit qualification flow.
              </p>
            </div>
            <CreateForm />
          </div>
        </div>

        {forms.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No qualification forms yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Create the first draft before attaching a form to a lead block.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Form
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Questions
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Default
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {forms.map((form) => (
                  <QualificationFormRow key={form.id} form={form} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CreateForm() {
  const [state, formAction] = useActionState(
    createQualificationForm,
    initialActionState,
  );

  return (
    <form action={formAction} className="w-full min-w-0 lg:max-w-2xl lg:flex-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="sr-only" htmlFor="qualification-form-name">
          Form name
        </label>
        <input
          id="qualification-form-name"
          name="name"
          required
          placeholder="Investor qualification"
          className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15"
        />
        <CreateSubmitButton />
      </div>
      <ActionMessage state={state} className="mt-2" />
    </form>
  );
}

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${adminPrimaryButtonClass} h-11 w-full whitespace-nowrap sm:w-auto`}
    >
      <span aria-hidden="true">
        <AdminIcon icon="plus" />
      </span>
      {pending ? "Creating..." : "Create form"}
    </button>
  );
}

function QualificationFormRow({ form }: { form: AdminQualificationForm }) {
  const canSetDefault =
    form.status === "published" && Boolean(form.currentPublishedVersionId);

  return (
    <tr>
      <td className="px-5 py-4">
        <Link
          href={`/admin/forms/${form.id}`}
          className="font-semibold text-slate-950 hover:text-[#0b63f6]"
        >
          {form.name}
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          Updated {formatDate(form.updatedAt)}
        </p>
      </td>
      <td className="px-4 py-4">
        <AdminStatusBadge status={form.status} />
      </td>
      <td className="px-4 py-4 text-slate-700">{form.draftQuestionCount}</td>
      <td className="px-4 py-4">
        {form.isDefault ? (
          <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
            Default
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-500">Not set</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/admin/forms/${form.id}`}
            className={adminSmallButtonClass}
          >
            Edit
          </Link>
          {!form.isDefault ? (
            <SetDefaultForm form={form} disabled={!canSetDefault} />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function SetDefaultForm({
  disabled,
  form,
}: {
  disabled: boolean;
  form: AdminQualificationForm;
}) {
  const [state, formAction] = useActionState(
    setDefaultQualificationForm,
    initialActionState,
  );

  return (
    <form action={formAction} className="grid justify-items-end gap-1">
      <input type="hidden" name="id" value={form.id} />
      <SetDefaultSubmitButton disabled={disabled} />
      <ActionMessage state={state} />
    </form>
  );
}

function SetDefaultSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={adminSmallButtonClass}
      title={disabled ? "Publish before setting the default" : undefined}
    >
      {pending ? "Saving..." : "Set default"}
    </button>
  );
}

function ActionMessage({
  className = "",
  state,
}: {
  className?: string;
  state: QualificationFormActionState;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
