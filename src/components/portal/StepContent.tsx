import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { preCallResources } from "@/lib/content/pre-call-resources";
import { portalCopy } from "@/lib/content/portal";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import { formatCallTime } from "@/lib/portal/journey";
import {
  objectionVideo,
  testimonialFor,
  type Persona,
} from "@/lib/portal/personalize";
import type {
  JourneyStep,
  PortalCallSummary,
  PortalData,
} from "@/lib/portal/types";
import type { PortalWin } from "@/lib/portal/wins";
import { IntakeForm, VerifyForm } from "./PortalForms";
import { PRIMARY_BUTTON } from "./styles";
import { LocalOpportunity } from "./LocalOpportunity";

export type StepContext = {
  data: PortalData;
  persona: Persona;
  wins: PortalWin[];
  repFirstName: string | null;
};

const BODY = "text-[15px] leading-relaxed font-semibold text-slate-700";
const LINK =
  "font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]";
const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] border-2 border-[#111111] bg-white px-6 text-sm font-black text-[#111111] uppercase transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";

function ExternalOrLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

/** Google Calendar "add event" link for the call; no ICS file, no dependency. */
function calendarHref(iso: string, repName: string | null): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + 45 * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Vendingpreneurs call${repName ? ` with ${repName}` : ""}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: "Your plan for the call is on your Vendingpreneurs page.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CallActions({
  data,
  repFirstName,
  confirm,
}: {
  data: PortalData;
  repFirstName: string | null;
  confirm: boolean;
}) {
  const call = data.call;
  if (!call) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {confirm && call.confirmUrl ? (
        <ExternalOrLink href={call.confirmUrl} className={PRIMARY_BUTTON}>
          {portalCopy.confirmCta}
        </ExternalOrLink>
      ) : null}
      {!confirm && call.joinUrl ? (
        <ExternalOrLink href={call.joinUrl} className={PRIMARY_BUTTON}>
          {portalCopy.joinCall}
        </ExternalOrLink>
      ) : null}
      {call.scheduledAt ? (
        <a
          href={calendarHref(call.scheduledAt, repFirstName)}
          target="_blank"
          rel="noopener noreferrer"
          className={SECONDARY_BUTTON}
        >
          {portalCopy.addToCalendar}
        </a>
      ) : null}
      {call.rescheduleUrl ? (
        <ExternalOrLink href={call.rescheduleUrl} className={`${LINK} text-sm`}>
          {portalCopy.reschedule}
        </ExternalOrLink>
      ) : null}
    </div>
  );
}

