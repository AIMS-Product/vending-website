import {
  COMMS_COPY,
  LAUNCH_CHECKLIST,
} from "@/lib/content/masterclass-review-comms";
import type { ChecklistItem } from "@/lib/content/masterclass-review-comms-types";
import { cn } from "@/lib/utils";
import { CARD, CHIP, H2 } from "./ReviewCommsShared";

const STATUS: Record<
  ChecklistItem["status"],
  { title: string; chip: string; label: string }
> = {
  decision: {
    title: "Decisions needed",
    chip: "bg-ink text-white",
    label: "Decide",
  },
  open: { title: "To do", chip: "bg-red-600 text-white", label: "Open" },
  done: { title: "Done", chip: "bg-tint text-eyebrow", label: "Done" },
};

/** Every open fix and decision before the swap, with owner and deadline. */
export function ReviewChecklist() {
  return (
    <section aria-labelledby="checklist-heading">
      <h2 id="checklist-heading" className={H2}>
        {COMMS_COPY.checklistHeading}
      </h2>
      <p className="mt-3 max-w-[64ch] text-[15px] text-slate-600">
        {COMMS_COPY.checklistIntro}
      </p>
      {(["decision", "open", "done"] as const).map((status) => {
        const items = LAUNCH_CHECKLIST.filter((i) => i.status === status);
        if (!items.length) return null;
        return (
          <div key={status}>
            <h3 className="text-ink mt-8 text-lg font-black uppercase">
              {STATUS[status].title} ({items.length})
            </h3>
            <ul className={cn(CARD, "mt-3")}>
              {items.map((item) => (
                <li
                  key={item.item}
                  className="flex gap-3 border-b border-slate-200 p-4 last:border-b-0"
                >
                  <span
                    className={cn(
                      CHIP,
                      "mt-0.5 h-fit shrink-0",
                      STATUS[status].chip,
                    )}
                  >
                    {STATUS[status].label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink font-bold text-pretty">
                      {item.item}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {item.owner} · {item.due}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
