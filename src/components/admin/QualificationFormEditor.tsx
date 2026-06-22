"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  saveQualificationForm,
  setDefaultQualificationForm,
  type QualificationFormActionState,
} from "@/app/admin/forms/actions";
import {
  AdminIcon,
  AdminStatusBadge,
  adminCardClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSmallButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { AdminQualificationForm } from "@/lib/services/qualification-forms";
import type {
  QualificationNormalizedRole,
  QualificationQuestion,
  QualificationQuestionType,
} from "@/lib/qualification/forms";

type QuestionTypeOption = {
  value: QualificationQuestionType;
  label: string;
  requiresOptions?: boolean;
};

type NormalizedRoleOption = {
  value: QualificationNormalizedRole;
  label: string;
};

const initialActionState: QualificationFormActionState = { status: "idle" };

const questionTypeOptions: QuestionTypeOption[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email confirm" },
  { value: "phone", label: "Phone confirm" },
  { value: "single_choice", label: "Single choice", requiresOptions: true },
  { value: "multiple_choice", label: "Multiple choice", requiresOptions: true },
  { value: "yes_no", label: "Yes or no" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "budget_range", label: "Budget range", requiresOptions: true },
  { value: "state_region", label: "State or market", requiresOptions: true },
  { value: "date", label: "Date" },
  { value: "timeframe", label: "Timeframe", requiresOptions: true },
  { value: "consent", label: "Consent" },
];

const normalizedRoleOptions: NormalizedRoleOption[] = [
  { value: "budget", label: "Budget" },
  { value: "timeline", label: "Timeline" },
  { value: "state_market", label: "State or market" },
  { value: "business_stage", label: "Business stage" },
  { value: "goal", label: "Goal" },
  { value: "available_capital", label: "Available capital" },
  { value: "location_status", label: "Location status" },
  { value: "machine_goal", label: "Machine goal" },
  { value: "consent", label: "Consent" },
  { value: "contact_preference", label: "Contact preference" },
];

const optionQuestionTypes = new Set<QualificationQuestionType>();
for (const option of questionTypeOptions) {
  if (option.requiresOptions) {
    optionQuestionTypes.add(option.value);
  }
}

const addAnotherQuestionButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function QualificationFormEditor({
  form,
}: {
  form: AdminQualificationForm;
}) {
  const [state, formAction] = useActionState(
    saveQualificationForm,
    initialActionState,
  );
  const [defaultState, defaultAction] = useActionState(
    setDefaultQualificationForm,
    initialActionState,
  );
  const [name, setName] = useState(form.name);
  const [questions, setQuestions] = useState<QualificationQuestion[]>(() =>
    form.draftSchema.questions.map(normalizeQuestion),
  );

  const schemaValue = useMemo(
    () =>
      JSON.stringify({
        version: 1,
        questions: questions.map(cleanQuestion),
      }),
    [questions],
  );

  const canSetDefault =
    form.status === "published" &&
    Boolean(form.currentPublishedVersionId) &&
    !form.isDefault;
  const requiredCount = questions.filter(
    (question) => question.required,
  ).length;
  const mappedCount = questions.filter((question) =>
    Boolean(question.normalizedRole),
  ).length;
  const actionRevision = `${state.status}:${state.message ?? ""}:${defaultState.status}:${defaultState.message ?? ""}`;
  const addQuestion = () => {
    setQuestions((current) => [...current, newQuestion(current)]);
  };

  useEffect(() => {
    if (state.status === "idle" && defaultState.status === "idle") return;
    document
      .querySelectorAll<HTMLSelectElement>("[data-controlled-select-value]")
      .forEach((select) => {
        const value = select.dataset.controlledSelectValue ?? "";
        if (select.value !== value) select.value = value;
      });
    document
      .querySelectorAll<HTMLInputElement>("[data-controlled-checkbox-checked]")
      .forEach((checkbox) => {
        const checked = checkbox.dataset.controlledCheckboxChecked === "true";
        if (checkbox.checked !== checked) checkbox.checked = checked;
      });
  });

  return (
    <div className="grid gap-5">
      <QualificationEditorOverview
        form={form}
        mappedCount={mappedCount}
        questionCount={questions.length}
        requiredCount={requiredCount}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form
          id="qualification-form-editor"
          action={formAction}
          className="grid gap-5"
        >
          <input type="hidden" name="id" value={form.id} />
          <input type="hidden" name="schema" value={schemaValue} />

          <section className={adminCardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Form details
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Name this follow-up flow so it is easy to pick from pages and
                  lead blocks.
                </p>
              </div>
              <AdminStatusBadge status={form.status} />
            </div>
            <label className="mt-5 block">
              <span className={adminLabelClass}>Form name</span>
              <input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className={adminInputClass}
              />
            </label>
          </section>

          <section className={adminCardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Questions
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Write the prospect-facing questions first. Routing fields stay
                  available in advanced settings when you need them.
                </p>
              </div>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                onClick={addQuestion}
              >
                <span aria-hidden="true">
                  <AdminIcon icon="plus" />
                </span>
                Add question
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  actionRevision={actionRevision}
                  index={index}
                  question={question}
                  total={questions.length}
                  onChange={(next) =>
                    setQuestions((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? next : entry,
                      ),
                    )
                  }
                  onDelete={() =>
                    setQuestions((current) =>
                      current.length <= 1
                        ? current
                        : current.filter(
                            (_, entryIndex) => entryIndex !== index,
                          ),
                    )
                  }
                  onMove={(direction) =>
                    setQuestions((current) =>
                      moveQuestion(current, index, direction),
                    )
                  }
                />
              ))}
            </div>
            <div className="mt-4 flex justify-center border-t border-slate-100 pt-4">
              <button
                type="button"
                className={addAnotherQuestionButtonClass}
                onClick={addQuestion}
              >
                <span aria-hidden="true">
                  <AdminIcon icon="plus" />
                </span>
                Add another question
              </button>
            </div>
          </section>
        </form>

        <aside className="grid content-start gap-5">
          <section className={adminCardClass}>
            <h2 className="text-sm font-semibold text-slate-950">Publish</h2>
            <p className="mt-2 text-sm text-slate-600">
              Save keeps editing open. Publish creates a locked version for new
              qualification sessions.
            </p>
            <ActionMessage
              state={state}
              className="mt-3 rounded-md px-3 py-2"
            />
            <div className="mt-5 grid gap-2">
              <button
                type="submit"
                form="qualification-form-editor"
                name="intent"
                value="save"
                className={adminSecondaryButtonClass}
              >
                <span aria-hidden="true">
                  <AdminIcon icon="save" />
                </span>
                Save draft
              </button>
              <button
                type="submit"
                form="qualification-form-editor"
                name="intent"
                value="publish"
                className={adminPrimaryButtonClass}
              >
                <span aria-hidden="true">
                  <AdminIcon icon="check" />
                </span>
                Publish version
              </button>
            </div>
          </section>

          <section className={adminCardClass}>
            <h2 className="text-sm font-semibold text-slate-950">
              Default form
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {form.isDefault
                ? "This form is the fallback when a page or lead block does not choose another form."
                : "Publish first, then make this the fallback for pages and lead blocks without their own form."}
            </p>
            {!form.isDefault ? (
              <form action={defaultAction} className="mt-4 grid gap-2">
                <input type="hidden" name="id" value={form.id} />
                <button
                  type="submit"
                  disabled={!canSetDefault}
                  className={adminSecondaryButtonClass}
                  title={
                    canSetDefault
                      ? undefined
                      : "Publish before setting the default"
                  }
                >
                  Set default
                </button>
                <ActionMessage state={defaultState} />
              </form>
            ) : (
              <span className="mt-4 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                Default
              </span>
            )}
          </section>

          <QualificationPreview questions={questions} />
        </aside>
      </div>
    </div>
  );
}

