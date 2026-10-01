import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/site/Wordmark";
import { LegalFooter } from "@/components/site/LegalFooter";
import { VidalyticsGlobalTag } from "@/components/media/VidalyticsPlayer";
import { CheckIcon } from "@/components/sections/apply/icons";
import {
  formatCallTime,
  moduleOrder,
  nextSteps,
  personaFor,
  type ModuleId,
  type NextStep,
} from "@/lib/portal/personalize";
import type { PortalWin } from "@/lib/portal/wins";
import {
  PORTAL_HERO_SUBLINE,
  PORTAL_LOCKED,
  PORTAL_STAGE_LABEL,
} from "@/lib/content/portal";
import type { PortalData } from "@/lib/portal/types";
import {
  FaqModule,
  IntakeModule,
  LocalModule,
  LockedModule,
  OnboardingModule,
  PeopleModule,
  ResourcesModule,
  SummaryModule,
  WinsModule,
} from "./PortalModules";

// /portal/[token] — one prospect's journey page (Client Journey Portal PRD).
// One layout, four stage states, one persistent Next Steps spine. Visual
// language is /pre-call-resources and /apply: ink borders, offset sky shadows,
// uppercase black headings, dotted paper-blue hero wash.

export function PortalPage({
  data,
  wins,
}: {
  data: PortalData;
  wins: PortalWin[];
}) {
  const persona = personaFor(data.prospect.occupation);
  const steps = nextSteps(data);
  const order = moduleOrder(data.stage, data.prospect.goal);
  const needsIntake =
    data.stage === "pre_call" &&
    (!data.prospect.occupation || !data.prospect.zip);

  const render = (id: ModuleId) => {
    switch (id) {
      case "local":
        return <LocalModule key={id} market={data.localMarket} />;
      case "people":
        return <PeopleModule key={id} persona={persona} />;
      case "wins":
        return <WinsModule key={id} wins={wins} stage={data.stage} />;
      case "faq":
        return <FaqModule key={id} persona={persona} />;
      case "summary":
        return data.callSummary ? (
          <SummaryModule
            key={id}
            summary={data.callSummary}
            persona={persona}
            repName={data.call?.rep.name}
          />
        ) : (
          <LockedModule
            key={id}
            id="summary"
            {...PORTAL_LOCKED.summaryPending}
          />
        );
      case "onboarding":
        return (
          <OnboardingModule
            key={id}
            onboarding={data.onboarding}
            steps={steps}
          />
        );
      case "resources":
        return <ResourcesModule key={id} stage={data.stage} />;
    }
  };

  return (
    <>
      <VidalyticsGlobalTag />
      <MobileNextBar steps={steps} />
      <header className="border-b-2 border-[#111111] bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <Wordmark height={30} eager />
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {PORTAL_STAGE_LABEL[data.stage]}
          </p>
        </div>
      </header>

      <main>
        <Hero data={data} />
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-10">
          <div className="order-2 flex min-w-0 flex-col gap-10 lg:order-1">
            {needsIntake ? (
              <IntakeModule token={data.token} prospect={data.prospect} />
            ) : null}
            {order.map(render)}
            {data.stage === "pre_call" ? (
              <LockedModule id="summary" {...PORTAL_LOCKED.summary} />
            ) : null}
            {data.stage === "pre_call" || data.stage === "post_call" ? (
              <LockedModule id="onboarding" {...PORTAL_LOCKED.onboarding} />
            ) : null}
          </div>
          <aside className="order-1 lg:order-2">
            <NextStepsPanel steps={steps} />
          </aside>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}

function Hero({ data }: { data: PortalData }) {
  const { prospect, call, stage } = data;
  const when = formatCallTime(call?.scheduledAt);

  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[#eaf6ff]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto max-w-[1180px] px-5 pt-14 pb-14 lg:px-10 lg:pt-20">
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          Prepared for {prospect.firstName}
          {prospect.lastName ? ` ${prospect.lastName}` : ""}
        </p>
        <h1 className="mt-4 max-w-[18ch] text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[1.02] font-black tracking-tight text-balance text-[#111111] uppercase">
          We built this for you, {prospect.firstName}.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed font-semibold text-slate-700">
          {PORTAL_HERO_SUBLINE[stage]}
        </p>
        {call ? (
          <div
            id="call"
            className="mt-8 inline-flex max-w-full flex-wrap items-center gap-4 rounded-[10px] border-2 border-[#111111] bg-white px-5 py-4 shadow-[7px_7px_0_#55b8e8]"
          >
            <RepAvatar name={call.rep.name} photoUrl={call.rep.photoUrl} />
            <div className="min-w-0">
              <p className="text-sm font-black text-[#111111]">
                {call.rep.name}
                {call.rep.title ? (
                  <span className="font-semibold text-slate-600">
                    , {call.rep.title}
                  </span>
                ) : null}
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {stage === "pre_call"
                  ? when
                    ? `Your call: ${when}`
                    : "Your call time is in your confirmation email"
                  : "Your Vendingpreneurs advisor"}
              </p>
            </div>
            {stage === "pre_call" && call.rescheduleUrl ? (
              <Link
                href={call.rescheduleUrl}
                className="text-sm font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]"
              >
                Need a different time?
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
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
        width={48}
        height={48}
        className="size-12 rounded-full border-2 border-[#111111] object-cover"
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
      className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-white"
    >
      {initials}
    </span>
  );
}

function firstOpen(steps: NextStep[]): NextStep | undefined {
  return steps.find((step) => !step.done);
}

/** PRD §6.1: the spine. Sticky sidebar on desktop, full list up top on mobile. */
function NextStepsPanel({ steps }: { steps: NextStep[] }) {
  const current = firstOpen(steps);
  return (
    <section
      id="next-steps"
      aria-labelledby="next-steps-heading"
      className="scroll-mt-20 rounded-[12px] border-2 border-[#111111] bg-white p-6 shadow-[8px_8px_0_#111111] lg:sticky lg:top-6"
    >
      <h2
        id="next-steps-heading"
        className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase"
      >
        Your next steps
      </h2>
      <ol className="mt-5 flex flex-col gap-3">
        {steps.map((step, index) => {
          const isCurrent = step.id === current?.id;
          return (
            <li key={step.id}>
              <a
                href={step.href}
                target={step.external ? "_blank" : undefined}
                rel={step.external ? "noopener noreferrer" : undefined}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-start gap-3 rounded-[8px] border-2 p-3 transition focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none ${
                  isCurrent
                    ? "border-[#111111] bg-[#eaf6ff] hover:-translate-y-0.5"
                    : "border-transparent hover:border-[#111111]"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#111111] text-sm font-black ${
                    step.done
                      ? "bg-[#111111] text-white"
                      : isCurrent
                        ? "bg-[#2a8fcc] text-white"
                        : "bg-white text-[#111111]"
                  }`}
                >
                  {step.done ? <CheckIcon className="size-4" /> : index + 1}
                </span>
                <span className="min-w-0 pt-1">
                  <span
                    className={`block text-[15px] leading-snug font-black ${
                      step.done
                        ? "text-slate-500 line-through"
                        : "text-[#111111]"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.detail ? (
                    <span className="mt-0.5 block text-sm font-semibold text-slate-600">
                      {step.detail}
                    </span>
                  ) : null}
                  {step.done ? <span className="sr-only">(done)</span> : null}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Mobile only: the one next step, pinned, so it is never more than a tap away. */
function MobileNextBar({ steps }: { steps: NextStep[] }) {
  const current = firstOpen(steps);
  if (!current) return null;
  return (
    <div className="sticky top-0 z-30 border-b-2 border-[#111111] bg-[#111111] lg:hidden">
      <a
        href="#next-steps"
        className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-3 text-white"
      >
        <span className="min-w-0 truncate text-sm font-black">
          <span className="text-[#55b8e8] uppercase">Next: </span>
          {current.label}
        </span>
        <span className="shrink-0 text-xs font-black tracking-[0.1em] uppercase">
          All steps
        </span>
      </a>
    </div>
  );
}
