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
import { CalendarAddRecorder } from "@/components/sections/masterclass/CalendarAddRecorder";
import { config } from "@/lib/config";
import {
  calendarLinks,
  confirmedCopy,
  confirmedPlaybookParams,
  masterclassCalendarEvent,
  personalCalendarLinks,
  safeFirstName,
} from "@/lib/content/masterclass";
import {
  REGISTERED_COOKIE,
  SESSION_COOKIE,
  signCalendarToken,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";
import { inWalletRollout, walletConfig } from "@/lib/wallet/google-wallet";

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
  const sessionContactId = verifyMasterclassSession(
    cookieStore.get(SESSION_COOKIE)?.value,
    config.MASTERCLASS_SESSION_SECRET,
  );
  const hasSession = Boolean(sessionContactId);
  // Same name rule as the form: anything else falls back to the nameless
  // greeting and no name is forwarded to the checkout.
  // A real registration leaves the name in a short-lived cookie (never the
  // URL); team-review and older links still carry ?first=.
  const registeredAs = cookieStore.get(REGISTERED_COOKIE)?.value;
  const first = safeFirstName({ first: registeredAs ?? params.first });
  const renderedAt = renderTime();
  // The same session proves this browser registered the contact, so its
  // calendar buttons may carry that contact's own join link (read by the route).
  const calendarToken =
    sessionContactId && event.startsAt
      ? signCalendarToken(
          sessionContactId,
          new Date(event.startsAt),
          config.MASTERCLASS_CAL_SECRET,
        )
      : null;
  const links = !event.startsAt
    ? null
    : calendarToken
      ? personalCalendarLinks(calendarToken)
      : calendarLinks(masterclassCalendarEvent(new Date(event.startsAt)));

  // Google Wallet pass: rollout share by contact, or ?wallet=1 for the team to test.
  const walletHref =
    calendarToken &&
    sessionContactId &&
    walletConfig(config) &&
    (params.wallet === "1" ||
      inWalletRollout(sessionContactId, config.GOOGLE_WALLET_ROLLOUT_PERCENT))
      ? `/masterclass/wallet/${calendarToken}`
      : null;

  return (
    <div className={anton.variable}>
      <TrackedClicks />
      <StripPiiParams />
      <RegisteredTracker justRegistered={registeredAs !== undefined} />
      {hasSession ? <CalendarAddRecorder /> : null}
      <RevealObserver />
      <ConfirmedHero
        first={first}
        label={event.label}
        startsAt={event.startsAt}
        links={links}
        walletHref={walletHref}
        renderedAt={renderedAt}
        steps={<NextSteps first={first ?? null} startsAt={event.startsAt} />}
      />
      <PlaybookBand params={confirmedPlaybookParams(params)} />
      <ShowUpLive startsAt={event.startsAt} renderedAt={renderedAt} />
      {hasSession ? <IntakeForm /> : null}
      <CoverSection />
      <FeaturedStories stories={stories} />
      <MasterclassFooter />
    </div>
  );
}
