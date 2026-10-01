import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { LegalFooter } from "@/components/site/LegalFooter";
import { VidalyticsGlobalTag } from "@/components/media/VidalyticsPlayer";
import { portalCopy, portalHero, portalSections } from "@/lib/content/portal";
import {
  dayKey,
  daysUntil,
  formatCallTime,
  formatDay,
  isDone,
  schedule,
  stepsFor,
} from "@/lib/portal/journey";
import {
  moduleOrder,
  personaFor,
  type ModuleId,
} from "@/lib/portal/personalize";
import type { JourneyStep, PortalData } from "@/lib/portal/types";
import type { PortalWin } from "@/lib/portal/wins";
import {
  MobileNextBar,
  PortalChecklist,
  type ChecklistStep,
  type WeekDay,
} from "./PortalChecklist";
import {
  AskSection,
  ExternalOrLink,
  FaqSection,
  FollowUpSection,
  IntakeSection,
  LINK,
  LocalSection,
  LockedSection,
  OnboardingSection,
  PeopleSection,
  ResourcesSection,
  SECONDARY_BUTTON,
  SummarySection,
  WinsSection,
} from "./PortalModules";
import { PRIMARY_BUTTON } from "./styles";

// /portal/[token]: one prospect's page. Centered hero on their name, then the
// sections laid out full width with the Next Steps checklist pinned beside
// them (sticky sidebar on desktop, pinned "Next:" bar on mobile).
// Visual language is the VP site (/apply, /pre-call-resources).

const firstName = (name: string | undefined | null) =>
  name?.split(/\s+/)[0] ?? null;

/** Where a checklist step points: the section on this page that does it, or its external link. */
const STEP_ANCHOR: Record<JourneyStep["content"], string> = {
  intake: "#intake",
  confirm_call: "#call",
  persona_story: "#people",
  objection_video: "#faq",
  local_map: "#local",
  wins: "#wins",
  call_prep: "#prep",
  call: "#call",
  verify_email: "#summary",
  call_summary: "#summary",
  main_question: "#main-question",
  book_follow_up: "#follow-up",
  link: "#onboarding",
};

function resolveHref(step: JourneyStep, data: PortalData): string {
  if (step.content !== "link" || !step.href) return STEP_ANCHOR[step.content];
  if (!step.href.startsWith("onboarding.")) return step.href;
  const key = step.href.slice("onboarding.".length) as keyof NonNullable<
    PortalData["onboarding"]
  >;
  return data.onboarding?.[key] ?? "#onboarding";
}

