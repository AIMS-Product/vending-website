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
import { GuideTeaser } from "@/components/sections/playbook-guide/GuideTeaser";
import { isGuideSwapLive } from "@/lib/ltf/assignment";
import type { CaseStudyStory } from "@/lib/services/case-studies";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";
import {
  SENDER_EMAIL,
  SEAT_TEXT_DISPLAY,
  seatTextBody,
  seatTextHref,
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
  /** /masterclass/wallet/<token> for a registrant in the wallet rollout, else null. */
  walletHref?: string | null;
  /** /masterclass/wallet/<token>/apple when Apple Wallet is configured, else null. */
  appleWalletHref?: string | null;
  /** From the user agent: a phone sees only its own wallet's badge. */
  platform?: "ios" | "android" | "other";
  /** Server render time (ms), so the date line hydrates in the same phase. */
  renderedAt: number;
};

/** Name, Anthony's welcome video, date, live countdown and add-to-calendar buttons. */
export function ConfirmedHero({
  first,
  label,
  startsAt,
  links,
  walletHref = null,
  appleWalletHref = null,
  platform = "other",
  renderedAt,
  steps,
}: Props & { steps?: React.ReactNode }) {
  const endsAt = masterclassLiveEnd(startsAt);
  return (
    <section
      id="welcome"
      className="border-ink relative isolate scroll-mt-4 border-b-2 bg-[#eaf6ff]"
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
      <div className="mx-auto flex max-w-[940px] flex-col items-center px-5 pt-5 pb-12 text-center lg:pb-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.eyebrow}
        </p>
        <h1
          className={cn(
            "v2-display text-ink mt-2 max-w-full min-w-0 leading-[1] uppercase",
            // A long first name (up to 40 characters) steps down so it
            // breaks less often; the name wraps at its spaces and
            // overflow-wrap catches one long word.
            !first || first.length <= 10
              ? "text-[clamp(2.2rem,4.4vw,3.4rem)]"
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
          <p className="text-ink mt-2 text-lg font-black">
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
        {links ? (
          // A finished session is not worth a calendar slot.
          <UntilEnded startsAt={startsAt} renderedAt={renderedAt}>
            <div className="border-ink mt-5 flex w-full max-w-[560px] flex-col items-center rounded-2xl border-2 bg-white px-4 pt-5 pb-5 shadow-[4px_4px_0_0_#0f172a] sm:px-6">
              <p className="v2-display text-ink text-[1.6rem] leading-none uppercase">
                Save your seat
              </p>
              <p className="mt-1.5 mb-4 text-[15px] text-slate-600">
                Your ticket and your Join link, in one tap.
              </p>
              {walletHref || appleWalletHref ? (
                // Apple's and Google's own badges, unmodified (brand rules).
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                  {appleWalletHref && platform !== "android" ? (
                    <a
                      data-track="wallet_added"
                      data-track-detail="apple"
                      href={appleWalletHref}
                      className="ph-no-capture inline-block p-2"
                    >
                      <Image
                        unoptimized
                        src="/images/wallet/add-to-apple-wallet.svg"
                        alt="Add to Apple Wallet"
                        width={110}
                        height={35}
                        className="h-14 w-auto"
                      />
                    </a>
                  ) : null}
                  {walletHref && platform !== "ios" ? (
                    <a
                      data-track="wallet_added"
                      data-track-detail="google"
                      href={walletHref}
                      className="ph-no-capture inline-block p-2"
                    >
                      <Image
                        unoptimized
                        src="/images/wallet/add-to-google-wallet.svg"
                        alt="Add to Google Wallet"
                        width={199}
                        height={55}
                        className="h-14 w-auto"
                      />
                    </a>
                  ) : null}
                </div>
              ) : null}
              {/* ph-no-capture: an href can carry a personal calendar token. */}
              <div className="grid w-full grid-cols-2 gap-3">
                <a
                  data-track="calendar_added"
                  data-track-detail="google"
                  href={links.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({
                    className: "ph-no-capture col-span-2 gap-2.5",
                  })}
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
                      "ph-no-capture gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
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
                      "ph-no-capture gap-2 px-3 whitespace-nowrap sm:gap-2.5 sm:px-6",
                  })}
                >
                  <OutlookLogo />
                  Outlook
                </a>
              </div>
            </div>
          </UntilEnded>
        ) : null}
        {/* Live, the date line says so; after that, nothing counts down. */}
        {startsAt && endsAt ? (
          <div className="mt-8">
            <Countdown
              startsAt={startsAt}
              endsAt={endsAt}
              label={COUNTDOWN_LABEL}
            />
          </div>
        ) : null}
        <VidalyticsPlayer
          embedId={CONFIRMED_VIDEO_EMBED_ID}
          title="A welcome from Anthony"
          className="mt-8 w-full max-w-[480px]"
          loadOn="click"
          poster={CONFIRMED_VIDEO_POSTER}
          playLabel="Play Anthony's welcome"
          posterSizes="(min-width: 1024px) 480px, 100vw"
        />
        {steps}
      </div>
    </section>
  );
}

