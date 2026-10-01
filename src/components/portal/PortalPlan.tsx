"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { setStepDone } from "@/app/portal/[token]/actions";
import { portalCopy } from "@/lib/content/portal";
import { CheckIcon } from "@/components/sections/apply/icons";
import { PRIMARY_BUTTON } from "./styles";

export type PlanStepView = {
  key: string;
  title: string;
  detail?: string;
  minutes?: number;
  completedBy: "prospect" | "system";
  /** System steps arrive already resolved from data. */
  systemDone: boolean;
  content: ReactNode;
};

export type PlanDayView = {
  key: string;
  /** "Today", "Tomorrow", "Saturday, October 4". */
  label: string;
  /** Calendar chip: "Sat" + "4". */
  chipDay: string;
  chipDate: string;
  isToday: boolean;
  /** "Call day" / "Day one", when this is the anchor day. */
  anchorLabel: string | null;
  stepKeys: string[];
};

type PortalPlanProps = {
  token: string;
  steps: PlanStepView[];
  days: PlanDayView[];
  initialDone: string[];
  showCalendar: boolean;
};

const storageKey = (token: string) => `vp-portal:${token}:done`;

// Local copy of ticked steps, so progress survives a reload until the server
// persists step state. Read through useSyncExternalStore: no hydration
// mismatch (server snapshot is null) and no setState-in-effect.
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

export function PortalPlan({
  token,
  steps,
  days,
  initialDone,
  showCalendar,
}: PortalPlanProps) {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey(token)),
    () => null,
  );
  const ticked = useMemo(
    () => new Set(parseSaved(raw) ?? initialDone),
    [raw, initialDone],
  );
  const byKey = useMemo(() => new Map(steps.map((s) => [s.key, s])), [steps]);
  const order = useMemo(() => days.flatMap((d) => d.stepKeys), [days]);
  const isDone = (key: string) => {
    const step = byKey.get(key);
    return step
      ? step.completedBy === "system"
        ? step.systemDone
        : ticked.has(key)
      : false;
  };
  const firstOpen = (except?: string) =>
    order.find((key) => key !== except && !isDone(key)) ?? null;
  const [open, setOpen] = useState<string | null>(() => firstOpen());

  const toggle = (key: string, done: boolean) => {
    const next = new Set(ticked);
    if (done) next.add(key);
    else next.delete(key);
    localStorage.setItem(storageKey(token), JSON.stringify([...next]));
    // The storage event only fires in OTHER tabs; notify this one too.
    window.dispatchEvent(
      new StorageEvent("storage", { key: storageKey(token) }),
    );
    setStepDone({ token, stepKey: key, done }).then((result) => {
      if (result.status === "error")
        console.error("portal: step not saved", result.message);
    });
    if (done && open === key)
      setOpen(
        order.find(
          (k) => k !== key && !next.has(k) && !byKey.get(k)?.systemDone,
        ) ?? null,
      );
  };

  const doneCount = order.filter(isDone).length;

  return (
    <section aria-labelledby="plan-heading" className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="plan-heading"
          className="text-2xl font-black tracking-tight text-[#111111] uppercase"
        >
          {portalCopy.planHeading}
        </h2>
        <p className="text-sm font-black text-slate-500" aria-live="polite">
          {doneCount} of {order.length} done
        </p>
      </div>

      {showCalendar ? <CalendarStrip days={days} isDone={isDone} /> : null}

      {days.map((day) => (
        <div key={day.key} id={`day-${day.key}`} className="scroll-mt-24">
          <h3 className="flex flex-wrap items-center gap-2 text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {showCalendar ? day.label : portalCopy.anytimeLabel}
            {day.anchorLabel ? (
              <span className="rounded-full bg-[#111111] px-2.5 py-0.5 text-[10px] tracking-[0.1em] text-white">
                {day.anchorLabel}
              </span>
            ) : null}
          </h3>
          {day.stepKeys.length === 0 ? (
            <p className="mt-3 text-[15px] font-semibold text-slate-500">
              Nothing due. Enjoy the day.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-3">
              {day.stepKeys.map((key) => {
                const step = byKey.get(key);
                if (!step) return null;
                return (
                  <StepRow
                    key={key}
                    step={step}
                    done={isDone(key)}
                    open={open === key}
                    onOpen={() => setOpen(open === key ? null : key)}
                    onToggle={(done) => toggle(key, done)}
                  />
                );
              })}
            </ol>
          )}
        </div>
      ))}

      {doneCount === order.length ? (
        <p className="rounded-[10px] bg-[#eaf6ff] p-5 text-center text-[15px] font-black text-[#111111]">
          {portalCopy.allDone}
        </p>
      ) : null}
    </section>
  );
}

