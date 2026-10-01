import {
  AppleLogo,
  GoogleCalendarLogo,
  OutlookLogo,
} from "@/components/sections/masterclass/CalendarLogos";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { LocalTimeLine } from "@/components/sections/masterclass/EventTiming";
import {
  EventDateLine,
  UntilEnded,
} from "@/components/sections/masterclass/EventDateLine";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { StoryList } from "@/components/sections/masterclass/RegistrationSections";
import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { PlaybookTeaser } from "@/components/sections/playbook/PlaybookTeaser";
import type { CaseStudyStory } from "@/lib/services/case-studies";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";
import {
  SENDER_EMAIL,
  ANTHONY_VIDEO_ID,
  COUNTDOWN_LABEL,
  CONFIRMED_VIDEO_EMBED_ID,
  CONFIRMED_VIDEO_POSTER,
  confirmedCopy,
  coverCopy,
  masterclassLiveEnd,
  type calendarLinks,
} from "@/lib/content/masterclass";

type Props = {
  first: string | undefined;
  label: string | null;
  startsAt: string | null;
  links: ReturnType<typeof calendarLinks> | null;
  /** Server render time (ms), so the date line hydrates in the same phase. */
  renderedAt: number;
};

/** Name, Anthony's welcome video, date, live countdown and add-to-calendar buttons. */
export function ConfirmedHero({
  first,
  label,
  startsAt,
  links,
  renderedAt,
}: Props) {
  const endsAt = masterclassLiveEnd(startsAt);
  return (
    <section
      className="border-ink relative isolate border-b-2 bg-[#eaf6ff]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* The same logo bar as the registration hero. */}
      <div className="border-ink relative border-b-2 bg-white">
        <div className="mx-auto flex max-w-[1080px] items-center px-5 py-3 lg:px-10">
          <Wordmark height={44} eager />
        </div>
      </div>
      <div className="mx-auto flex max-w-[940px] flex-col items-center px-5 py-12 text-center lg:pt-8 lg:pb-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.eyebrow}
        </p>
        <h1
          className={cn(
            "v2-display text-ink mt-4 max-w-full min-w-0 leading-[1] uppercase",
            // A long first name (up to 40 characters) steps down so it
            // breaks less often; the name wraps at its spaces and
            // overflow-wrap catches one long word.
            !first || first.length <= 10
              ? "text-[clamp(2.8rem,6vw,4.75rem)]"
              : first.length <= 20
                ? "text-[clamp(2.2rem,5vw,4.75rem)]"
                : "text-[clamp(1.9rem,4.2vw,3.75rem)]",
          )}
        >
          You&apos;re in
          {first ? (
            <>
              ,{" "}
              <Highlight className="max-w-full [overflow-wrap:anywhere] break-words whitespace-normal">
                {first}.
              </Highlight>
            </>
          ) : (
            "."
          )}
        </h1>
        {label ? (
          <p className="text-ink mt-4 text-xl font-black">
            <EventDateLine
              label={label}
              startsAt={startsAt}
              renderedAt={renderedAt}
            />
          </p>
        ) : null}
        {startsAt ? (
          <LocalTimeLine
            startsAt={startsAt}
            className="mt-1 text-[15px] font-semibold text-slate-600"
          />
        ) : null}
        <VidalyticsPlayer
          embedId={CONFIRMED_VIDEO_EMBED_ID}
          title="A welcome from Anthony"
          className="mt-6 w-full max-w-[620px]"
          loadOn="click"
          poster={CONFIRMED_VIDEO_POSTER}
          playLabel="Play Anthony's welcome"
          posterSizes="(min-width: 1024px) 620px, 100vw"
        />
        {/* Live, the date line says so; after that, nothing counts down. */}
        {startsAt && endsAt ? (
          <div className="mt-4">
            <Countdown
              startsAt={startsAt}
              endsAt={endsAt}
              label={COUNTDOWN_LABEL}
            />
          </div>
        ) : null}
        {links ? (
          // A finished session is not worth a calendar slot.
          <UntilEnded startsAt={startsAt} renderedAt={renderedAt}>
            <div className="mt-4 flex w-full flex-col items-center">
              <p className="text-eyebrow mb-3 text-sm font-black tracking-[0.14em] uppercase">
                Add it to your calendar now
              </p>
              <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
                <a
                  data-track="calendar_added"
                  data-track-detail="google"
                  href={links.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({ className: "col-span-2 gap-2.5" })}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-md bg-white"
                  >
                    <GoogleCalendarLogo />
                  </span>
                  Google Calendar
                </a>
                <a
                  data-track="calendar_added"
                  data-track-detail="apple"
                  href={links.ics}
                  className={buttonClass({
                    variant: "ghost",
                    className:
                      "gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
                  })}
                >
                  <AppleLogo />
                  Apple / iCal
                </a>
                <a
                  data-track="calendar_added"
                  data-track-detail="outlook"
                  href={links.outlook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({
                    variant: "ghost",
                    className:
                      "gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
                  })}
                >
                  <OutlookLogo />
                  Outlook
                </a>
              </div>
            </div>
          </UntilEnded>
        ) : null}
      </div>
    </section>
  );
}

