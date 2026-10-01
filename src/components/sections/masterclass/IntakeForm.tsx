"use client";

import { useActionState } from "react";
import {
  saveMasterclassIntake,
  type IntakeState,
} from "@/app/masterclass-confirmed/actions";
import { buttonClass } from "@/components/ui/Button";
import { intakeCopy } from "@/lib/content/masterclass";
import { cn } from "@/lib/utils";

/**
 * The GHL thank-you page's three intake questions, written to the contact that
 * just registered. Rendered only when the page holds a valid session cookie.
 */
export function IntakeForm() {
  const [state, action, pending] = useActionState<IntakeState, FormData>(
    saveMasterclassIntake,
    {},
  );
  const errors = state.errors ?? {};

  return (
    // Sits under the bordered ShowUpLive band; PlaybookBand's top padding
    // spaces it from the card below.
    <section className="bg-white">
      <div className="mx-auto max-w-[760px] px-5 pt-14">
        <div className="rounded-card border-ink shadow-card border-2 bg-white p-6 sm:p-8">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {intakeCopy.eyebrow}
          </p>
          <h2 className="text-ink mt-2 text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight font-black uppercase">
            {intakeCopy.heading}
          </h2>
          <p className="mt-2 text-[15px] text-slate-600">{intakeCopy.body}</p>

          {state.saved ? (
            <p
              role="status"
              className="bg-tint border-ink text-ink rounded-control mt-6 border-2 p-4 text-[15px] font-bold"
            >
              {intakeCopy.saved}
            </p>
          ) : (
            <form action={action} noValidate className="mt-6 grid gap-6">
              {intakeCopy.questions.map((question, index) => {
                const error = errors[question.name];
                const errorId = `intake-${question.name}-error`;
                return (
                  <fieldset
                    key={question.name}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                  >
                    <legend className="text-ink text-base font-black">
                      {index + 1}. {question.legend}
                      <span className="ml-0.5 text-[#c2410c]" aria-hidden>
                        *
                      </span>
                      <span className="sr-only"> (required)</span>
                    </legend>
                    <div className="mt-3 grid gap-2">
                      {question.options.map((option) => (
                        <label
                          key={option}
                          className={cn(
                            "rounded-control border-ink has-[:checked]:bg-tint has-[:focus-visible]:ring-sky flex cursor-pointer items-start gap-3 border-2 bg-white px-4 py-3 text-[15px] font-semibold text-slate-800 transition-colors has-[:focus-visible]:ring-2 motion-reduce:transition-none",
                            error && "border-red-300",
                          )}
                        >
                          <input
                            type="radio"
                            name={question.name}
                            value={option}
                            required
                            defaultChecked={
                              state.values?.[question.name] === option
                            }
                            className="mt-0.5 size-4 shrink-0 accent-[#1f72a5]"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                    {error ? (
                      <p
                        id={errorId}
                        className="mt-1 text-xs font-semibold text-red-600"
                      >
                        {error}
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}

              <button
                type="submit"
                disabled={pending}
                className={buttonClass({
                  size: "lg",
                  className: "w-full disabled:opacity-60",
                })}
              >
                {pending ? intakeCopy.pending : intakeCopy.submit}
              </button>
              {errors.form ? (
                <p
                  role="alert"
                  className="text-center text-sm font-semibold text-red-600"
                >
                  {errors.form}
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
