import type { Metadata } from "next";
import { ApplyDisclaimer } from "@/components/sections/apply/ApplyDisclaimer";
import { ApplyHero } from "@/components/sections/apply/ApplyHero";
import { RegistrationForm } from "@/components/sections/masterclass/RegistrationForm";
import {
  FitSection,
  HostBand,
  OperatorGrid,
} from "@/components/sections/masterclass/RegistrationSections";
import {
  ATTRIBUTION_KEYS,
  masterclassBody,
  masterclassHero,
} from "@/lib/content/masterclass";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

// Re-read the GHL date and Anthony's numbers every five minutes, so the page
// follows the weekly rollover without a deploy.
export const revalidate = 300;

// Not linked anywhere and kept out of search until it has won a split test.
export const metadata: Metadata = {
  title: "Free Vending Masterclass | Vendingpreneurs",
  description:
    "Free live masterclass: how everyday professionals build a cash-flowing vending route in 2026.",
  robots: { index: false, follow: false },
};

export default async function MasterclassPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [event, params] = await Promise.all([
    getMasterclassEvent(),
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
    <main>
      <ApplyHero
        copy={masterclassHero}
        body={masterclassBody}
        aside={
          <RegistrationForm
            attribution={attribution}
            eventLabel={event.label}
          />
        }
      />
      {event.anthony ? <HostBand stats={event.anthony} /> : null}
      <OperatorGrid />
      <FitSection />
      <ApplyDisclaimer />
    </main>
  );
}
