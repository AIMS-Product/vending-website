import {
  READINESS,
  type ReadinessStatus,
} from "@/lib/content/masterclass-review-comms";
import { cn } from "@/lib/utils";
import { CARD } from "./ReviewCommsShared";

const DOT: Record<ReadinessStatus, { className: string; label: string }> = {
  green: { className: "bg-emerald-600", label: "Ready" },
  yellow: { className: "bg-amber-500", label: "To finish" },
  red: { className: "bg-red-600", label: "Blocking" },
};

/** The traffic-light answer to "can we switch this week?". */
export function ReviewReadiness() {
  return (
    <section
      aria-labelledby="readiness-heading"
      className={cn(CARD, "mt-8 p-5")}
    >
      <h2
        id="readiness-heading"
        className="v2-display text-ink text-[1.75rem] leading-none uppercase"
      >
        {READINESS.heading}
      </h2>
      <p className="text-ink mt-2 font-bold text-pretty">{READINESS.verdict}</p>
      <p className="mt-1 text-xs text-slate-500">{READINESS.checkedOn}</p>
      <ul className="mt-4 grid gap-3">
        {READINESS.rows.map((row) => {
          const dot = DOT[row.status];
          return (
            <li key={row.area} className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-3 shrink-0 rounded-full",
                  dot.className,
                )}
              />
              <p className="min-w-0 text-sm text-slate-700">
                <span className="text-ink font-black">{row.area}</span>{" "}
                <span className="font-bold">({dot.label})</span>: {row.line}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
