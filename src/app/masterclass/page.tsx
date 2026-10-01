import type { Metadata } from "next";
import "../home-v2.css";
import { anton } from "../fonts";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import { MasterclassHero } from "@/components/sections/masterclass/MasterclassHero";
import { RegistrationForm } from "@/components/sections/masterclass/RegistrationForm";
import {
  FitSection,
  HostBand,
  MasterclassFooter,
  ResultsTicker,
  StoriesGrid,
} from "@/components/sections/masterclass/RegistrationSections";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { ATTRIBUTION_KEYS } from "@/lib/content/masterclass";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

// Re-read the GHL date, Anthony's numbers and the member stories every five
// minutes, so the page follows the weekly rollover without a deploy.
export const revalidate = 300;

// Not linked anywhere and kept out of search until it has won a split test.
export const metadata: Metadata = {
  title: "Free Vending Masterclass",
  description:
    "Free live masterclass: how everyday professionals build a cash-flowing vending route in 2026.",
  robots: { index: false, follow: false },
};

export default async function MasterclassPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [event, stories, params] = await Promise.all([
    getMasterclassEvent(),
    listCaseStudyStories(),
    searchParams,
  ]);
  const attribution = Object.fromEntries(
    ATTRIBUTION_KEYS.flatMap((key) => {
      const value = params[key];
      const text = Array.isArray(value) ? value[0] : value;
      return text ? [[key, text.slice(0, 200)]] : [];
    }),
  );

  return (
    <main className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <MasterclassHero
        aside={
          <RegistrationForm
            attribution={attribution}
            eventLabel={event.label}
          />
        }
      />
      <ResultsTicker stories={stories} />
      <HostBand stats={event.anthony} />
      <StoriesGrid stories={stories} />
      <FitSection label={event.label} startsAt={event.startsAt} />
      <MasterclassFooter />
    </main>
  );
}
