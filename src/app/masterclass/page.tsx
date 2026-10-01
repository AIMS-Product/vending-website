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
 * The render's clock reading. A server component renders once per request (or
 * per ISR regeneration), so reading the clock is the point, not a side effect.
 */
function renderTime() {
  return Date.now();
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
  // The date lines swap to "Live now" or "Next session date coming soon" on
  // the visitor's clock; this pins their first render to the server's.
  const renderedAt = renderTime();

  return (
    <div className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <MasterclassHero
        aside={
          <RegistrationForm
            attribution={attribution}
            eventLabel={event.label}
            eventStartsAt={event.startsAt}
            renderedAt={renderedAt}
          />
        }
      />
      <ResultsTicker stories={stories} />
      <HostBand stats={event.anthony} />
      <StoriesGrid stories={stories} />
      <FitSection
        label={event.label}
        startsAt={event.startsAt}
        renderedAt={renderedAt}
      />
      <MasterclassFooter />
    </div>
  );
}
