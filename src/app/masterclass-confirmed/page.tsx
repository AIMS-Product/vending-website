import type { Metadata } from "next";
import "../home-v2.css";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
import {
  ConfirmedHero,
  MemberVideos,
  NextSteps,
} from "@/components/sections/masterclass/ConfirmedSections";
import {
  MASTERCLASS_MINUTES,
  SENDER_EMAIL,
  calendarLinks,
  confirmedCopy,
} from "@/lib/content/masterclass";
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
  const [event, params] = await Promise.all([
    getMasterclassEvent(),
    searchParams,
  ]);
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
      <MemberVideos />
      <MasterclassFooter />
    </main>
  );
}