function CalendarStrip({
  days,
  isDone,
}: {
  days: PlanDayView[];
  isDone: (key: string) => boolean;
}) {
  return (
    <nav
      aria-label={portalCopy.calendarLabel}
      className="-mx-1 overflow-x-auto pb-1"
    >
      <ol className="flex min-w-max gap-2 px-1">
        {days.map((day) => {
          const anchor = Boolean(day.anchorLabel);
          return (
            <li key={day.key}>
              <a
                href={`#day-${day.key}`}
                className={`flex w-[72px] flex-col items-center gap-1 rounded-[10px] border-2 px-2 py-2.5 transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none ${
                  anchor
                    ? "border-[#111111] bg-[#111111] text-white"
                    : day.isToday
                      ? "border-[#111111] bg-white text-[#111111]"
                      : "border-slate-200 bg-white text-[#111111]"
                }`}
              >
                <span
                  className={`text-[11px] font-black tracking-[0.1em] uppercase ${anchor ? "text-[#55b8e8]" : "text-slate-500"}`}
                >
                  {day.isToday ? portalCopy.today : day.chipDay}
                </span>
                <span className="text-xl leading-none font-black">
                  {day.chipDate}
                </span>
                <span className="flex h-2 gap-1" aria-hidden>
                  {day.stepKeys.map((key) => (
                    <span
                      key={key}
                      className={`size-1.5 rounded-full ${isDone(key) ? (anchor ? "bg-[#55b8e8]" : "bg-[#2a8fcc]") : anchor ? "bg-white/40" : "bg-slate-300"}`}
                    />
                  ))}
                </span>
                <span className="sr-only">
                  {day.stepKeys.length} steps
                  {day.anchorLabel ? `, ${day.anchorLabel}` : ""}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepRow({
  step,
  done,
  open,
  onOpen,
  onToggle,
}: {
  step: PlanStepView;
  done: boolean;
  open: boolean;
  onOpen: () => void;
  onToggle: (done: boolean) => void;
}) {
  const panelId = `step-${step.key}`;
  const tickable = step.completedBy === "prospect";
  return (
    <li
      className={`rounded-[12px] border-2 bg-white transition ${
        open
          ? "border-[#111111] shadow-[6px_6px_0_#55b8e8]"
          : done
            ? "border-slate-200"
            : "border-slate-300 hover:border-[#111111]"
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        {tickable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${step.title}: ${done ? "done" : "not done"}`}
            onClick={() => onToggle(!done)}
            className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none ${
              done
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-slate-400 bg-white hover:border-[#111111]"
            }`}
          >
            {done ? <CheckIcon className="size-4" /> : null}
          </button>
        ) : (
          <span
            title={portalCopy.autoDone}
            className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-dashed ${
              done
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-slate-400"
            }`}
          >
            {done ? <CheckIcon className="size-4" /> : null}
            <span className="sr-only">
              {done ? "done" : portalCopy.autoDone}
            </span>
          </span>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus-visible:rounded-[6px] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span className="min-w-0">
            <span
              className={`block text-[16px] leading-snug font-black ${done ? "text-slate-400 line-through" : "text-[#111111]"}`}
            >
              {step.title}
            </span>
            {step.detail && !done ? (
              <span className="mt-0.5 block text-sm font-semibold text-slate-600">
                {step.detail}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-black text-slate-500 uppercase">
            {step.minutes ? `${step.minutes} min` : null}
            <span
              aria-hidden
              className={`inline-block transition ${open ? "rotate-180" : ""}`}
            >
              &#9662;
            </span>
          </span>
        </button>
      </div>
      {open ? (
        <div
          id={panelId}
          className="border-t border-slate-200 px-4 pt-5 pb-5 sm:px-5"
        >
          {step.content}
          {tickable ? (
            <div className="mt-6 flex justify-end">
              {done ? (
                <button
                  type="button"
                  onClick={() => onToggle(false)}
                  className="text-sm font-black text-[#066a99] underline underline-offset-4"
                >
                  {portalCopy.undo}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(true)}
                  className={PRIMARY_BUTTON}
                >
                  {portalCopy.doneNext}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
