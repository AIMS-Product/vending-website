import { applyQuiz } from "@/lib/content/apply-page";
import { LockIcon, StarRow } from "./icons";

// The booking card that rides in the right column of the hero (Adam,
// 2026-09-17): the form has to be on the first screen next to the pitch, not a
// dark band further down the page. Shared by the qualification quiz and the
// social-ad booking form so the two never drift.
//
// Styled for the hero's light wash: PublicLeadForm already renders its own
// white card, so this only adds the heading above it and the proof line under
// it. The headline trust stats live in the hero's left column, so the old dark
// rail's duplicate stat list is deliberately not repeated here.
export function HeroFormPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <h2 className="text-[clamp(1.35rem,2vw,1.7rem)] leading-[1.1] font-black tracking-tight text-[#111111] uppercase">
        {title}
      </h2>
      <div className="mt-5">{children}</div>

      <figure className="mt-6 rounded-[12px] border-2 border-[#111111]/12 bg-white/70 p-5">
        <StarRow
          className="mb-2.5 flex gap-0.5 text-[#2a8fcc]"
          starClassName="size-[17px]"
        />
        <blockquote className="text-[15px] leading-snug font-black text-[#111111]">
          {applyQuiz.rail.quote}
        </blockquote>
        <figcaption className="mt-2.5 text-[13px] font-semibold text-slate-600">
          {applyQuiz.rail.attribution}
        </figcaption>
      </figure>

      <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-slate-600">
        <LockIcon className="size-3.5 text-[#066a99]" />
        {applyQuiz.rail.availabilityNote}
      </p>
    </div>
  );
}