/** Whitelist the sender, then reply to Anthony (both from his confirmation email). */
export function NextSteps() {
  const [zoom, reply] = confirmedCopy.steps;
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1080px] px-5 pt-8 pb-14 sm:pt-14 lg:px-10">
        <h2 className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          Before the call
        </h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Step n={zoom.n} title={zoom.title}>
            Your Zoom link is in the email from{" "}
            <strong className="[overflow-wrap:anywhere]">{SENDER_EMAIL}</strong>{" "}
            (check spam and promotions, then move it to your inbox).{" "}
            {confirmedCopy.zoomTextLine}
          </Step>
          <Step n={reply.n} title={reply.title}>
            {reply.body}
          </Step>
        </div>
      </div>
    </section>
  );
}

/** What the call covers, with Anthony's own framing. */
export function CoverSection() {
  return (
    <section className="border-ink bg-tint border-t-2">
      {/* Below md the copy column dissolves (contents) so the photo can sit
          between the topics and the quote. */}
      <div className="mx-auto grid max-w-[1080px] items-center px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-10 lg:px-10">
        <div
          data-reveal
          className="rounded-card border-ink relative order-1 mt-7 aspect-[4/3] overflow-hidden border-2 bg-white md:order-none md:mt-0 md:aspect-square"
        >
          <Image
            src="/images/newsletter/anthony-kolodziej.webp"
            alt={coverCopy.photoAlt}
            fill
            sizes="(min-width: 768px) 460px, 100vw"
            className="object-cover"
          />
        </div>
        <div data-reveal className="contents md:block">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {coverCopy.eyebrow}
          </p>
          <h2 className="v2-display text-ink mt-2 text-[clamp(2.2rem,4vw,3.25rem)] leading-none uppercase">
            {coverCopy.heading}
          </h2>
          <ol className="rounded-card border-ink mt-6 border-2 bg-white">
            {coverCopy.topics.map((topic, index) => (
              <li
                key={topic}
                className="flex items-center gap-4 border-b border-slate-200 p-4 last:border-b-0"
              >
                <span className="border-ink text-ink grid size-9 shrink-0 place-items-center rounded-md border-2 bg-white text-sm font-black tabular-nums">
                  0{index + 1}
                </span>
                <span className="v2-display text-ink text-xl leading-[1.05] uppercase">
                  {topic}
                </span>
              </li>
            ))}
          </ol>
          <blockquote className="order-2 mt-7 text-[17px] text-slate-700 italic md:order-none">
            <span
              aria-hidden
              className="v2-display text-brand-600 block text-5xl leading-[0.6] not-italic"
            >
              &ldquo;
            </span>
            {coverCopy.quote}
            <footer className="text-ink mt-2 text-sm font-black not-italic">
              {coverCopy.signoff}
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

/** Three named member stories, playing in place (same cards as /masterclass). */
export function FeaturedStories({ stories }: { stories: CaseStudyStory[] }) {
  const featured = stories
    .filter(
      (s) => s.youtube_video_id && s.youtube_video_id !== ANTHONY_VIDEO_ID,
    )
    .slice(0, 3);
  if (!featured.length) return null;
  return (
    <section className="border-ink border-t-2 bg-white">
      <div className="mx-auto max-w-[1080px] px-5 py-14 lg:px-10">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.storiesEyebrow}
        </p>
        <h2 className="v2-display text-ink mt-2 text-[clamp(2.2rem,4vw,3.25rem)] leading-none uppercase">
          {confirmedCopy.storiesHeading}
        </h2>
        <StoryList stories={featured} columns={3} statSize="lg" />
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border-ink min-w-0 border-2 bg-white p-6">
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
        Step {n}
      </p>
      <h3 className="v2-display text-ink mt-2 text-2xl leading-none uppercase">
        {title}
      </h3>
      <p className="mt-2 text-[15px] text-slate-600">{children}</p>
    </div>
  );
}

/** The low-ticket offer the GHL emails promote, offered while the visitor is here. */
export function PlaybookBand({
  params,
}: {
  /** Attribution plus the validated first_name (confirmedPlaybookParams). */
  params: Record<string, string | string[] | undefined>;
}) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1080px] px-5 pt-14 pb-16 lg:px-10">
        <PlaybookTeaser searchParams={params} />
      </div>
    </section>
  );
}
