import { TrackedClicks } from "@/components/tracking/TrackedClicks";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import "../home-v2.css";
import { anton } from "../fonts";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
import {
  ConfirmedHero,
  CoverSection,
  FeaturedStories,
  NextSteps,
  PlaybookBand,
} from "@/components/sections/masterclass/ConfirmedSections";
import { ShowUpLive } from "@/components/sections/masterclass/ShowUpLive";
import { IntakeForm } from "@/components/sections/masterclass/IntakeForm";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { RegisteredTracker } from "@/components/sections/masterclass/RegisteredTracker";
import { config } from "@/lib/config";
import {
  calendarLinks,
  confirmedCopy,
  confirmedPlaybookParams,
  masterclassCalendarEvent,
  safeFirstName,
} from "@/lib/content/masterclass";
import {
  REGISTERED_COOKIE,
  SESSION_COOKIE,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

export const revalidate = 300;

const description = confirmedCopy.metaDescription;

export const metadata: Metadata = {
  title: "You're in: Masterclass",
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're in: Masterclass",
    description,
    url: "/masterclass-confirmed",
    images: ["/images/masterclass/anthony-three-machines.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

/**
 * The render's clock reading. A server component renders once per request (or
 * per ISR regeneration), so reading the clock is the point, not a side effect.
 */
function renderTime() {
  return Date.now();
}

export default async function MasterclassConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [event, params, stories, cookieStore] = await Promise.all([
    getMasterclassEvent(),
    searchParams,
    listCaseStudyStories(),
    cookies(),
  ]);
  // The intake form writes to the contact the signed cookie names, so it only
  // shows for a browser that just registered (and only with the secret set).
  const hasSession = Boolean(
    verifyMasterclassSession(
      cookieStore.get(SESSION_COOKIE)?.value,
      config.MASTERCLASS_SESSION_SECRET,
    ),
  );
  // Same name rule as the form: anything else falls back to the nameless
  // greeting and no name is forwarded to the checkout.
  // A real registration leaves the name in a short-lived cookie (never the
  // URL); team-review and older links still carry ?first=.
  const registeredAs = cookieStore.get(REGISTERED_COOKIE)?.value;
  const first = safeFirstName({ first: registeredAs ?? params.first });
  const renderedAt = renderTime();
  const links = event.startsAt
    ? calendarLinks(masterclassCalendarEvent(new Date(event.startsAt)))
    : null;

  return (
    <div className={anton.variable}>
      <TrackedClicks />
      <StripPiiParams />
      <RegisteredTracker justRegistered={registeredAs !== undefined} />
      <RevealObserver />
      <ConfirmedHero
        first={first}
        label={event.label}
        startsAt={event.startsAt}
        links={links}
        renderedAt={renderedAt}
      />
      <NextSteps />
      <ShowUpLive startsAt={event.startsAt} renderedAt={renderedAt} />
      {hasSession ? <IntakeForm /> : null}
      <PlaybookBand params={confirmedPlaybookParams(params)} />
      <CoverSection />
      <FeaturedStories stories={stories} />
      <MasterclassFooter />
    </div>
  );
}
