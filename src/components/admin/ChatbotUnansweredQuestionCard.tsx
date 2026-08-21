"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ChatbotActionState } from "@/app/admin/chatbot/actions";
import {
  answerUnknownQuestionAction,
  dismissUnknownQuestionAction,
} from "@/app/admin/chatbot/insights/actions";
import {
  adminTextareaClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import type { AdminUnknownQuestion } from "@/lib/services/chatbot-insights";

const initialState: ChatbotActionState = { status: "idle" };

/**
 * One answer gap. Distinct from ChatbotInsightItemActions because this card's
 * primary action needs input: the admin types the real answer, and submitting
 * appends it to the knowledge base the live prompt reads. That is the whole
 * self-learning loop — the bot reports what it didn't know, a human answers
 * once, and the next visitor gets a real answer.
 */
export function ChatbotUnansweredQuestionCard({
  question,
}: {
  question: AdminUnknownQuestion;
}) {
  const [answerState, answerAction] = useActionState(
    answerUnknownQuestionAction,
    initialState,
  );
  const [dismissState, dismissAction] = useActionState(
    dismissUnknownQuestionAction,
    initialState,
  );
  const state = dismissState.status !== "idle" ? dismissState : answerState;

  return (
    <div className="border-ui-line rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ui-text text-sm font-medium">{question.question}</p>
        {question.askCount > 1 ? (
          <span className="text-ui-text-subtle shrink-0 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
            Asked {question.askCount}×
          </span>
        ) : null}
      </div>

      <form action={answerAction} className="mt-2 grid gap-2">
        <input type="hidden" name="id" value={question.id} />
        <textarea
          name="answer"
          rows={3}
          required
          maxLength={2000}
          placeholder="The real answer, in plain language. This goes straight into the bot's knowledge base."
          className={adminTextareaClass}
          aria-label={`Answer for: ${question.question}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton
            label="Add to knowledge base"
            className={adminPrimaryButtonClass}
          />
        </div>
      </form>

      <form action={dismissAction} className="mt-2">
        <input type="hidden" name="id" value={question.id} />
        <SubmitButton label="Dismiss" className={adminSmallButtonClass} />
      </form>

      {state.status !== "idle" ? (
        <p
          className={`mt-2 text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : label}
    </button>
  );
}
