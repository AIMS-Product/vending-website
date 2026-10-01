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
import {
  ATTRIBUTION_KEYS,
  MASTERCLASS_MINUTES,
} from "@/lib/content/masterclass";
import { listCaseStudyStories } from "@/lib/services/case-studies";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

// Re-read the GHL date, Anthony's numbers and the member stories every five
// minutes, so the page follows the weekly rollover without a deploy.
export const revalidate = 300;

// Not linked anywhere and kept out of search until it has won a split test.
const description =
  "Free live masterclass: how everyday professionals build a cash-flowing vending route in 2026.";

export const metadata: Metadata = {
  title: "Free Vending Masterclass",
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Free Vending Masterclass",
    description,
    url: "/masterclass",
    images: ["/images/masterclass/anthony-three-machines.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

/**
 * The GHL date text, or null once the session has ended: the countdown hides
 * itself then, and a past date beside the form would read as stale.
 */
function upcomingLabel(event: {
  label: string | null;
  startsAt: string | null;
}) {
  if (!event.startsAt) return event.label;
  const endsAt = Date.parse(event.startsAt) + MASTERCLASS_MINUTES * 60_000;
  return Date.now() > endsAt ? null : event.label;
}

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
  const label = upcomingLabel(event);

  return (
    <main className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <MasterclassHero
        aside={
          <RegistrationForm
            attribution={attribution}
            eventLabel={label}
            eventStartsAt={event.startsAt}
          />
        }
      />
      <ResultsTicker stories={stories} />
      <HostBand stats={event.anthony} />
      <StoriesGrid stories={stories} />
      <FitSection label={label} startsAt={event.startsAt} />
      <MasterclassFooter />
    </main>
  );
}
