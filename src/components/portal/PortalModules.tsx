import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { preCallResources } from "@/lib/content/pre-call-resources";
import { portalCopy, portalSections } from "@/lib/content/portal";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import {
  objectionVideo,
  testimonialFor,
  type Persona,
} from "@/lib/portal/personalize";
import type {
  PortalCallSummary,
  PortalData,
  PortalLocalMarket,
  PortalStage,
} from "@/lib/portal/types";
import type { PortalWin } from "@/lib/portal/wins";
import { LocalOpportunity } from "./LocalOpportunity";
import { AskForm, IntakeForm, VerifyForm } from "./PortalForms";
import { PRIMARY_BUTTON } from "./styles";

// The portal's sections. Server components; the three interactive pieces
// (map, forms, checklist) are client components imported here or in PortalPage.

export const CARD =
  "rounded-[12px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#55b8e8]";
const BODY = "text-[15px] leading-relaxed font-semibold text-slate-700";
export const LINK =
  "font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]";
export const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] border-2 border-[#111111] bg-white px-6 text-sm font-black text-[#111111] uppercase transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";

export function ExternalOrLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (href.startsWith("/") || href.startsWith("#")) {
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

function Module({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {eyebrow}
      </p>
      <h2
        id={`${id}-heading`}
        className="mt-3 max-w-[26ch] text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.06] font-black text-balance text-[#111111] uppercase"
      >
        {title}
      </h2>
      {intro ? (
        <p className={`${BODY} mt-3 max-w-[62ch] text-[16px]`}>{intro}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ---------- Intake (only when occupation or ZIP is missing) ---------- */

export function IntakeSection({ data }: { data: PortalData }) {
  return (
    <section
      id="intake"
      aria-labelledby="intake-heading"
      className={`${CARD} scroll-mt-24 p-6`}
    >
      <h2
        id="intake-heading"
        className="text-xl font-black text-[#111111] uppercase"
      >
        {portalSections.intake.title}
      </h2>
      <p className={`${BODY} mt-2 mb-5`}>{portalSections.intake.body}</p>
      <IntakeForm token={data.token} prospect={data.prospect} />
    </section>
  );
}

/* ---------- Your local opportunity (live map) ---------- */

export function LocalSection({ market }: { market: PortalLocalMarket | null }) {
  const copy = portalSections.local;
  if (!market) {
    return (
      <Module
        id="local"
        eyebrow="Your local opportunity"
        title={copy.emptyTitle}
        intro={copy.emptyBody}
      >
        <ul className="flex flex-wrap gap-2">
          {copy.metros.map((metro) => (
            <li
              key={metro}
              className="rounded-full border-2 border-[#111111] bg-[#eaf6ff] px-3 py-1 text-sm font-black text-[#111111]"
            >
              {metro}
            </li>
          ))}
        </ul>
      </Module>
    );
  }
  return (
    <Module
      id="local"
      eyebrow={copy.eyebrow(market.zip)}
      title={copy.title(market.city)}
    >
      <LocalOpportunity market={market} />
    </Module>
  );
}

/* ---------- People like you ---------- */

export function PeopleSection({ persona }: { persona: Persona }) {
  const { caseStudy } = persona;
  const embed = caseStudy.videoId
    ? getVideoEmbed(`https://youtu.be/${caseStudy.videoId}`)
    : null;
  const testimonial = testimonialFor(persona);
  return (
    <Module
      id="people"
      eyebrow={portalSections.people.eyebrow(persona.label)}
      title={caseStudy.title}
      intro={caseStudy.excerpt}
    >
      {embed ? (
        <div className="overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[6px_6px_0_#111111]">
          <YouTubeEmbedFrame
            embed={embed}
            title={`${caseStudy.name}: ${caseStudy.title}`}
            className="aspect-video w-full"
          />
        </div>
      ) : null}
      <dl className="mt-6 grid grid-cols-3 gap-3">
        {caseStudy.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[10px] border-2 border-[#111111] bg-white px-4 py-3"
          >
            <dd className="text-xl font-black text-[#111111]">{stat.value}</dd>
            <dt className="text-[11px] font-black tracking-[0.08em] text-slate-600 uppercase">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm font-semibold text-slate-500">
        {portalCopy.storyNote(caseStudy.name)}{" "}
        <Link href={`/case-studies/${caseStudy.slug}`} className={LINK}>
          {portalCopy.readStory}
        </Link>
      </p>
      {testimonial ? (
        <figure className={`${CARD} mt-8 p-6`}>
          <blockquote className={`${BODY} line-clamp-5 text-[16px]`}>
            &ldquo;{testimonial.body[0]}&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <Image
              src={testimonial.avatarUrl}
              alt=""
              width={44}
              height={44}
              className="size-11 rounded-full border-2 border-[#111111] object-cover"
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
    </Module>
  );
}

/* ---------- Community wins (live feed) ---------- */

function winDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
}

export function WinsSection({
  wins,
  stage,
}: {
  wins: PortalWin[];
  stage: PortalStage;
}) {
  const copy = portalSections.wins.byStage[stage];
  return (
    <Module
      id="wins"
      eyebrow={portalSections.wins.eyebrow}
      title={copy.title}
      intro={wins.length ? copy.intro : undefined}
    >
      {wins.length ? (
        <ul className="grid gap-5 sm:grid-cols-2">
          {wins.map((win) => (
            <li key={win.id} className={`${CARD} flex flex-col p-5`}>
              <div className="flex items-center gap-3">
                {win.avatar ? (
                  <Image
                    src={win.avatar}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full border-2 border-[#111111] object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-full border-2 border-[#111111] bg-[#eaf6ff] text-sm font-black"
                  >
                    {win.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#111111]">
                    {win.name}
                  </span>
                  <span className="block text-xs font-black tracking-[0.08em] text-[#066a99] uppercase">
                    {win.winType ?? "Win"}
                    {win.postedAt ? ` · ${winDate(win.postedAt)}` : ""}
                  </span>
                </span>
              </div>
              <p className={`${BODY} mt-3 line-clamp-5`}>{win.excerpt}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-5">
        <a
          href={portalCopy.winsWall.href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {portalCopy.winsWall.label}
        </a>
      </p>
    </Module>
  );
}

/* ---------- What to expect (Mike's answers + prep) ---------- */

function VideoAnswer({ id }: { id: Persona["objectionId"] }) {
  const video = objectionVideo(id);
  return (
    <div className={`${CARD} p-5`}>
      <h3 className="text-lg font-black text-[#111111]">{video.question}</h3>
      <p className={`${BODY} mt-2`}>{video.answer}</p>
      <VidalyticsPlayer
        embedId={video.embedId}
        loadOn="click"
        title={video.question}
        className="mt-4"
      />
    </div>
  );
}

export function FaqSection({
  persona,
  stage,
}: {
  persona: Persona;
  stage: PortalStage;
}) {
  const copy = portalSections.faq;
  const others = preCallResources.items.filter(
    (item) => item.id !== persona.objectionId,
  );
  return (
    <Module
      id="faq"
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
    >
      <VideoAnswer id={persona.objectionId} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {others.map((item) => (
          <details
            key={item.id}
            className="group rounded-[10px] border-2 border-[#111111] bg-white p-4 open:sm:col-span-2"
          >
            <summary className="cursor-pointer text-[15px] leading-snug font-black text-[#111111]">
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
      {stage === "pre_call" ? (
        <div
          id="prep"
          className="mt-8 scroll-mt-24 rounded-[12px] bg-[#eaf6ff] p-6"
        >
          <h3 className="text-lg font-black text-[#111111] uppercase">
            {copy.prepTitle}
          </h3>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {copy.prepItems.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-white text-sm font-black">
                  {index + 1}
                </span>
                <span className={BODY}>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Module>
  );
}

/* ---------- Call summary (post-call, behind email verification) ---------- */

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={`${CARD} p-5`}>
      <h3 className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
        {title}
      </h3>
      <ul className={`${BODY} mt-3 flex list-disc flex-col gap-2 pl-5`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SummaryBody({ summary }: { summary: PortalCallSummary }) {
  return (
    <>
      {summary.recordingUrl ? (
        <ExternalOrLink
          href={summary.recordingUrl}
          className={`${SECONDARY_BUTTON} mb-6`}
        >
          {portalCopy.replay}
        </ExternalOrLink>
      ) : null}
      {summary.highlights.map((h) => (
        <figure
          key={h.quote}
          className="mb-6 rounded-[12px] border-2 border-[#111111] bg-[#eaf6ff] p-6 shadow-[6px_6px_0_#111111]"
        >
          <p className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
            Worth remembering{h.timestamp ? ` · ${h.timestamp}` : ""}
          </p>
          <blockquote className="mt-2 text-xl leading-snug font-black text-[#111111]">
            &ldquo;{h.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-sm font-semibold text-slate-700">
            {h.why}
          </figcaption>
        </figure>
      ))}
      <div className="grid gap-5 md:grid-cols-2">
        <SummaryList title="What we talked about" items={summary.discussed} />
        <SummaryList title="What we recommended" items={summary.recommended} />
      </div>
      {summary.yourQuestions.length ? (
        <>
          <h3 className="mt-8 text-lg font-black text-[#111111] uppercase">
            What you asked
          </h3>
          <dl className="mt-4 grid gap-4">
            {summary.yourQuestions.map((qa) => (
              <div key={qa.question} className={`${CARD} p-5`}>
                <dt className="text-[16px] font-black text-[#111111]">
                  {qa.question}
                </dt>
                <dd className={`${BODY} mt-2`}>{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </>
  );
}

export function SummarySection({
  data,
  persona,
  repFirstName,
}: {
  data: PortalData;
  persona: Persona;
  repFirstName: string | null;
}) {
  const copy = portalSections.summary;
  const verified = data.access === "verified";
  return (
    <Module
      id="summary"
      eyebrow={copy.eyebrow}
      title={verified ? copy.title : copy.lockedTitle}
      intro={verified ? copy.intro(repFirstName) : undefined}
    >
      {verified && data.callSummary ? (
        <SummaryBody summary={data.callSummary} />
      ) : (
        <div className={`${CARD} p-6`}>
          <VerifyForm token={data.token} emailHint={data.prospect.emailHint} />
        </div>
      )}
      <div id="main-question" className="mt-10 scroll-mt-24">
        <h3 className="mb-4 text-lg font-black text-[#111111] uppercase">
          {copy.mainQuestion}
        </h3>
        <VideoAnswer
          id={data.callSummary?.mainQuestionId ?? persona.objectionId}
        />
      </div>
    </Module>
  );
}

/* ---------- Follow-up / rebook ---------- */

export function FollowUpSection({
  data,
  repFirstName,
}: {
  data: PortalData;
  repFirstName: string | null;
}) {
  const copy = portalSections.summary;
  return (
    <section
      id="follow-up"
      className="scroll-mt-24 rounded-[12px] border-2 border-[#111111] bg-[#111111] p-8 text-center"
    >
      <h2 className="text-2xl font-black text-white uppercase">
        {copy.followUpTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-[48ch] text-[16px] font-semibold text-slate-300">
        {copy.followUpBody(repFirstName)}
      </p>
      <ExternalOrLink
        href={data.followUpUrl ?? "/contact"}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border-2 border-white bg-[#1f72a5] px-7 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8] transition hover:-translate-y-0.5"
      >
        {data.stage === "lost" ? portalCopy.rebookCta : portalCopy.followUpCta}
      </ExternalOrLink>
    </section>
  );
}

/* ---------- Onboarding (won) ---------- */

export type OnboardingItem = {
  key: string;
  title: string;
  href: string | null;
  done: boolean;
};

export function OnboardingSection({ items }: { items: OnboardingItem[] }) {
  const copy = portalSections.onboarding;
  return (
    <Module id="onboarding" eyebrow={copy.eyebrow} title={copy.title}>
      <ol className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className={`${CARD} flex flex-col gap-3 p-5 ${item.done ? "opacity-60" : ""}`}
          >
            <span className="grid size-9 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-white">
              {index + 1}
            </span>
            <h3 className="text-[17px] font-black text-[#111111]">
              {item.title}
            </h3>
            <p className={`${BODY} flex-1`}>{copy.detail[item.key]}</p>
            {item.done ? (
              <span className="text-xs font-black tracking-[0.1em] text-[#14532d] uppercase">
                {copy.done}
              </span>
            ) : item.href ? (
              <ExternalOrLink
                href={item.href}
                className={`${PRIMARY_BUTTON} self-start`}
              >
                {copy.start}
              </ExternalOrLink>
            ) : null}
          </li>
        ))}
      </ol>
    </Module>
  );
}

/* ---------- Resources, locked teasers, ask ---------- */

export function ResourcesSection({ stage }: { stage: PortalStage }) {
  const copy = portalSections.resources;
  return (
    <Module id="resources" eyebrow={copy.eyebrow} title={copy.title}>
      <ul className="grid gap-4 sm:grid-cols-3">
        {copy.byStage[stage].map((item) => (
          <li key={item.label}>
            <ExternalOrLink
              href={item.href}
              className={`${CARD} block h-full p-5 transition hover:-translate-y-0.5`}
            >
              <span className="block text-[16px] font-black text-[#111111]">
                {item.label}
              </span>
              <span className="mt-1 block text-sm font-semibold text-slate-600">
                {item.detail}
              </span>
            </ExternalOrLink>
          </li>
        ))}
      </ul>
    </Module>
  );
}

export function LockedSection({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <section
      aria-label={`${title} (locked)`}
      className="rounded-[12px] border-2 border-dashed border-slate-400 bg-[#f5fbff] p-6"
    >
      <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase">
        Locked
      </p>
      <h2 className="mt-2 text-xl font-black text-slate-700 uppercase">
        {title}
      </h2>
      <p className="mt-2 max-w-[56ch] text-[15px] font-semibold text-slate-600">
        {note}
      </p>
    </section>
  );
}

export function AskSection({
  token,
  repFirstName,
}: {
  token: string;
  repFirstName: string | null;
}) {
  return (
    <section
      id="ask"
      aria-labelledby="ask-heading"
      className="scroll-mt-24 rounded-[12px] border-2 border-[#111111] bg-[#f5fbff] p-6"
    >
      <h2
        id="ask-heading"
        className="text-lg font-black text-[#111111] uppercase"
      >
        {portalCopy.askHeading(repFirstName)}
      </h2>
      <p className={`${BODY} mt-1 mb-4`}>{portalCopy.askBody}</p>
      <AskForm token={token} />
    </section>
  );
}
