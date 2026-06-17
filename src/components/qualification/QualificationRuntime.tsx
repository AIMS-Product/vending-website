"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QualificationAnswerActionState } from "@/app/qualify/[sessionToken]/actions";
import type { QualificationQuestionSnapshot } from "@/lib/qualification/forms";
import type { Json } from "@/types/database";
import { cn } from "@/lib/utils";

export type QualificationRuntimeSession = {
  status: "active" | "completed";
  formVersionNumber: number;
  questions: QualificationQuestionSnapshot[];
  currentQuestionId: string | null;
  answers: Record<string, Json>;
  completedAt: string | null;
  redirectPath: string;
  initialActionState?: QualificationAnswerActionState;
};

export type QualificationRuntimeProps = {
  session: QualificationRuntimeSession;
  sessionToken: string;
  saveAction: (
    state: QualificationAnswerActionState,
    formData: FormData,
  ) => Promise<QualificationAnswerActionState>;
  completeAction: () => Promise<QualificationAnswerActionState>;
};

const idleState: QualificationAnswerActionState = { status: "idle" };

export function QualificationRuntime({
  session,
  saveAction,
  completeAction,
}: QualificationRuntimeProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Json>>(session.answers);
  const [currentIndex, setCurrentIndex] = useState(() =>
    initialQuestionIndex(session),
  );
  const [completionState, setCompletionState] =
    useState<QualificationAnswerActionState | null>(
      session.status === "completed"
        ? { status: "completed", redirectPath: session.redirectPath }
        : null,
    );
  const [state, dispatch, pending] = useActionState(
    saveAction,
    session.initialActionState ?? idleState,
  );
  const lastSubmitted = useRef<{
    questionId: string;
    answerValue: Json;
    index: number;
  } | null>(null);

  const currentQuestion = session.questions[currentIndex] ?? null;
  const activeState = completionState ?? state;
  const fieldErrors =
    activeState.status === "error" ? activeState.fieldErrors : undefined;
  const currentError =
    currentQuestion && fieldErrors
      ? fieldErrors[currentQuestion.id]
      : undefined;
  const progressValue =
    session.questions.length > 0
      ? Math.round(((currentIndex + 1) / session.questions.length) * 100)
      : 0;

  useEffect(() => {
    if (state.status !== "saved") return;
    const submitted = lastSubmitted.current;
    if (!submitted) return;
    setAnswers((current) => ({
      ...current,
      [submitted.questionId]: submitted.answerValue,
    }));
    if (submitted.index < session.questions.length - 1) {
      setCurrentIndex(submitted.index + 1);
      setCompletionState(null);
      return;
    }
    void completeAction().then((result) => {
      setCompletionState(result);
      if (result.status === "error") {
        const firstErrorId = Object.keys(result.fieldErrors ?? {})[0];
        const errorIndex = session.questions.findIndex(
          (question) => question.id === firstErrorId,
        );
        if (errorIndex >= 0) setCurrentIndex(errorIndex);
      }
    });
  }, [completeAction, session.questions, state]);

  useEffect(() => {
    if (completionState?.status === "completed") {
      router.prefetch?.(completionState.redirectPath);
    }
  }, [completionState, router]);

  const formAction = (formData: FormData) => {
    if (!currentQuestion) return dispatch(formData);
    const answerValue = answerValueFromFormData(currentQuestion, formData);
    const fieldError = validateCurrentAnswer(currentQuestion, answerValue);
    if (fieldError) {
      setCompletionState({
        status: "error",
        message: "Check the highlighted answer and try again.",
        fieldErrors: { [currentQuestion.id]: [fieldError] },
      });
      return;
    }
    lastSubmitted.current = {
      questionId: currentQuestion.id,
      answerValue,
      index: currentIndex,
    };
    setCompletionState(null);
    return dispatch(formData);
  };

  if (
    session.status === "completed" ||
    completionState?.status === "completed"
  ) {
    const redirectPath =
      completionState?.status === "completed"
        ? completionState.redirectPath
        : session.redirectPath;
    return <CompletionPanel redirectPath={redirectPath} />;
  }

  return (
    <section
      className="min-h-screen overflow-hidden bg-white text-slate-950"
      data-motion-scope="qualification-runtime"
    >
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-1/2 bg-[#eaf6ff]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-6 md:grid-cols-[minmax(0,1fr)_380px] md:px-10 lg:px-12">
        <div className="flex min-h-[calc(100vh-3rem)] flex-col">
          <RuntimeHeader
            current={Math.min(currentIndex + 1, session.questions.length)}
            total={session.questions.length}
            progressValue={progressValue}
          />

          {currentQuestion ? (
            <form
              key={currentQuestion.id}
              action={formAction}
              noValidate
              className="flex flex-1 flex-col justify-center py-8 md:py-10"
            >
              <input
                type="hidden"
                name="question_id"
                value={currentQuestion.id}
              />
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-[#0b63f6]">
                  Question {currentIndex + 1} of {session.questions.length}
                </p>
                <h1 className="mt-4 text-[clamp(2rem,5vw,4.75rem)] leading-[1.02] font-black text-slate-950">
                  {currentQuestion.label}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 font-medium text-slate-600 sm:text-lg">
                  {currentQuestion.helpText ||
                    "This helps us tailor the next step without slowing you down."}
                </p>
                <div className="mt-8" aria-live="polite">
                  {activeState.status === "error" ? (
                    <div className="mb-5 rounded-[8px] border-2 border-[#111111] bg-[#fff2ed] px-4 py-3 text-sm font-bold text-slate-950 shadow-[4px_4px_0_#f47b3b]">
                      {activeState.message}
                    </div>
                  ) : null}
                  <QuestionControl
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    errors={currentError}
                  />
                </div>
              </div>

              <RuntimeControls
                canGoBack={currentIndex > 0}
                isLast={currentIndex === session.questions.length - 1}
                pending={pending}
                onBack={() => {
                  setCompletionState(null);
                  setCurrentIndex((index) => Math.max(0, index - 1));
                }}
              />
            </form>
          ) : (
            <CompletionPanel redirectPath={session.redirectPath} />
          )}
        </div>

        <VisualPanel />
      </div>
    </section>
  );
}

function RuntimeHeader({
  current,
  total,
  progressValue,
}: {
  current: number;
  total: number;
  progressValue: number;
}) {
  return (
    <header className="flex items-center gap-5 border-b-2 border-[#111111] py-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] shadow-[3px_3px_0_#111111]">
        <span className="text-lg font-black text-[#111111]">V</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-black text-slate-950">Vendingpreneurs</p>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[#0b63f6] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressValue}%` }}
            />
          </div>
          <p className="shrink-0 text-sm font-bold text-slate-600">
            Question {current} of {total}
          </p>
        </div>
      </div>
    </header>
  );
}

function RuntimeControls({
  canGoBack,
  isLast,
  pending,
  onBack,
}: {
  canGoBack: boolean;
  isLast: boolean;
  pending: boolean;
  onBack: () => void;
}) {
  return (
    <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t-2 border-[#111111] bg-white/95 py-4 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack || pending}
        className="min-h-12 rounded-[8px] border-2 border-[#111111] bg-white px-5 text-sm font-black text-slate-950 shadow-[4px_4px_0_#111111] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        Back
      </button>
      <div className="hidden text-sm font-semibold text-slate-500 sm:block">
        Saved as you continue
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-6 text-sm font-black text-[#111111] shadow-[4px_4px_0_#111111] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Saving..." : isLast ? "Complete" : "Continue"}
      </button>
    </div>
  );
}

function QuestionControl({
  question,
  value,
  errors,
}: {
  question: QualificationQuestionSnapshot;
  value: Json | undefined;
  errors?: string[];
}) {
  const errorId = `${question.id}-error`;
  const hasError = Boolean(errors?.length);
  const commonProps = {
    "aria-invalid": hasError ? true : undefined,
    "aria-describedby": hasError ? errorId : undefined,
  } as const;

  return (
    <div className="grid gap-3">
      {controlForQuestion(question, value, commonProps)}
      {hasError ? (
        <p id={errorId} className="text-sm font-bold text-[#b42318]">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function controlForQuestion(
  question: QualificationQuestionSnapshot,
  value: Json | undefined,
  ariaProps: {
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  },
) {
  if (choiceQuestionTypes.has(question.type)) {
    return (
      <ChoiceRows question={question} value={value} ariaProps={ariaProps} />
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <ChoiceRows
        question={question}
        value={value}
        ariaProps={ariaProps}
        multiple
      />
    );
  }

  if (question.type === "yes_no") {
    return (
      <ChoiceRows
        question={{
          ...question,
          options: [
            { id: "yes", label: "Yes", value: "true" },
            { id: "no", label: "No", value: "false" },
          ],
        }}
        value={value}
        ariaProps={ariaProps}
      />
    );
  }

  if (question.type === "consent") {
    const selected = value === true;
    return (
      <label
        role="checkbox"
        aria-checked={selected}
        className={choiceRowClass(selected)}
      >
        <input
          className="sr-only"
          type="checkbox"
          name="answer_value"
          value="true"
          defaultChecked={selected}
          {...ariaProps}
        />
        <span className={indicatorClass(selected)} />
        <span>{question.label}</span>
      </label>
    );
  }

  if (question.type === "long_text") {
    return (
      <textarea
        name="answer_value"
        rows={5}
        defaultValue={textValue(value)}
        placeholder={question.placeholder || "Type your answer"}
        className={textInputClass}
        {...ariaProps}
      />
    );
  }

  return (
    <input
      name="answer_value"
      type={inputTypeFor(question.type)}
      inputMode={inputModeFor(question.type)}
      defaultValue={textValue(value)}
      placeholder={placeholderFor(question)}
      className={textInputClass}
      {...ariaProps}
    />
  );
}

const choiceQuestionTypes = new Set([
  "single_choice",
  "budget_range",
  "state_region",
  "timeframe",
]);

function ChoiceRows({
  question,
  value,
  ariaProps,
  multiple = false,
}: {
  question: QualificationQuestionSnapshot;
  value: Json | undefined;
  ariaProps: {
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  };
  multiple?: boolean;
}) {
  const values = answerValues(value);
  return (
    <fieldset className="grid gap-3" {...ariaProps}>
      <legend className="sr-only">{question.label}</legend>
      {(question.options ?? []).map((option) => {
        const optionValue = option.value ?? option.id;
        const selected = values.includes(optionValue);
        return (
          <label
            key={option.id}
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            className={choiceRowClass(selected)}
          >
            <input
              className="sr-only"
              type={multiple ? "checkbox" : "radio"}
              name="answer_value"
              value={optionValue}
              defaultChecked={selected}
            />
            <span className={indicatorClass(selected)} />
            <span>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function VisualPanel() {
  return (
    <aside className="hidden min-h-[calc(100vh-3rem)] items-center md:flex">
      <div className="w-full rounded-[8px] border-2 border-[#111111] bg-[#eaf6ff] p-5 shadow-[8px_8px_0_#111111]">
        <div className="rounded-[8px] border-2 border-[#111111] bg-white p-5">
          <div className="grid grid-cols-[1fr_88px] gap-4">
            <div className="space-y-4">
              <div className="h-4 w-28 rounded-full bg-[#0b63f6]" />
              <div className="h-3 w-40 rounded-full bg-slate-200" />
              <div className="h-3 w-32 rounded-full bg-slate-200" />
            </div>
            <div className="rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] p-2 shadow-[4px_4px_0_#111111]">
              <div className="rounded border-2 border-[#111111] bg-white p-1">
                <div className="h-3 rounded bg-[#55b8e8]" />
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <span className="h-5 rounded bg-[#f47b3b]" />
                  <span className="h-5 rounded bg-[#55b8e8]" />
                  <span className="h-5 rounded bg-slate-900" />
                </div>
              </div>
            </div>
          </div>
          <div className="relative mt-8 h-64 overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white">
            <div className="absolute top-8 left-7 size-5 rounded-full border-2 border-[#111111] bg-[#f47b3b]" />
            <div className="absolute top-28 left-28 size-5 rounded-full border-2 border-[#111111] bg-[#55b8e8]" />
            <div className="absolute right-10 bottom-12 size-5 rounded-full border-2 border-[#111111] bg-[#f47b3b]" />
            <div className="absolute top-12 left-12 h-28 w-40 rotate-12 rounded-[40px] border-4 border-dashed border-[#0b63f6]" />
            <div className="absolute right-8 bottom-8 h-28 w-20 rounded-[8px] border-2 border-[#111111] bg-[#eaf6ff] p-2 shadow-[4px_4px_0_#111111]">
              <div className="h-8 rounded border-2 border-[#111111] bg-white" />
              <div className="mt-3 grid grid-cols-2 gap-1">
                <span className="h-4 rounded bg-[#f47b3b]" />
                <span className="h-4 rounded bg-[#55b8e8]" />
                <span className="h-4 rounded bg-[#55b8e8]" />
                <span className="h-4 rounded bg-[#f47b3b]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CompletionPanel({ redirectPath }: { redirectPath: string }) {
  return (
    <section className="min-h-screen bg-white px-5 py-16 text-slate-950">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
        <p className="text-base font-black text-[#0b63f6]">Vendingpreneurs</p>
        <h1 className="mt-4 text-[clamp(2.5rem,7vw,5rem)] leading-none font-black">
          Qualification complete
        </h1>
        <p className="mt-5 text-lg leading-8 font-medium text-slate-600">
          Your answers are saved. Continue to the next step when you are ready.
        </p>
        <Link
          href={redirectPath}
          className="mt-8 inline-flex min-h-12 w-fit items-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-6 text-sm font-black text-[#111111] shadow-[4px_4px_0_#111111] transition hover:-translate-y-0.5"
        >
          Continue to next step
        </Link>
      </div>
    </section>
  );
}

function answerValueFromFormData(
  question: QualificationQuestionSnapshot,
  formData: FormData,
): Json {
  if (question.type === "multiple_choice") {
    return formData
      .getAll("answer_value")
      .filter((item): item is string => typeof item === "string");
  }
  const value = formData.get("answer_value");
  if (question.type === "yes_no" || question.type === "consent") {
    return value === "true";
  }
  return typeof value === "string" ? value : "";
}

function validateCurrentAnswer(
  question: QualificationQuestionSnapshot,
  value: Json,
) {
  if (!question.required) return null;
  if (question.type === "consent" && value !== true) {
    return "Consent is required.";
  }
  if (!answerHasValue(value)) return `${question.label} is required.`;
  return null;
}

function answerHasValue(value: Json): boolean {
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

function initialQuestionIndex(session: QualificationRuntimeSession) {
  if (session.status === "completed") return 0;
  const index = session.questions.findIndex(
    (question) => question.id === session.currentQuestionId,
  );
  return index >= 0 ? index : 0;
}

function inputTypeFor(type: QualificationQuestionSnapshot["type"]) {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  if (type === "number" || type === "currency") return "number";
  if (type === "date") return "date";
  return "text";
}

function inputModeFor(type: QualificationQuestionSnapshot["type"]) {
  if (type === "phone") return "tel";
  if (type === "number" || type === "currency") return "decimal";
  return undefined;
}

function placeholderFor(question: QualificationQuestionSnapshot) {
  if (question.placeholder) return question.placeholder;
  if (question.type === "currency") return "25000";
  if (question.type === "number") return "0";
  return "Type your answer";
}

function answerValues(value: Json | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function textValue(value: Json | undefined) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

function choiceRowClass(selected: boolean) {
  return cn(
    "flex min-h-14 cursor-pointer items-center gap-4 rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-black text-slate-950 shadow-[4px_4px_0_#111111] transition focus-within:ring-2 focus-within:ring-[#0b63f6] focus-within:ring-offset-2 hover:-translate-y-0.5",
    selected && "bg-[#eaf6ff] shadow-[4px_4px_0_#55b8e8]",
  );
}

function indicatorClass(selected: boolean) {
  return cn(
    "pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] bg-white",
    selected && "bg-[#0b63f6] shadow-[inset_0_0_0_4px_#ffffff]",
  );
}

const textInputClass =
  "min-h-14 w-full rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-[4px_4px_0_#111111] outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-[#0b63f6] focus:ring-offset-2";
