import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { LegalFooter } from "@/components/site/LegalFooter";
import { VidalyticsGlobalTag } from "@/components/media/VidalyticsPlayer";
import { portalCopy, portalHero } from "@/lib/content/portal";
import {
  dayKey,
  daysUntil,
  formatCallTime,
  formatDay,
  isDone,
  schedule,
  stepsFor,
} from "@/lib/portal/journey";
import { personaFor } from "@/lib/portal/personalize";
import type { PortalData } from "@/lib/portal/types";
import type { PortalWin } from "@/lib/portal/wins";
import { AskForm } from "./PortalForms";
import { PortalPlan, type PlanDayView, type PlanStepView } from "./PortalPlan";
import { StepContent, type StepContext } from "./StepContent";

// /portal/[token]: one prospect's journey, told as a dated plan.
// Hero (who + when) → calendar strip → day-by-day steps that open in place →
// ask your rep. Visual language is the VP site (/apply, /pre-call-resources):
// ink borders, sky offset shadow on the active card, uppercase black heads.

const firstName = (name: string | undefined | null) =>
  name?.split(/\s+/)[0] ?? null;

export function PortalPage({
  data,
  wins,
  now,
}: {
  data: PortalData;
  wins: PortalWin[];
  now: Date;
}) {
  const persona = personaFor(data.prospect.occupation);
  const repFirstName = firstName(data.call?.rep.name);
  const ctx: StepContext = { data, persona, wins, repFirstName };

  const steps = stepsFor(data);
  const fill = (title: string) =>
    title
      .replace("{rep}", repFirstName ?? "your advisor")
      .replace("{story}", persona.caseStudy.name);
  const stepViews: PlanStepView[] = steps.map((step) => ({
    key: step.key,
    title: fill(step.title),
    detail: step.detail,
    minutes: step.minutes,
    completedBy: step.completedBy,
    systemDone: isDone(step, data, new Set()),
    content: <StepContent step={step} ctx={ctx} />,
  }));

  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const anchorLabel =
    data.stage === "won" ? portalCopy.joinDay : portalCopy.callDay;
  const dayLabel = (key: string) => {
    const long = formatDay(key, "long");
    if (key === today) return `${portalCopy.today} · ${long}`;
    if (key === tomorrow) return `${portalCopy.tomorrow} · ${long}`;
    return long;
  };
  const days: PlanDayView[] = schedule(steps, data, now).map((day) => ({
    key: day.key,
    label: dayLabel(day.key),
    chipDay: formatDay(day.key, "short"),
    chipDate: String(Number(day.key.slice(8))),
    isToday: day.isToday,
    anchorLabel:
      day.isAnchor && (data.stage === "won" || data.call?.scheduledAt)
        ? anchorLabel
        : null,
    stepKeys: day.stepKeys,
  }));

  const hero = portalHero(data.stage, {
    firstName: data.prospect.firstName,
    repFirstName,
    daysUntilCall: daysUntil(data.call?.scheduledAt, now),
    callTime: formatCallTime(data.call?.scheduledAt),
  });

  return (
    <>
      <VidalyticsGlobalTag />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4 px-5 py-4">
          <Wordmark height={28} eager />
          <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase">
            For {data.prospect.firstName}
          </p>
        </div>
      </header>

      <main className="bg-white">
        <section className="relative isolate overflow-hidden border-b border-slate-200">
          <div
            aria-hidden
            className="absolute inset-0 bg-[#f5fbff]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(42,143,204,0.14) 1.2px, transparent 1.2px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto max-w-[760px] px-5 pt-12 pb-10 sm:pt-16">
            <h1 className="max-w-[20ch] text-[clamp(2rem,5vw,3.25rem)] leading-[1.04] font-black tracking-tight text-balance text-[#111111]">
              {hero.title}
            </h1>
            <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed font-semibold text-slate-700">
              {hero.body}
            </p>

            {data.prospect.goal ? (
              <p className="mt-6 max-w-[56ch] border-l-4 border-[#2a8fcc] pl-4 text-[15px] leading-relaxed font-semibold text-slate-700">
                {portalCopy.goalLead}:{" "}
                <span className="font-black text-[#111111]">
                  &ldquo;{data.prospect.goal}.&rdquo;
                </span>{" "}
                {portalCopy.goalTail}
              </p>
            ) : null}

            {data.call ? (
              <div className="mt-8 flex items-center gap-3">
                <RepAvatar
                  name={data.call.rep.name}
                  photoUrl={data.call.rep.photoUrl}
                />
                <p className="text-sm font-semibold text-slate-700">
                  <span className="block font-black text-[#111111]">
                    {data.call.rep.name}
                  </span>
                  {data.call.rep.title ?? "Your Vendingpreneurs advisor"}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mx-auto flex max-w-[760px] flex-col gap-14 px-5 py-12">
          <PortalPlan
            token={data.token}
            steps={stepViews}
            days={days}
            initialDone={data.completedSteps}
            showCalendar={data.stage !== "lost"}
          />

          <section
            aria-labelledby="ask-heading"
            className="rounded-[12px] border-2 border-[#111111] bg-[#f5fbff] p-6"
          >
            <h2
              id="ask-heading"
              className="text-lg font-black text-[#111111] uppercase"
            >
              {portalCopy.askHeading(repFirstName)}
            </h2>
            <p className="mt-1 mb-4 text-[15px] font-semibold text-slate-700">
              {portalCopy.askBody}
            </p>
            <AskForm token={data.token} />
          </section>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}

function RepAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={44}
        height={44}
        className="size-11 rounded-full border-2 border-[#111111] object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-white"
    >
      {initials}
    </span>
  );
}