const MAIL_SEARCH = encodeURIComponent(SENDER_EMAIL);
/** Inbox links that open already searching for Anthony's email (spam included where the mail app allows it). */
const MAIL_APPS = [
  {
    app: "gmail",
    label: "Open Gmail",
    href: `https://mail.google.com/mail/u/0/#search/in%3Aanywhere+from%3A${MAIL_SEARCH}`,
  },
  {
    app: "outlook",
    label: "Outlook",
    href: `https://outlook.live.com/mail/0/search/q/${MAIL_SEARCH}`,
  },
  {
    app: "yahoo",
    label: "Yahoo",
    href: `https://mail.yahoo.com/d/search/keyword=${MAIL_SEARCH}`,
  },
] as const;

function NumberedStep({
  n,
  title,
  children,
  action,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li className="border-ink rounded-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-2 bg-white px-4 py-3 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5">
      <span
        aria-hidden="true"
        className="v2-display text-brand-600 w-9 text-center text-5xl leading-none"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="v2-display text-ink text-xl leading-tight uppercase">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <div className="text-[14px] leading-snug text-slate-600">
          {children}
        </div>
      </div>
      {action ? <div className="col-span-2 sm:col-span-1">{action}</div> : null}
    </li>
  );
}

/** Steps 1 to 3, stacked under Anthony's video so they sit above the fold. */
export function NextSteps({
  first,
  startsAt,
  showEmail = true,
}: {
  first: string | null;
  startsAt: string | null;
  /** The Zoom-email step: only for a browser without its personal Join links. */
  showEmail?: boolean;
}) {
  const [, text, email] = confirmedCopy.steps;
  const [gmail, ...otherMail] = MAIL_APPS;
  return (
    <ol className="mt-4 grid w-full max-w-[680px] gap-2.5">
      <NumberedStep
        n="1"
        title={text.title}
        action={
          <a
            href={seatTextHref(seatTextBody(first, startsAt))}
            data-track="seat_text_clicked"
            className={buttonClass({
              className: "flex w-full whitespace-nowrap sm:w-auto",
            })}
          >
            Text Anthony
          </a>
        }
      >
        {text.body}{" "}
        <span className="text-slate-500">
          On a computer? Text SEAT to{" "}
          <span className="whitespace-nowrap">{SEAT_TEXT_DISPLAY}</span>.
        </span>
      </NumberedStep>
      {showEmail ? (
        <NumberedStep
          n="2"
          title={email.title}
          action={
            <div className="flex flex-col items-stretch gap-1 text-center sm:items-center">
              <a
                href={gmail.href}
                target="_blank"
                rel="noopener noreferrer"
                data-track="email_search_clicked"
                data-track-detail={gmail.app}
                className={buttonClass({
                  className: "flex w-full whitespace-nowrap sm:w-auto",
                })}
              >
                {gmail.label}
              </a>
              <span className="text-[13px] text-slate-500">
                or{" "}
                {otherMail.map((m, i) => (
                  <span key={m.app}>
                    {i > 0 ? " · " : null}
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-track="email_search_clicked"
                      data-track-detail={m.app}
                      className="text-brand-700 font-bold underline underline-offset-2"
                    >
                      {m.label}
                    </a>
                  </span>
                ))}
              </span>
            </div>
          }
        >
          From{" "}
          <strong className="[overflow-wrap:anywhere]">{SENDER_EMAIL}</strong>.
          Not there? Check spam and promotions, then move it to your inbox.
        </NumberedStep>
      ) : null}
    </ol>
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

/** The low-ticket offer the GHL emails promote, offered while the visitor is here. */
export function PlaybookBand({
  params,
  step,
}: {
  /** Attribution plus the validated first_name (confirmedPlaybookParams). */
  params: Record<string, string | string[] | undefined>;
  /** Its number, after the steps above it. */
  step: number;
}) {
  return (
    <section id="playbook" className="scroll-mt-6 bg-white">
      <div className="mx-auto max-w-[1080px] px-5 pt-14 pb-16 lg:px-10">
        <div className="mb-5 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="v2-display text-brand-600 text-6xl leading-none"
          >
            {step}
          </span>
          <h2 className="v2-display text-ink text-2xl leading-tight uppercase sm:text-3xl">
            <span className="sr-only">Step {step}: </span>
            Optional VIP upgrade
          </h2>
        </div>
        {isGuideSwapLive() ? (
          <GuideTeaser searchParams={params} />
        ) : (
          <PlaybookTeaser searchParams={params} />
        )}
      </div>
    </section>
  );
}
