"use client";

import { useMemo, useSyncExternalStore } from "react";
import { setStepDone } from "@/app/portal/[token]/actions";
import { CheckIcon } from "@/components/sections/apply/icons";
import { portalCopy } from "@/lib/content/portal";

export type ChecklistStep = {
  key: string;
  title: string;
  /** Anchor on the page (#local) or an external link. */
  href: string;
  external: boolean;
  completedBy: "prospect" | "system";
  /** System steps arrive already resolved from data. */
  systemDone: boolean;
  /** Short due label: "Today", "Fri", "Call day". Null when undated. */
  due: string | null;
};

export type WeekDay = {
  key: string;
  chipDay: string;
  chipDate: string;
  isToday: boolean;
  anchorLabel: string | null;
  stepKeys: string[];
};

// Ticked steps live in localStorage until the server persists step state
// (setStepDone). useSyncExternalStore: no hydration mismatch, and the panel
// and the mobile bar stay in sync because both read the same key.
const storageKey = (token: string) => `vp-portal:${token}:done`;
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

function parseSaved(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    return Array.isArray(saved)
      ? saved.filter((k): k is string => typeof k === "string")
      : null;
  } catch (error) {
    console.error("portal: could not read saved progress", error);
    return null;
  }
}

function useProgress(
  token: string,
  steps: ChecklistStep[],
  initialDone: string[],
) {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey(token)),
    () => null,
  );
  const ticked = useMemo(
    () => new Set(parseSaved(raw) ?? initialDone),
    [raw, initialDone],
  );
  const isDone = (step: ChecklistStep) =>
    step.completedBy === "system" ? step.systemDone : ticked.has(step.key);
  const toggle = (key: string, done: boolean) => {
    const next = new Set(ticked);
    if (done) next.add(key);
    else next.delete(key);
    localStorage.setItem(storageKey(token), JSON.stringify([...next]));
    // The storage event only fires in other tabs; notify this one too.
    window.dispatchEvent(
      new StorageEvent("storage", { key: storageKey(token) }),
    );
    setStepDone({ token, stepKey: key, done }).then((result) => {
      if (result.status === "error")
        console.error("portal: step not saved", result.message);
    });
  };
  const current = steps.find((step) => !isDone(step)) ?? null;
  return { isDone, toggle, current };
}

type ChecklistProps = {
  token: string;
  steps: ChecklistStep[];
  week: WeekDay[];
  initialDone: string[];
};

/** The spine: always visible, always says what to do next. Sticky sidebar on desktop. */
export function PortalChecklist({
  token,
  steps,
  week,
  initialDone,
}: ChecklistProps) {
  const { isDone, toggle, current } = useProgress(token, steps, initialDone);
  const doneKeys = new Set(steps.filter(isDone).map((s) => s.key));

  return (
    <section
      id="next-steps"
      aria-labelledby="next-steps-heading"
      className="scroll-mt-20 rounded-[14px] border-2 border-[#111111] bg-white p-5 shadow-[8px_8px_0_#111111]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="next-steps-heading"
          className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase"
        >
          {portalCopy.stepsHeading}
        </h2>
        <p className="text-xs font-black text-slate-500" aria-live="polite">
          {doneKeys.size} of {steps.length} done
        </p>
      </div>

      {week.length > 1 ? (
        <ol
          aria-label={portalCopy.weekLabel}
          className="mt-4 grid auto-cols-fr grid-flow-col gap-1.5"
        >
          {week.map((day) => {
            const anchor = Boolean(day.anchorLabel);
            return (
              <li
                key={day.key}
                className={`flex flex-col items-center rounded-[8px] border-2 px-1 py-1.5 ${
                  anchor
                    ? "border-[#111111] bg-[#111111] text-white"
                    : day.isToday
                      ? "border-[#111111] bg-[#eaf6ff]"
                      : "border-slate-200"
                }`}
              >
                <span
                  className={`text-[10px] font-black tracking-[0.08em] uppercase ${anchor ? "text-[#55b8e8]" : "text-slate-500"}`}
                >
                  {anchor
                    ? day.anchorLabel
                    : day.isToday
                      ? portalCopy.today
                      : day.chipDay}
                </span>
                <span className="text-base leading-tight font-black">
                  {day.chipDate}
                </span>
                <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                  {day.stepKeys.map((key) => (
                    <span
                      key={key}
                      className={`size-1.5 rounded-full ${doneKeys.has(key) ? "bg-[#2a8fcc]" : anchor ? "bg-white/40" : "bg-slate-300"}`}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <ol className="mt-4 flex flex-col gap-1.5">
        {steps.map((step) => {
          const done = isDone(step);
          const isCurrent = step.key === current?.key;
          return (
            <li
              key={step.key}
              className={`flex items-start gap-3 rounded-[10px] border-2 p-2.5 transition ${
                isCurrent
                  ? "border-[#111111] bg-[#eaf6ff]"
                  : "border-transparent"
              }`}
            >
              {step.completedBy === "prospect" ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${step.title}: ${done ? "done" : "not done"}`}
                  onClick={() => toggle(step.key, !done)}
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none ${
                    done
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-slate-400 bg-white hover:border-[#111111]"
                  }`}
                >
                  {done ? <CheckIcon className="size-3.5" /> : null}
                </button>
              ) : (
                <span
                  title={portalCopy.autoDone}
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed ${
                    done
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-slate-400"
                  }`}
                >
                  {done ? <CheckIcon className="size-3.5" /> : null}
                  <span className="sr-only">
                    {done ? "done" : portalCopy.autoDone}
                  </span>
                </span>
              )}
              <a
                href={step.href}
                target={step.external ? "_blank" : undefined}
                rel={step.external ? "noopener noreferrer" : undefined}
                aria-current={isCurrent ? "step" : undefined}
                className="min-w-0 flex-1 rounded-[4px] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:outline-none"
              >
                <span
                  className={`block text-[14px] leading-snug font-black ${done ? "text-slate-400 line-through" : "text-[#111111] hover:text-[#066a99]"}`}
                >
                  {step.title}
                </span>
                {step.due && !done ? (
                  <span className="mt-0.5 block text-[11px] font-black tracking-[0.08em] text-slate-500 uppercase">
                    {step.due}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
      {!current ? (
        <p className="mt-4 text-center text-sm font-black text-[#111111]">
          {portalCopy.allDone}
        </p>
      ) : null}
    </section>
  );
}

/** Mobile only: the one next step, pinned to the top. */
export function MobileNextBar({
  token,
  steps,
  initialDone,
}: Omit<ChecklistProps, "week">) {
  const { current } = useProgress(token, steps, initialDone);
  if (!current) return null;
  return (
    <div className="sticky top-0 z-30 border-b-2 border-[#111111] bg-[#111111] lg:hidden">
      <a
        href="#next-steps"
        className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-3 text-white"
      >
        <span className="min-w-0 truncate text-sm font-black">
          <span className="text-[#55b8e8] uppercase">
            {portalCopy.mobileNext}{" "}
          </span>
          {current.title}
        </span>
        <span className="shrink-0 text-xs font-black tracking-[0.1em] uppercase">
          {portalCopy.mobileAll}
        </span>
      </a>
    </div>
  );
}
