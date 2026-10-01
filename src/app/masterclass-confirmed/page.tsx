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
import { IntakeForm } from "@/components/sections/masterclass/IntakeForm";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { config } from "@/lib/config";
import {
  calendarLinks,
  confirmedPlaybookParams,
  masterclassCalendarEvent,
  safeFirstName,
} from "@/lib/content/masterclass";
import {
  SESSION_COOKIE,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "You're in: Masterclass",
  robots: { index: false, follow: false },
};

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
  const first = safeFirstName(params);
  const links = event.startsAt
    ? calendarLinks(masterclassCalendarEvent(new Date(event.startsAt)))
    : null;

  return (
    <main className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <ConfirmedHero
        first={first}
        label={event.label}
        startsAt={event.startsAt}
        links={links}
      />
      <NextSteps />
      {hasSession ? <IntakeForm /> : null}
      <PlaybookBand params={confirmedPlaybookParams(params)} />
      <CoverSection />
      <FeaturedStories stories={stories} />
      <MasterclassFooter />
    </main>
  );
}
