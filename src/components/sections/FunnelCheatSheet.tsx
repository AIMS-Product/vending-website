import {
  cheatSheetHeading,
  cheatSheetStages,
  type CheatSheetStage,
} from "@/lib/content/funnel-cheat-sheet";
import { cn } from "@/lib/utils";
import { FunnelMark } from "./FunnelMark";

interface StageProps {
  stage: CheatSheetStage;
  last: boolean;
}

function Stage({ stage, last }: StageProps) {
  const faded = stage.stage === "TOFU";
  return (
    <li className="grid gap-4 md:grid-cols-[13rem_1fr] md:gap-6">
      <div className="flex flex-col items-start md:items-stretch">
        <div className="rounded-[12px] border-2 border-[#111111] bg-white p-4 shadow-[4px_4px_0_#111111]">
          <p className="text-2xl font-black tracking-wide text-[#111111]">
            {stage.stage}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {stage.audience}
          </p>
          <p
            className={cn(
              "mt-3 inline-block rounded-md border-2 border-[#111111] px-2 py-1 text-[11px] font-black tracking-[0.08em] uppercase",
              faded
                ? "bg-slate-100 text-slate-600"
                : "bg-[#eaf6ff] text-[#066a99]",
            )}
          >
            {stage.verdict}
          </p>
        </div>
        {last ? null : (
          <span
            aria-hidden="true"
            className="mx-auto hidden pt-3 text-2xl leading-none font-black text-[#111111] md:block"
          >
            ↓
          </span>
        )}
      </div>
      <div
        className={cn(
          "rounded-[12px] border-2 border-[#111111] p-5 shadow-[6px_6px_0_#111111]",
          faded ? "bg-slate-50" : "bg-white",
        )}
      >
        <h3 className="text-lg font-black text-[#111111]">
          <span className="mr-2 rounded border-2 border-[#111111] px-1.5 py-0.5 align-middle text-xs">
            {stage.stage}
          </span>
          {stage.title}
        </h3>
        <ul className="mt-4 space-y-2.5">
          {stage.rules.map((rule) => (
            <li
              key={rule.text}
              className="flex gap-2.5 text-[15px] leading-snug font-semibold text-slate-800"
            >
              <FunnelMark keep={rule.keep} />
              <span>{rule.text}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex flex-wrap gap-2">
          {stage.chips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border-2 border-[#111111] bg-white px-2.5 py-1 text-xs font-black text-[#111111]"
            >
              {chip}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {stage.evidence}
        </p>
      </div>
    </li>
  );
}

/** The three-stage cheat sheet that opens /funnel-plan. */
export function FunnelCheatSheet() {
  return (
    <section
      aria-labelledby="funnel-cheat-sheet"
      className="mt-8 rounded-[16px] border-2 border-[#111111] bg-[#eaf6ff] p-4 sm:p-7"
    >
      <h2
        id="funnel-cheat-sheet"
        className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase"
      >
        {cheatSheetHeading}
      </h2>
      <ol className="mt-5 space-y-6">
        {cheatSheetStages.map((stage, index) => (
          <Stage
            key={stage.stage}
            stage={stage}
            last={index === cheatSheetStages.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