/** Google Calendar "add event" link; no ICS file, no dependency. */
function calendarHref(iso: string, repName: string | null): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + 45 * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `Vendingpreneurs call${repName ? ` with ${repName}` : ""}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: "Your plan for the call is on your Vendingpreneurs page.",
  }).toString()}`;
}

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

  // Journey → checklist + week calendar.
  const steps = stepsFor(data);
  const plan = schedule(steps, data, now);
  const today = dayKey(now);
  const dueOf = new Map(
    plan.flatMap((day) => day.stepKeys.map((key) => [key, day] as const)),
  );
  const anchorLabel =
    data.stage === "won" ? portalCopy.joinDay : portalCopy.callDay;
  const dated = data.stage !== "lost";
  const fill = (title: string) =>
    title
      .replace("{rep}", repFirstName ?? "your advisor")
      .replace("{story}", persona.caseStudy.name);

  const checklist: ChecklistStep[] = steps.map((step) => {
    const href = resolveHref(step, data);
    const day = dueOf.get(step.key);
    return {
      key: step.key,
      title: fill(step.title),
      href,
      external: !href.startsWith("#") && !href.startsWith("/"),
      completedBy: step.completedBy,
      systemDone: isDone(step, data, new Set()),
      due:
        !dated || !day
          ? null
          : day.isAnchor
            ? anchorLabel
            : day.key === today
              ? portalCopy.today
              : formatDay(day.key, "long"),
    };
  });
  const week: WeekDay[] = dated
    ? plan.slice(0, 7).map((day) => ({
        key: day.key,
        chipDay: formatDay(day.key, "short"),
        chipDate: String(Number(day.key.slice(8))),
        isToday: day.isToday,
        anchorLabel:
          day.isAnchor && (data.stage === "won" || data.call?.scheduledAt)
            ? anchorLabel
            : null,
        stepKeys: day.stepKeys,
      }))
    : [];

  const callTime = formatCallTime(data.call?.scheduledAt);
  const hero = portalHero(data.stage, {
    repFirstName,
    daysUntilCall: daysUntil(data.call?.scheduledAt, now),
    callDay: data.call?.scheduledAt
      ? formatDay(dayKey(new Date(data.call.scheduledAt)), "long").split(",")[0]
      : null,
  });

  const needsIntake = steps.some((step) => step.content === "intake");
  const onboardingItems = steps
    .filter((step) => step.content === "link")
    .map((step) => {
      const href = resolveHref(step, data);
      return {
        key: step.key,
        title: fill(step.title),
        href: href.startsWith("#") ? null : href,
        done: data.completedSteps.includes(step.key),
      };
    });

  const sections: Record<ModuleId, React.ReactNode> = {
    local: <LocalSection market={data.localMarket} />,
    people: <PeopleSection persona={persona} />,
    wins: <WinsSection wins={wins} stage={data.stage} />,
    faq: <FaqSection persona={persona} stage={data.stage} />,
    summary: (
      <SummarySection
        data={data}
        persona={persona}
        repFirstName={repFirstName}
      />
    ),
    onboarding: <OnboardingSection items={onboardingItems} />,
    resources: <ResourcesSection stage={data.stage} />,
  };

  return (
    <>
      <VidalyticsGlobalTag />
      <MobileNextBar
        token={data.token}
        steps={checklist}
        initialDone={data.completedSteps}
      />
      <header className="border-b-2 border-[#111111] bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <Wordmark height={30} eager />
          <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase">
            Prepared for {data.prospect.firstName}
          </p>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b-2 border-[#111111]">
          <div
            aria-hidden
            className="absolute inset-0 bg-[#eaf6ff]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(42,143,204,0.2) 1.4px, transparent 1.4px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto flex max-w-[900px] flex-col items-center px-5 pt-16 pb-16 text-center lg:pt-20">
            <p className="rounded-full border-2 border-[#111111] bg-white px-4 py-1.5 text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
              {hero.eyebrow}
            </p>
            <h1 className="mt-6 max-w-[18ch] text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.02] font-black tracking-tight text-balance text-[#111111] uppercase">
              {hero.before}
              <span className="relative isolate inline-block whitespace-nowrap text-[#1f72a5]">
                {data.prospect.firstName}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[0.06em] -z-10 h-[0.28em] bg-[#55b8e8]/45"
                />
              </span>
              {hero.after}
            </h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed font-semibold text-slate-700">
              {hero.body}
            </p>

            {data.prospect.goal ? (
              <p className="mt-6 max-w-[60ch] text-[15px] font-semibold text-slate-700">
                <span className="font-black tracking-[0.1em] text-[#066a99] uppercase">
                  {portalCopy.goalLead}:{" "}
                </span>
                &ldquo;{data.prospect.goal}&rdquo;
              </p>
            ) : null}

            {data.call ? (
              <div
                id="call"
                className="mt-9 flex w-full max-w-[640px] scroll-mt-24 flex-col items-center gap-4 rounded-[14px] border-2 border-[#111111] bg-white p-5 text-left shadow-[8px_8px_0_#55b8e8] sm:flex-row"
              >
                <RepAvatar
                  name={data.call.rep.name}
                  photoUrl={data.call.rep.photoUrl}
                />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-sm font-black text-[#111111]">
                    {data.call.rep.name}
                    <span className="font-semibold text-slate-600">
                      {" "}
                      · {data.call.rep.title ?? "Your Vendingpreneurs advisor"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[15px] font-black text-[#111111]">
                    {data.stage === "pre_call"
                      ? (callTime ??
                        "Your call time is in your confirmation email")
                      : "Your advisor"}
                  </p>
                  {data.stage === "pre_call" && data.call.rescheduleUrl ? (
                    <ExternalOrLink
                      href={data.call.rescheduleUrl}
                      className={`${LINK} text-sm`}
                    >
                      {portalCopy.reschedule}
                    </ExternalOrLink>
                  ) : null}
                </div>
                {data.stage === "pre_call" ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    {data.call.confirmUrl ? (
                      <ExternalOrLink
                        href={data.call.confirmUrl}
                        className={PRIMARY_BUTTON}
                      >
                        {portalCopy.confirmCta}
                      </ExternalOrLink>
                    ) : null}
                    {data.call.scheduledAt ? (
                      <a
                        href={calendarHref(data.call.scheduledAt, repFirstName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={SECONDARY_BUTTON}
                      >
                        {portalCopy.addToCalendar}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-10">
          <div className="order-2 flex min-w-0 flex-col gap-16 lg:order-1">
            {needsIntake ? <IntakeSection data={data} /> : null}
            {moduleOrder(data.stage, data.prospect.goal).map((id) => (
              <div key={id}>{sections[id]}</div>
            ))}
            {data.stage === "pre_call" ? (
              <LockedSection {...portalSections.locked.summary} />
            ) : null}
            {data.stage === "pre_call" || data.stage === "post_call" ? (
              <LockedSection {...portalSections.locked.onboarding} />
            ) : null}
            {data.stage === "post_call" || data.stage === "lost" ? (
              <FollowUpSection data={data} repFirstName={repFirstName} />
            ) : null}
            <AskSection token={data.token} repFirstName={repFirstName} />
          </div>
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-6">
              <PortalChecklist
                token={data.token}
                steps={checklist}
                week={week}
                initialDone={data.completedSteps}
              />
            </div>
          </aside>
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
        width={52}
        height={52}
        className="size-13 rounded-full border-2 border-[#111111] object-cover"
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
      className="grid size-13 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-base font-black text-white"
    >
      {initials}
    </span>
  );
}
