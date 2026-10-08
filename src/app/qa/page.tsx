import type { Metadata } from "next";
import "../home-v2.css";
import { anton } from "../fonts";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import { CountdownBanner } from "@/components/sections/masterclass/CountdownBanner";
import { MasterclassStickyCta } from "@/components/sections/masterclass/MasterclassStickyCta";
import { QaHero } from "@/components/sections/masterclass/QaHero";
import {
  HostBand,
  MasterclassFooter,
} from "@/components/sections/masterclass/RegistrationSections";
import { qaCopy } from "@/lib/content/qa";
import { getQaEvent } from "@/lib/services/masterclass-event";

// Re-read the GHL "Anthony Q&A" date and "Q&A Link" every five minutes, so the
// page follows the weekly rollover without a deploy.
export const revalidate = 300;

const description =
  "Free live Q&A on Zoom with Anthony Kolodziej. Bring your vending questions.";

export const metadata: Metadata = {
  title: "Live Q&A with Anthony",
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Live Q&A with Anthony",
    description,
    url: "/qa",
    images: ["/images/masterclass/anthony-three-machines.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

/** The render's clock reading; see /masterclass. */
function renderTime() {
  return Date.now();
}

export default async function QaPage() {
  const renderedAt = renderTime();
  const event = await getQaEvent(renderedAt);
  return (
    <div className={anton.variable}>
      <RevealObserver />
      <CountdownBanner
        startsAt={event.startsAt}
        renderedAt={renderedAt}
        lead={qaCopy.bannerLead}
        cta={qaCopy.cardHeading}
      />
      <QaHero event={event} renderedAt={renderedAt} />
      <HostBand stats={event.anthony} />
      <MasterclassFooter />
      <MasterclassStickyCta
        startsAt={event.startsAt}
        renderedAt={renderedAt}
        ctaLabel={qaCopy.stickyCta}
        idleText={qaCopy.stickyFallback}
      />
    </div>
  );
}
