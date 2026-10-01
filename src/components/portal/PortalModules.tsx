import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import { preCallResources } from "@/lib/content/pre-call-resources";
import {
  objectionVideo,
  testimonialFor,
  type NextStep,
  type Persona,
} from "@/lib/portal/personalize";
import { WINS_WALL_URL, type PortalWin } from "@/lib/portal/wins";
import type {
  PortalCallSummary,
  PortalData,
  PortalLocalMarket,
  PortalOnboarding,
  PortalStage,
} from "@/lib/portal/types";
import { PortalIntakeForm } from "./PortalIntakeForm";
import {
  PORTAL_ONBOARDING_DETAIL,
  PORTAL_RESOURCES,
  PORTAL_WINS_COPY,
} from "@/lib/content/portal";

const CARD =
  "rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8]";
const LINK =
  "font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]";

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
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {eyebrow}
      </p>
      <h2
        id={`${id}-heading`}
        className="mt-3 max-w-[24ch] text-[clamp(1.6rem,2.8vw,2.3rem)] leading-[1.06] font-black text-balance text-[#111111] uppercase"
      >
        {title}
      </h2>
      {intro ? (
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed font-semibold text-slate-700">
          {intro}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ---------- Your local opportunity (ZIP → VendScout + research brief) ---------- */

export function LocalModule({ market }: { market: PortalLocalMarket | null }) {
  if (!market) {
    return (
      <Module
        id="local"
        eyebrow="Your local opportunity"
        title="Every metro has a route in it"
        intro="Members run routes in big cities, suburbs and small towns. Once we have your ZIP code, this section turns into a map of ranked spots around you."
      >
        <ul className="flex flex-wrap gap-2">
          {[
            "Dallas",
            "Atlanta",
            "Phoenix",
            "Charlotte",
            "Denver",
            "Tampa",
            "Columbus",
            "Seattle",
          ].map((metro) => (
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
      eyebrow={`Your local opportunity · ${market.zip}`}
      title={`What a route near ${market.city} could look like`}
    >
      <div
        className={`${CARD} grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}
      >
        <div className="border-b-2 border-[#111111] bg-[#f5fbff] p-4 md:border-r-2 md:border-b-0">
          <LocationPlot market={market} />
        </div>
        <ol className="divide-y-2 divide-[#111111]/10">
          {market.locations.map((location) => (
            <li
              key={location.rank}
              className="flex items-center gap-3 px-5 py-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-white">
                {location.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-black text-[#111111]">
                  {location.name}
                </span>
                <span className="block text-sm font-semibold text-slate-600">
                  {location.type} · {location.distanceMi.toFixed(1)} mi
                </span>
              </span>
              {location.trafficScore != null ? (
                <span className="text-right text-xs font-black text-slate-600 uppercase">
                  Traffic
                  <span className="block text-base text-[#111111]">
                    {location.trafficScore}
                  </span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        Ranked by VendScout from public map data and foot-traffic signal. These
        are location types worth a pop-in, not signed spots.
      </p>

      {market.brief.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {market.brief.map((paragraph) => (
            <p
              key={paragraph}
              className="max-w-[64ch] text-[16px] leading-relaxed font-semibold text-slate-700"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {market.first90Days.length > 0 ? (
        <>
          <h3 className="mt-8 text-lg font-black text-[#111111] uppercase">
            What your first 90 days could look like
          </h3>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {market.first90Days.map((phase) => (
              <li key={phase.label} className={`${CARD} p-5`}>
                <p className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
                  {phase.label}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed font-semibold text-slate-700">
                  {phase.detail}
                </p>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </Module>
  );
}

/**
 * A plain radial plot of the ranked spots around the ZIP centroid: honest
 * distance and bearing, no basemap. Swap for a real VendScout render (image or
 * embed) when SteelTrap can supply one.
 */
function LocationPlot({ market }: { market: PortalLocalMarket }) {
  const { center } = market;
  const milesPerLng = 69 * Math.cos((center.lat * Math.PI) / 180);
  const points = market.locations
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({
      rank: l.rank,
      x: (l.lng! - center.lng) * milesPerLng,
      y: (l.lat! - center.lat) * 69,
    }));
  const reach = Math.max(1, ...points.map((p) => Math.hypot(p.x, p.y))) * 1.15;
  const size = 300;
  const half = size / 2;
  const scale = (half - 18) / reach;
  const rings = [1 / 3, 2 / 3, 1].map((f) => ({
    r: (half - 18) * f,
    miles: reach * f,
  }));

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Map of ${points.length} ranked locations around ZIP ${market.zip}`}
      className="mx-auto block w-full max-w-[340px]"
    >
      {rings.map((ring) => (
        <g key={ring.r}>
          <circle
            cx={half}
            cy={half}
            r={ring.r}
            fill="none"
            stroke="#2a8fcc"
            strokeOpacity={0.35}
            strokeDasharray="4 5"
            strokeWidth={1.5}
          />
          <text
            x={half + 4}
            y={half - ring.r + 12}
            fontSize="10"
            fontWeight="800"
            fill="#066a99"
          >
            {ring.miles.toFixed(1)} mi
          </text>
        </g>
      ))}
      <circle cx={half} cy={half} r={9} fill="#111111" />
      <text
        x={half}
        y={half + 24}
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="#111111"
      >
        YOU
      </text>
      {points.map((p) => (
        <g
          key={p.rank}
          transform={`translate(${half + p.x * scale} ${half - p.y * scale})`}
        >
          <circle r={12} fill="#2a8fcc" stroke="#111111" strokeWidth={2} />
          <text
            y={4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            fill="#ffffff"
          >
            {p.rank}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- People like you (persona → case study + testimonial) ---------- */

export function PeopleModule({ persona }: { persona: Persona }) {
  const { caseStudy } = persona;
  const embed = caseStudy.videoId
    ? getVideoEmbed(`https://youtu.be/${caseStudy.videoId}`)
    : null;
  const testimonial = testimonialFor(persona);

  return (
    <Module
      id="people"
      eyebrow={`People like you · ${persona.label}`}
      title={caseStudy.title}
      intro={caseStudy.excerpt}
    >
      {embed ? (
        <div className="overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[8px_8px_0_#111111]">
          <YouTubeEmbedFrame
            embed={embed}
            title={`${caseStudy.name}: ${caseStudy.title}`}
            className="aspect-video w-full"
          />
        </div>
      ) : null}
      <ul className="mt-6 flex flex-wrap gap-3">
        {caseStudy.stats.map((stat) => (
          <li key={stat.label} className={`${CARD} px-4 py-3`}>
            <span className="block text-xl font-black text-[#111111]">
              {stat.value}
            </span>
            <span className="block text-xs font-black tracking-[0.08em] text-slate-600 uppercase">
              {stat.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-semibold text-slate-600">
        {caseStudy.name}&rsquo;s own numbers, in their words. Results depend on
        locations, machines and the work behind them.{" "}
        <Link href={`/case-studies/${caseStudy.slug}`} className={LINK}>
          Read the full story
        </Link>
      </p>

      {testimonial ? (
        <figure className={`${CARD} mt-8 p-6`}>
          <blockquote className="line-clamp-6 text-[16px] leading-relaxed font-semibold text-slate-700">
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
            <span>
              <span className="block text-sm font-black text-[#111111]">
                {testimonial.name}
              </span>
              <span className="block text-sm font-semibold text-slate-600">
                {testimonial.role}
              </span>
            </span>
          </figcaption>
        </figure>
      ) : null}
    </Module>
  );
}

/* ---------- Community wins (live feed, stage-filtered) ---------- */

export function WinsModule({
  wins,
  stage,
}: {
  wins: PortalWin[];
  stage: PortalStage;
}) {
  const copy = PORTAL_WINS_COPY[stage];
  return (
    <Module
      id="wins"
      eyebrow="Community wins"
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
                    {win.postedAt ? ` · ${formatWinDate(win.postedAt)}` : ""}
                  </span>
                </span>
              </div>
              <p className="mt-3 line-clamp-5 text-[15px] leading-relaxed font-semibold text-slate-700">
                {win.excerpt}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-5">
        <a
          href={WINS_WALL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          See every win on the community wall
        </a>
      </p>
    </Module>
  );
}

function formatWinDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
}

/* ---------- What to expect (triage FAQ, marketing's own answers) ---------- */

export function FaqModule({ persona }: { persona: Persona }) {
  const picked = objectionVideo(persona.objectionId);
  const others = preCallResources.items.filter((item) => item.id !== picked.id);
  return (
    <Module
      id="faq"
      eyebrow="What to expect"
      title="The questions everyone asks first"
      intro="Short answers from Mike. Watch the one we picked for you; the rest are here if you want them. Bring anything else to the call."
    >
      <div className={`${CARD} p-5`}>
        <h3 className="text-lg font-black text-[#111111]">{picked.question}</h3>
        <p className="mt-2 text-[15px] leading-relaxed font-semibold text-slate-700">
          {picked.answer}
        </p>
        <VidalyticsPlayer
          embedId={picked.embedId}
          loadOn="click"
          title={picked.question}
          className="mt-4"
        />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {others.map((item) => (
          <details key={item.id} className={`${CARD} group p-5`}>
            <summary className="cursor-pointer list-none text-[16px] font-black text-[#111111] marker:hidden">
              {item.question}
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed font-semibold text-slate-700">
              {item.answer}
            </p>
            <VidalyticsPlayer
              embedId={item.embedId}
              loadOn="click"
              title={item.question}
              className="mt-4"
            />
          </details>
        ))}
      </div>
    </Module>
  );
}

/* ---------- Your call summary (Avoma → Claude, customer-facing) ---------- */

export function SummaryModule({
  summary,
  persona,
  repName,
}: {
  summary: PortalCallSummary;
  persona: Persona;
  repName?: string;
}) {
  const answer = objectionVideo(summary.mainQuestionId ?? persona.objectionId);
  return (
    <Module
      id="summary"
      eyebrow="Your call summary"
      title="What we covered together"
      intro={
        repName
          ? `Written up from your call with ${repName}. The important parts are highlighted.`
          : undefined
      }
    >
      {summary.recordingUrl ? (
        <a
          href={summary.recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex min-h-12 items-center rounded-[10px] border-2 border-[#111111] bg-[#1f72a5] px-6 text-sm font-black text-white uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5"
        >
          Re-listen to your call
        </a>
      ) : null}

      {summary.highlights.length ? (
        <ul className="mb-8 grid gap-4">
          {summary.highlights.map((h) => (
            <li
              key={h.quote}
              className="rounded-[10px] border-2 border-[#111111] bg-[#eaf6ff] p-5 shadow-[7px_7px_0_#111111]"
            >
              <p className="text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
                Worth re-reading{h.timestamp ? ` · ${h.timestamp}` : ""}
              </p>
              <p className="mt-2 text-lg leading-snug font-black text-[#111111]">
                &ldquo;{h.quote}&rdquo;
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {h.why}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <SummaryList title="What we discussed" items={summary.discussed} />
        <SummaryList title="What we recommended" items={summary.recommended} />
      </div>

      {summary.yourQuestions.length ? (
        <>
          <h3 className="mt-8 text-lg font-black text-[#111111] uppercase">
            What you asked
          </h3>
          <dl className="mt-4 flex flex-col gap-4">
            {summary.yourQuestions.map((qa) => (
              <div key={qa.question} className={`${CARD} p-5`}>
                <dt className="text-[16px] font-black text-[#111111]">
                  {qa.question}
                </dt>
                <dd className="mt-2 text-[15px] leading-relaxed font-semibold text-slate-700">
                  {qa.answer}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <div id="main-question" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-black text-[#111111] uppercase">
          The video that answers your main question
        </h3>
        <p className="mt-2 text-[15px] font-semibold text-slate-700">
          {answer.question}
        </p>
        <VidalyticsPlayer
          embedId={answer.embedId}
          loadOn="click"
          title={answer.question}
          className="mt-4"
        />
      </div>
    </Module>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={`${CARD} p-5`}>
      <h3 className="text-sm font-black tracking-[0.1em] text-[#066a99] uppercase">
        {title}
      </h3>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed font-semibold text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Onboarding (won) ---------- */

export function OnboardingModule({
  onboarding,
  steps,
}: {
  onboarding: PortalOnboarding | null;
  steps: NextStep[];
}) {
  return (
    <Module
      id="onboarding"
      eyebrow="Your onboarding plan"
      title="Four steps to your first location search"
    >
      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`${CARD} flex items-start gap-4 p-5 ${step.done ? "opacity-70" : ""}`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-black text-[#111111]">
                {step.label}
                {step.done ? (
                  <span className="ml-2 text-xs tracking-[0.1em] text-[#14532d] uppercase">
                    Done
                  </span>
                ) : null}
              </h3>
              <p className="mt-1 text-[15px] font-semibold text-slate-700">
                {PORTAL_ONBOARDING_DETAIL[step.id]}
              </p>
            </div>
            {!step.done ? (
              <a
                href={step.href}
                target={step.external ? "_blank" : undefined}
                rel={step.external ? "noopener noreferrer" : undefined}
                className={`${LINK} shrink-0 text-sm`}
              >
                Start
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      {onboarding?.machineSourcingUrl ? (
        <p className="mt-5">
          <a
            href={onboarding.machineSourcingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            Machine sourcing and member discounts
          </a>
        </p>
      ) : null}
    </Module>
  );
}

/* ---------- Collateral and resources (always) ---------- */

export function ResourcesModule({ stage }: { stage: PortalStage }) {
  return (
    <Module
      id="resources"
      eyebrow="Collateral and resources"
      title="Keep these handy"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {PORTAL_RESOURCES[stage].map((item) => {
          const external = item.href.startsWith("http");
          return (
            <li key={item.label}>
              <a
                href={item.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={`${CARD} block h-full p-5 transition hover:-translate-y-0.5`}
              >
                <span className="block text-[16px] font-black text-[#111111]">
                  {item.label}
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-600">
                  {item.detail}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Module>
  );
}

/* ---------- Locked-and-teased placeholder (PRD §6.2) ---------- */

export function LockedModule({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note: string;
}) {
  return (
    <section
      id={id}
      aria-label={`${title} (locked)`}
      className="scroll-mt-20 rounded-[10px] border-2 border-dashed border-[#111111]/50 bg-[#f5fbff] p-6"
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

/* ---------- Intake (fills occupation / ZIP / goal when missing) ---------- */

export function IntakeModule({
  token,
  prospect,
}: {
  token: string;
  prospect: PortalData["prospect"];
}) {
  return (
    <section
      id="intake"
      aria-labelledby="intake-heading"
      className={`${CARD} scroll-mt-20 p-6`}
    >
      <h2
        id="intake-heading"
        className="text-xl font-black text-[#111111] uppercase"
      >
        Three quick questions so we can tailor this page
      </h2>
      <p className="mt-2 text-[15px] font-semibold text-slate-700">
        Takes 20 seconds. Your ZIP turns on your local map; your job and goal
        pick the stories and videos.
      </p>
      <PortalIntakeForm token={token} defaults={prospect} />
    </section>
  );
}