function QualificationEditorOverview({
  form,
  mappedCount,
  questionCount,
  requiredCount,
}: {
  form: AdminQualificationForm;
  mappedCount: number;
  questionCount: number;
  requiredCount: number;
}) {
  return (
    <section className={adminCardClass} aria-label="Builder overview">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Build the follow-up prospects see after the short lead form
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Edit the questions, check the prospect preview, then save or publish
            a version for new sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryBadge label="Questions" value={questionCount} />
          <SummaryBadge label="Required" value={requiredCount} />
          <SummaryBadge label="Profile fields" value={mappedCount} />
          <AdminStatusBadge status={form.status} />
        </div>
      </div>
    </section>
  );
}

function SummaryBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-950">{value}</span>
    </span>
  );
}

function QuestionEditor({
  actionRevision,
  index,
  onChange,
  onDelete,
  onMove,
  question,
  total,
}: {
  actionRevision: string;
  index: number;
  onChange: (question: QualificationQuestion) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  question: QualificationQuestion;
  total: number;
}) {
  const showOptions = optionQuestionTypes.has(question.type);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Question {index + 1}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">
            {question.label || "Untitled question"}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {labelForQuestionType(question.type)}
            </span>
            {question.required ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                Required
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Optional
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={adminSmallButtonClass}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            Move up
          </button>
          <button
            type="button"
            className={adminSmallButtonClass}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            Move down
          </button>
          <button
            type="button"
            className={adminSmallButtonClass}
            disabled={total <= 1}
            onClick={onDelete}
          >
            <span aria-hidden="true">
              <AdminIcon icon="trash" />
            </span>
            Delete question
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className={adminLabelClass}>Question label</span>
          <input
            value={question.label}
            onChange={(event) =>
              onChange({ ...question, label: event.target.value })
            }
            required
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className={adminLabelClass}>Question type</span>
          <select
            key={`${question.id}-type-${question.type}-${actionRevision}`}
            data-controlled-select-value={question.type}
            value={question.type}
            onChange={(event) =>
              onChange(changeQuestionType(question, event.target.value))
            }
            className={adminInputClass}
          >
            {questionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={adminLabelClass}>Help text</span>
          <textarea
            value={question.helpText ?? ""}
            onChange={(event) =>
              onChange({ ...question, helpText: event.target.value })
            }
            rows={3}
            className={adminTextareaClass}
          />
        </label>
        <label className="block">
          <span className={adminLabelClass}>Placeholder</span>
          <input
            value={question.placeholder ?? ""}
            onChange={(event) =>
              onChange({ ...question, placeholder: event.target.value })
            }
            className={adminInputClass}
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
          <input
            key={`${question.id}-required-${question.required}-${actionRevision}`}
            type="checkbox"
            data-controlled-checkbox-checked={question.required}
            checked={question.required}
            onChange={(event) =>
              onChange({ ...question, required: event.target.checked })
            }
            className="size-4 rounded border-slate-300 text-[#0b63f6]"
          />
          Required
        </label>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Lead routing
        </summary>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Optional mapping used for lead summaries, filters, and CRM sync. Most
          copy edits do not need this.
        </p>
        <label className="mt-3 block">
          <span className={adminLabelClass}>Lead profile field</span>
          <select
            key={`${question.id}-role-${question.normalizedRole ?? "none"}-${actionRevision}`}
            data-controlled-select-value={question.normalizedRole ?? ""}
            value={question.normalizedRole ?? ""}
            onChange={(event) =>
              onChange({
                ...question,
                normalizedRole:
                  event.target.value === ""
                    ? undefined
                    : (event.target.value as QualificationNormalizedRole),
              })
            }
            className={adminInputClass}
          >
            <option value="">No profile field</option>
            {normalizedRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </details>

      {showOptions ? (
        <QuestionOptions question={question} onChange={onChange} />
      ) : null}
    </article>
  );
}

function QuestionOptions({
  onChange,
  question,
}: {
  onChange: (question: QualificationQuestion) => void;
  question: QualificationQuestion;
}) {
  const options = question.options ?? [];
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">
            Answer choices
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Labels are shown to prospects. Internal values are optional.
          </p>
        </div>
        <button
          type="button"
          className={adminSmallButtonClass}
          onClick={() =>
            onChange({
              ...question,
              options: [...options, newOption(options)],
            })
          }
        >
          <span aria-hidden="true">
            <AdminIcon icon="plus" />
          </span>
          Add option
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        {options.map((option, index) => (
          <div
            key={option.id}
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label className="block">
              <span className={adminLabelClass}>Option label</span>
              <input
                value={option.label}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: options.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  })
                }
                className={adminInputClass}
              />
            </label>
            <button
              type="button"
              className={`${adminSmallButtonClass} self-end`}
              disabled={options.length <= 1}
              onClick={() =>
                onChange({
                  ...question,
                  options: options.filter(
                    (_, entryIndex) => entryIndex !== index,
                  ),
                })
              }
            >
              <span aria-hidden="true">
                <AdminIcon icon="trash" />
              </span>
              Remove
            </button>
            <details className="md:col-span-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Internal value
              </summary>
              <label className="mt-2 block">
                <span className={adminLabelClass}>Reporting value</span>
                <input
                  value={option.value ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...question,
                      options: options.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, value: event.target.value }
                          : entry,
                      ),
                    })
                  }
                  className={adminInputClass}
                />
              </label>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualificationPreview({
  questions,
}: {
  questions: QualificationQuestion[];
}) {
  const requiredCount = questions.filter(
    (question) => question.required,
  ).length;

  return (
    <section className={adminCardClass} aria-label="Prospect preview">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Prospect preview
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {questions.length} questions, {requiredCount} required.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          Prospect view
        </span>
      </div>
      <div className="mt-4 grid gap-4">
        {questions.map((question) => (
          <div
            key={question.id}
            className="rounded-lg border border-slate-200 p-3"
          >
            <p className="text-sm font-semibold text-slate-950">
              {question.label || "Untitled question"}
              {question.required ? (
                <span className="text-red-600"> *</span>
              ) : null}
            </p>
            {question.helpText ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {question.helpText}
              </p>
            ) : null}
            <PreviewControl question={question} />
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewControl({ question }: { question: QualificationQuestion }) {
  const options = question.options ?? [];
  if (
    question.type === "single_choice" ||
    question.type === "budget_range" ||
    question.type === "state_region" ||
    question.type === "timeframe"
  ) {
    return (
      <select
        disabled
        aria-label={`Preview ${question.label}`}
        className={`${adminInputClass} disabled:opacity-100`}
      >
        <option>{question.placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.id}>{option.label}</option>
        ))}
      </select>
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <input type="checkbox" disabled />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "yes_no" || question.type === "consent") {
    return (
      <label className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" disabled />
        {question.type === "consent" ? "I agree" : "Yes"}
      </label>
    );
  }

  const inputType =
    question.type === "email"
      ? "email"
      : question.type === "phone"
        ? "tel"
        : question.type === "number" || question.type === "currency"
          ? "number"
          : question.type === "date"
            ? "date"
            : "text";

  if (question.type === "long_text") {
    return (
      <textarea
        disabled
        aria-label={`Preview ${question.label}`}
        rows={3}
        placeholder={question.placeholder}
        className={`${adminTextareaClass} disabled:opacity-100`}
      />
    );
  }

  return (
    <input
      disabled
      type={inputType}
      aria-label={`Preview ${question.label}`}
      placeholder={question.placeholder}
      className={`${adminInputClass} disabled:opacity-100`}
    />
  );
}

function normalizeQuestion(
  question: QualificationQuestion,
): QualificationQuestion {
  return {
    ...question,
    helpText: question.helpText ?? "",
    placeholder: question.placeholder ?? "",
    required: question.required ?? true,
    options: optionQuestionTypes.has(question.type)
      ? question.options?.length
        ? question.options
        : [newOption([])]
      : undefined,
  };
}

function cleanQuestion(question: QualificationQuestion): QualificationQuestion {
  const cleaned: QualificationQuestion = {
    id: question.id,
    type: question.type,
    label: question.label,
    helpText: question.helpText ?? "",
    placeholder: question.placeholder ?? "",
    required: question.required,
    normalizedRole: question.normalizedRole,
  };
  if (optionQuestionTypes.has(question.type)) {
    cleaned.options = question.options ?? [];
  }
  return cleaned;
}

function changeQuestionType(
  question: QualificationQuestion,
  nextType: string,
): QualificationQuestion {
  const type = nextType as QualificationQuestionType;
  if (optionQuestionTypes.has(type)) {
    return {
      ...question,
      type,
      options: question.options?.length ? question.options : [newOption([])],
    };
  }
  const next = { ...question, type };
  delete next.options;
  return next;
}

function labelForQuestionType(type: QualificationQuestionType) {
  return (
    questionTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}

function moveQuestion(
  questions: QualificationQuestion[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= questions.length) return questions;
  const next = [...questions];
  const [item] = next.splice(index, 1);
  if (!item) return questions;
  next.splice(nextIndex, 0, item);
  return next;
}

function newQuestion(existing: QualificationQuestion[]): QualificationQuestion {
  const id = uniqueId(
    "question",
    existing.map((question) => question.id),
  );
  return {
    id,
    type: "short_text",
    label: "New qualification question",
    helpText: "",
    placeholder: "",
    required: true,
  };
}

function newOption(existing: Array<{ id: string }>) {
  const id = uniqueId(
    "option",
    existing.map((option) => option.id),
  );
  return {
    id,
    label: "New option",
    value: "",
  };
}

function uniqueId(prefix: string, existing: string[]) {
  const used = new Set(existing);
  let index = existing.length + 1;
  let id = `${prefix}_${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${prefix}_${index}`;
  }
  return id;
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
      className={`${className} text-sm font-medium ${
        state.status === "error"
          ? "bg-red-50 text-red-700"
          : "bg-emerald-50 text-emerald-700"
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}
