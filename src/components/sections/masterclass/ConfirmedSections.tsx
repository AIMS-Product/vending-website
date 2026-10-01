import {
  AppleLogo,
  GoogleCalendarLogo,
  OutlookLogo,
} from "@/components/sections/masterclass/CalendarLogos";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { EventLabel } from "@/components/sections/masterclass/EventLabel";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { StoryList } from "@/components/sections/masterclass/RegistrationSections";
import Image from "next/image";
import { PlaybookTeaser } from "@/components/sections/playbook/PlaybookTeaser";
import type { CaseStudyStory } from "@/lib/services/case-studies";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";
import {
  SENDER_EMAIL,
  ANTHONY_VIDEO_ID,
  CONFIRMED_VIDEO_EMBED_ID,
  CONFIRMED_VIDEO_POSTER,
  confirmedCopy,
  coverCopy,
  MASTERCLASS_MINUTES,
  type calendarLinks,
} from "@/lib/content/masterclass";

type Props = {
  first: string | undefined;
  label: string | null;
  startsAt: string | null;
  links: ReturnType<typeof calendarLinks> | null;
};

/** Name, Anthony's welcome video, date, live countdown and add-to-calendar buttons. */
export function ConfirmedHero({ first, label, startsAt, links }: Props) {
  return (
    <section
      className="border-ink relative isolate border-b-2 bg-[#eaf6ff]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="mx-auto flex max-w-[940px] flex-col items-center px-5 py-12 text-center lg:pt-10 lg:pb-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.eyebrow}
        </p>
        <h1
          className={cn(
            "v2-display text-ink mt-4 max-w-full min-w-0 leading-[1] uppercase",
            // A long first name (up to 20 letters) steps down so it breaks
            // less often; overflow-wrap catches the rest.
            first && first.length > 10
              ? "text-[clamp(2.2rem,5vw,4.75rem)]"
              : "text-[clamp(2.8rem,6vw,4.75rem)]",
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
            <EventLabel label={label} startsAt={startsAt} />
          </p>
        ) : null}
        <VidalyticsPlayer
          embedId={CONFIRMED_VIDEO_EMBED_ID}
          title="A welcome from Anthony"
          className="mt-6 w-full max-w-[780px]"
          loadOn="click"
          poster={CONFIRMED_VIDEO_POSTER}
          playLabel="Play Anthony's welcome"
          posterSizes="(min-width: 1024px) 780px, 100vw"
        />
        {startsAt ? (
          <div className="mt-6">
            <Countdown
              startsAt={startsAt}
              endsAt={new Date(
                Date.parse(startsAt) + MASTERCLASS_MINUTES * 60_000,
              ).toISOString()}
              expiredLabel="We are live now"
            />
          </div>
        ) : null}
        {links ? (
          <div className="mt-5 flex w-full flex-col items-center">
            <p className="text-eyebrow mb-3 text-sm font-black tracking-[0.14em] uppercase">
              Add it to your calendar now
            </p>
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
              <a
                href={links.google}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ className: "col-span-2 gap-2.5" })}
              >
                <span className="grid size-7 place-items-center rounded-md bg-white">
                  <GoogleCalendarLogo />
                </span>
                Google Calendar
              </a>
              <a
                href={links.ics}
                className={buttonClass({
                  variant: "ghost",
                  className: "gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
                })}
              >
                <AppleLogo />
                Apple / iCal
              </a>
              <a
                href={links.outlook}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({
                  variant: "ghost",
                  className: "gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
                })}
              >
                <OutlookLogo />
                Outlook
              </a>
            </div>
          </div>
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
      <div className="mx-auto grid max-w-[1080px] gap-6 px-5 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-10">
        <Step n={zoom.n} title={zoom.title}>
          It comes from{" "}
          <strong className="[overflow-wrap:anywhere]">{SENDER_EMAIL}</strong>.
          Check spam and promotions, and move it to your inbox.
        </Step>
        <Step n={reply.n} title={reply.title}>
          {reply.body}
        </Step>
      </div>
    </section>
  );
}

/** What the call covers, with Anthony's own framing. */
export function CoverSection() {
  return (
    <section className="border-ink bg-tint border-t-2">
      <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div
          data-reveal
          className="rounded-card border-ink shadow-card relative order-last aspect-[4/3] overflow-hidden border-2 bg-white md:order-none md:aspect-square"
        >
          <Image
            src="/images/newsletter/anthony-kolodziej.webp"
            alt={coverCopy.photoAlt}
            fill
            sizes="(min-width: 768px) 460px, 100vw"
            className="object-cover"
          />
        </div>
        <div data-reveal>
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {coverCopy.eyebrow}
          </p>
          <h2 className="v2-display text-ink mt-2 text-[clamp(2.2rem,4vw,3.25rem)] leading-none uppercase">
            {coverCopy.heading}
          </h2>
          <ol className="mt-6 grid gap-3">
            {coverCopy.topics.map((topic, index) => (
              <li
                key={topic}
                className="rounded-card border-ink flex items-center gap-4 border-2 bg-white p-4"
              >
                <span className="bg-brand-700 grid size-10 shrink-0 place-items-center rounded-md text-sm font-black text-white">
                  0{index + 1}
                </span>
                <span className="text-ink text-[17px] font-bold">{topic}</span>
              </li>
            ))}
          </ol>
          <blockquote className="mt-7 text-[17px] text-slate-700 italic">
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
      <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-10">
        <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.storiesEyebrow}
        </p>
        <h2 className="v2-display text-ink mt-2 text-center text-[clamp(2.2rem,4vw,3.25rem)] leading-none uppercase">
          {confirmedCopy.storiesHeading}
        </h2>
        <StoryList stories={featured} columns={3} />
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
    <div className="rounded-card border-ink shadow-card min-w-0 border-2 bg-white p-6">
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
