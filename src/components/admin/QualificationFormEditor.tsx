"use client";

import { useActionState, useMemo, useState } from "react";
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

const optionQuestionTypes = new Set<QualificationQuestionType>(
  questionTypeOptions
    .filter((option) => option.requiresOptions)
    .map((option) => option.value),
);

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

  return (
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
                Content and sequencing for the follow-up qualification flow.
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
                Add, remove, and order the questions visitors answer after the
                short contact form.
              </p>
            </div>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() =>
                setQuestions((current) => [...current, newQuestion(current)])
              }
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
                      : current.filter((_, entryIndex) => entryIndex !== index),
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
        </section>
      </form>

      <aside className="grid content-start gap-5">
        <section className={adminCardClass}>
          <h2 className="text-sm font-semibold text-slate-950">Publish</h2>
          <ActionMessage state={state} className="mt-3 rounded-md px-3 py-2" />
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
          <h2 className="text-sm font-semibold text-slate-950">Default form</h2>
          <p className="mt-2 text-sm text-slate-600">
            {form.isDefault
              ? "This form is the current global fallback."
              : "Use this form when a page or block does not override it."}
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
  );
}

function QuestionEditor({
  index,
  onChange,
  onDelete,
  onMove,
  question,
  total,
}: {
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
        <label className="block">
          <span className={adminLabelClass}>Normalized role</span>
          <select
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
            <option value="">None</option>
            {normalizedRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(event) =>
              onChange({ ...question, required: event.target.checked })
            }
            className="size-4 rounded border-slate-300 text-[#0b63f6]"
          />
          Required
        </label>
      </div>

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
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-950">Options</h4>
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
            className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
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
            <label className="block">
              <span className={adminLabelClass}>Option value</span>
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
  return (
    <section className={adminCardClass} aria-label="Admin preview">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">Admin preview</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          Preview
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
