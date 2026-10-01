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

/** Day of October from "Mon Oct 5"; undated lines sort last. */
function dueOrder(due: string) {
  const day = /Oct (\d+)/.exec(due);
  return day ? Number(day[1]) : 99;
}

function ItemRow({ item }: { item: ChecklistItem }) {
  const status = STATUS[item.status];
  return (
    <li className="flex gap-3 border-b border-slate-200 p-4 last:border-b-0">
      <span className={cn(CHIP, "mt-0.5 h-fit shrink-0", status.chip)}>
        {status.label}
      </span>
      <div className="min-w-0">
        <p className="text-ink font-bold text-pretty">{item.item}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {item.owner} · {item.due}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
    </li>
  );
}

const byDue = (a: ChecklistItem, b: ChecklistItem) =>
  dueOrder(a.due) - dueOrder(b.due);

/**
 * Decisions first, then open work grouped by owner (each person sees one
 * short list, soonest first), with the done lines folded away.
 */
export function ReviewChecklist() {
  const decisions = LAUNCH_CHECKLIST.filter((i) => i.status === "decision");
  const open = LAUNCH_CHECKLIST.filter((i) => i.status === "open");
  const done = LAUNCH_CHECKLIST.filter((i) => i.status === "done");
  const owners = [...new Set(open.map((i) => i.owner))].sort(
    (a, b) =>
      open.filter((i) => i.owner === b).length -
      open.filter((i) => i.owner === a).length,
  );
  return (
    <section aria-labelledby="checklist-heading">
      <h2 id="checklist-heading" className={H2}>
        {COMMS_COPY.checklistHeading}
      </h2>
      <p className="mt-3 max-w-[64ch] text-[15px] text-slate-600">
        {COMMS_COPY.checklistIntro}
      </p>

      <h3 className="text-ink mt-8 text-lg font-black uppercase">
        {STATUS.decision.title} ({decisions.length})
      </h3>
      <ul className={cn(CARD, "mt-3")}>
        {[...decisions].sort(byDue).map((item) => (
          <ItemRow key={item.item} item={item} />
        ))}
      </ul>

      {owners.map((owner) => {
        const items = open.filter((i) => i.owner === owner).sort(byDue);
        return (
          <div key={owner}>
            <h3 className="text-ink mt-8 text-lg font-black uppercase">
              {owner} ({items.length})
            </h3>
            <ul className={cn(CARD, "mt-3")}>
              {items.map((item) => (
                <ItemRow key={item.item} item={item} />
              ))}
            </ul>
          </div>
        );
      })}

      <details className={cn(CARD, "group mt-8")}>
        <summary className="text-ink hover:bg-tint flex cursor-pointer list-none items-center justify-between p-4 text-lg font-black uppercase [&::-webkit-details-marker]:hidden">
          {STATUS.done.title} ({done.length})
          <span
            aria-hidden
            className="transition-transform group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <ul className="border-t border-slate-200">
          {done.map((item) => (
            <ItemRow key={item.item} item={item} />
          ))}
        </ul>
      </details>
    </section>
  );
}
