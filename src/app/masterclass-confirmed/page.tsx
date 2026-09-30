import type { Metadata } from "next";
import { cookies } from "next/headers";
import "../home-v2.css";
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
import { config } from "@/lib/config";
import {
  MASTERCLASS_MINUTES,
  SENDER_EMAIL,
  calendarLinks,
  confirmedCopy,
} from "@/lib/content/masterclass";
import {
  SESSION_COOKIE,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "You're in | Vendingpreneurs Masterclass",
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
  const rawFirst = Array.isArray(params.first) ? params.first[0] : params.first;
  const links = event.startsAt
    ? calendarLinks({
        title: confirmedCopy.calendarTitle,
        details: `Your personal Zoom link is in your confirmation email from ${SENDER_EMAIL}.`,
        start: new Date(event.startsAt),
        minutes: MASTERCLASS_MINUTES,
      })
    : null;

  return (
    <main>
      <RevealObserver />
      <ConfirmedHero
        first={rawFirst?.trim().slice(0, 40)}
        label={event.label}
        startsAt={event.startsAt}
        links={links}
      />
      <NextSteps />
      {hasSession ? <IntakeForm /> : null}
      <PlaybookBand first={rawFirst?.trim().slice(0, 40)} />
      <CoverSection />
      <FeaturedStories stories={stories} />
      <MasterclassFooter />
    </main>
  );
}