function PersonaStory({ persona }: { persona: Persona }) {
  const { caseStudy } = persona;
  const embed = caseStudy.videoId
    ? getVideoEmbed(`https://youtu.be/${caseStudy.videoId}`)
    : null;
  const testimonial = testimonialFor(persona);
  return (
    <div className="flex flex-col gap-5">
      <p className={BODY}>{caseStudy.excerpt}</p>
      {embed ? (
        <div className="overflow-hidden rounded-[10px] border-2 border-[#111111]">
          <YouTubeEmbedFrame
            embed={embed}
            title={`${caseStudy.name}: ${caseStudy.title}`}
            className="aspect-video w-full"
          />
        </div>
      ) : null}
      <dl className="grid grid-cols-3 gap-3">
        {caseStudy.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[8px] bg-[#f5fbff] px-3 py-2.5"
          >
            <dd className="text-lg font-black text-[#111111]">{stat.value}</dd>
            <dt className="text-[11px] font-black tracking-[0.08em] text-slate-600 uppercase">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
      <p className="text-sm font-semibold text-slate-500">
        {portalCopy.storyNote(caseStudy.name)}{" "}
        <Link href={`/case-studies/${caseStudy.slug}`} className={LINK}>
          {portalCopy.readStory}
        </Link>
      </p>
      {testimonial ? (
        <figure className="border-l-4 border-[#2a8fcc] pl-4">
          <blockquote className={`${BODY} line-clamp-4`}>
            &ldquo;{testimonial.body[0]}&rdquo;
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-3">
            <Image
              src={testimonial.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full border-2 border-[#111111] object-cover"
            />
            <span className="text-sm">
              <span className="block font-black text-[#111111]">
                {testimonial.name}
              </span>
              <span className="block font-semibold text-slate-600">
                {testimonial.role}
              </span>
            </span>
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function ObjectionVideos({ persona, all }: { persona: Persona; all: boolean }) {
  const picked = objectionVideo(persona.objectionId);
  const others = all
    ? preCallResources.items.filter((item) => item.id !== picked.id)
    : [];
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-[16px] font-black text-[#111111]">
        {picked.question}
      </h4>
      <p className={BODY}>{picked.answer}</p>
      <VidalyticsPlayer
        embedId={picked.embedId}
        loadOn="click"
        title={picked.question}
      />
      {others.map((item) => (
        <details
          key={item.id}
          className="rounded-[8px] border-2 border-slate-200 p-4 open:border-[#111111]"
        >
          <summary className="cursor-pointer text-[15px] font-black text-[#111111]">
            {item.question}
          </summary>
          <p className={`${BODY} mt-3`}>{item.answer}</p>
          <VidalyticsPlayer
            embedId={item.embedId}
            loadOn="click"
            title={item.question}
            className="mt-4"
          />
        </details>
      ))}
    </div>
  );
}

function Wins({ wins }: { wins: PortalWin[] }) {
  return (
    <div className="flex flex-col gap-4">
      {wins.length ? (
        <ul className="flex flex-col divide-y divide-slate-200">
          {wins.slice(0, 3).map((win) => (
            <li key={win.id} className="flex gap-3 py-4 first:pt-0">
              {win.avatar ? (
                <Image
                  src={win.avatar}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full border-2 border-[#111111] object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#eaf6ff] text-sm font-black"
                >
                  {win.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-black text-[#111111]">
                  {win.name}
                  <span className="ml-2 text-xs tracking-[0.08em] text-[#066a99] uppercase">
                    {win.winType ?? "Win"}
                  </span>
                </p>
                <p className={`${BODY} mt-1 line-clamp-3`}>{win.excerpt}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={BODY}>{portalCopy.winsEmpty}</p>
      )}
      <a
        href={portalCopy.winsWall.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${LINK} text-sm`}
      >
        {portalCopy.winsWall.label}
      </a>
    </div>
  );
}

function CallSummary({ summary }: { summary: PortalCallSummary }) {
  return (
    <div className="flex flex-col gap-6">
      {summary.recordingUrl ? (
        <ExternalOrLink
          href={summary.recordingUrl}
          className={`${SECONDARY_BUTTON} self-start`}
        >
          {portalCopy.replay}
        </ExternalOrLink>
      ) : null}
      {summary.highlights.map((h) => (
        <figure key={h.quote} className="rounded-[10px] bg-[#eaf6ff] p-5">
          <p className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
            Worth remembering{h.timestamp ? ` · ${h.timestamp}` : ""}
          </p>
          <blockquote className="mt-2 text-lg leading-snug font-black text-[#111111]">
            &ldquo;{h.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-sm font-semibold text-slate-700">
            {h.why}
          </figcaption>
        </figure>
      ))}
      <SummaryList title="What we talked about" items={summary.discussed} />
      {summary.yourQuestions.length ? (
        <div>
          <h4 className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
            What you asked
          </h4>
          <dl className="mt-3 flex flex-col gap-4">
            {summary.yourQuestions.map((qa) => (
              <div key={qa.question}>
                <dt className="text-[15px] font-black text-[#111111]">
                  {qa.question}
                </dt>
                <dd className={`${BODY} mt-1`}>{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <SummaryList title="What we recommended" items={summary.recommended} />
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
        {title}
      </h4>
      <ul className={`${BODY} mt-3 flex list-disc flex-col gap-2 pl-5`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** `onboarding.skoolInviteUrl` style hrefs resolve against the prospect's onboarding links. */
function resolveHref(
  href: string | undefined,
  data: PortalData,
): string | null {
  if (!href) return null;
  if (!href.startsWith("onboarding.")) return href;
  const key = href.slice("onboarding.".length) as keyof NonNullable<
    PortalData["onboarding"]
  >;
  return data.onboarding?.[key] ?? null;
}

/** What opens inside a step. One case per content slot in the journey definition. */
export function StepContent({
  step,
  ctx,
}: {
  step: JourneyStep;
  ctx: StepContext;
}) {
  const { data, persona, wins, repFirstName } = ctx;
  switch (step.content) {
    case "intake":
      return <IntakeForm token={data.token} prospect={data.prospect} />;
    case "confirm_call": {
      const when = formatCallTime(data.call?.scheduledAt);
      return (
        <div className="flex flex-col gap-4">
          {when ? (
            <p className="text-lg font-black text-[#111111]">{when}</p>
          ) : null}
          <CallActions data={data} repFirstName={repFirstName} confirm />
        </div>
      );
    }
    case "persona_story":
      return <PersonaStory persona={persona} />;
    case "objection_video":
      return <ObjectionVideos persona={persona} all={data.stage === "lost"} />;
    case "local_map":
      return data.localMarket ? (
        <LocalOpportunity market={data.localMarket} />
      ) : (
        <p className={BODY}>{portalCopy.mapEmpty}</p>
      );
    case "wins":
      return <Wins wins={wins} />;
    case "call_prep":
      return (
        <ol className="flex flex-col gap-3">
          {portalCopy.prepItems.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eaf6ff] text-sm font-black text-[#066a99]">
                {index + 1}
              </span>
              <span className={BODY}>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "call":
      return (
        <div className="flex flex-col gap-4">
          <p className={BODY}>{portalCopy.callBody}</p>
          <CallActions
            data={data}
            repFirstName={repFirstName}
            confirm={false}
          />
        </div>
      );
    case "verify_email":
      return data.access === "verified" ? (
        <p className={BODY}>Your notes are unlocked.</p>
      ) : (
        <VerifyForm token={data.token} emailHint={data.prospect.emailHint} />
      );
    case "call_summary":
      return data.callSummary ? (
        <CallSummary summary={data.callSummary} />
      ) : (
        <p className={BODY}>{portalCopy.summaryLocked}</p>
      );
    case "main_question":
      return (
        <ObjectionVideos
          persona={{
            ...persona,
            objectionId:
              data.callSummary?.mainQuestionId ?? persona.objectionId,
          }}
          all={false}
        />
      );
    case "book_follow_up": {
      const href = data.followUpUrl ?? "/contact";
      return (
        <div className="flex flex-col gap-4">
          <p className={BODY}>{portalCopy.followUpBody(repFirstName)}</p>
          <ExternalOrLink
            href={href}
            className={`${PRIMARY_BUTTON} self-start`}
          >
            {data.stage === "lost"
              ? portalCopy.rebookCta
              : portalCopy.followUpCta}
          </ExternalOrLink>
        </div>
      );
    }
    case "link": {
      const href = resolveHref(step.href, data);
      if (!href) return null;
      return (
        <ExternalOrLink href={href} className={`${PRIMARY_BUTTON} self-start`}>
          {portalCopy.open}
        </ExternalOrLink>
      );
    }
  }
}
