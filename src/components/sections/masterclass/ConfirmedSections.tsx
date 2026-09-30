import {
  AppleLogo,
  GoogleCalendarLogo,
  OutlookLogo,
} from "@/components/sections/masterclass/CalendarLogos";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import {
  SENDER_EMAIL,
  confirmationVideos,
  confirmedCopy,
  liveOnlyBonuses,
  type calendarLinks,
} from "@/lib/content/masterclass";

type Props = {
  first: string | undefined;
  label: string | null;
  startsAt: string | null;
  links: ReturnType<typeof calendarLinks> | null;
};

/** Name, date, live countdown and free add-to-calendar buttons. */
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
      <div className="mx-auto flex max-w-[860px] flex-col items-center px-5 py-14 text-center">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {confirmedCopy.eyebrow}
        </p>
        <h1 className="text-ink mt-4 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] font-black uppercase">
          You&apos;re in
          {first ? (
            <>
              , <Highlight>{first}</Highlight>
            </>
          ) : null}
          .
        </h1>
        {label ? (
          <p className="mt-3 text-lg font-bold text-slate-700">{label}</p>
        ) : null}
        {startsAt ? (
          <div className="mt-8">
            <Countdown startsAt={startsAt} />
          </div>
        ) : null}
        {links ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={links.google}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ className: "gap-2.5" })}
            >
              <span className="grid size-7 place-items-center rounded-md bg-white">
                <GoogleCalendarLogo />
              </span>
              Google Calendar
            </a>
            <a
              href={links.ics}
              download="vendingpreneurs-masterclass.ics"
              className={buttonClass({
                variant: "ghost",
                className: "gap-2.5",
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
                className: "gap-2.5",
              })}
            >
              <OutlookLogo />
              Outlook
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Whitelist the sender, then the live-only reasons to show up. */
export function NextSteps() {
  const [zoom, live] = confirmedCopy.steps;
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-[1080px] gap-6 px-5 py-14 md:grid-cols-2 lg:px-10">
        <Step n={zoom.n} title={zoom.title}>
          It comes from <strong>{SENDER_EMAIL}</strong>. Check spam and
          promotions, and move it to your inbox.
        </Step>
        <Step n={live.n} title={live.title}>
          {live.body}
        </Step>
      </div>
      <ul className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-14 sm:grid-cols-3 lg:px-10">
        {liveOnlyBonuses.map((bonus) => (
          <li
            key={bonus.title}
            className="rounded-card border-ink bg-tint border-2 p-5"
          >
            <p className="text-ink font-black uppercase">{bonus.title}</p>
            <p className="mt-1 text-sm text-slate-600">{bonus.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The member videos from the GHL confirmation page. */
export function MemberVideos() {
  return (
    <section className="border-ink bg-tint border-t-2">
      <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-10">
        <h2 className="text-ink text-center text-[clamp(1.6rem,3.4vw,2.4rem)] font-black uppercase">
          {confirmedCopy.videosHeading}
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {confirmationVideos.map((src) => (
            <video
              key={src}
              src={`${src}#t=2`}
              controls
              playsInline
              preload="metadata"
              data-reveal
              className="rounded-card border-ink shadow-card aspect-video w-full border-2 bg-black"
            />
          ))}
        </div>
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
    <div className="rounded-card border-ink shadow-card border-2 bg-white p-6">
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
        Step {n}
      </p>
      <p className="text-ink mt-2 text-xl font-black uppercase">{title}</p>
      <p className="mt-2 text-[15px] text-slate-600">{children}</p>
    </div>
  );
}
