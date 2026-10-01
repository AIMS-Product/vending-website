import "server-only";

import type { Metadata } from "next";
import "@/app/home-v2.css";
import { anton } from "@/app/fonts";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
import {
  ReplayBooking,
  ReplayHero,
  ReplayTestimonials,
} from "@/components/sections/masterclass-replay/ReplaySections";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import replayHostStill from "@/components/sections/masterclass-replay/replay-host-still.jpg";
import {
  replayCountdownLive,
  replayDescription,
  replayExpiry,
  replayVariants,
  type ReplayVariantKey,
} from "@/lib/content/masterclass-replay";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

/**
 * Replay pages are sent by email, SMS, and ads; never indexed. Each variant
 * still carries its own title, description and share card (the hero's host
 * still), so a link pasted into a text or DM previews as this replay rather
 * than the homepage.
 */
export function replayMetadata(key: ReplayVariantKey): Metadata {
  const variant = replayVariants[key];
  const title = `${variant.metaTitle} | Vendingpreneurs`;
  const description = replayDescription(variant);
  const image = {
    url: replayHostStill.src,
    width: replayHostStill.width,
    height: replayHostStill.height,
    alt: "Host of the Vendingpreneurs masterclass replay",
  };
  return {
    title: variant.metaTitle,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: variant.path,
      siteName: "Vendingpreneurs",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export async function renderReplayPage(
  key: ReplayVariantKey,
  searchParams: Promise<LeadSearchParams>,
) {
  const variant = replayVariants[key];
  const [event, params] = await Promise.all([
    getMasterclassEvent(),
    searchParams,
  ]);
  const attribution = buildLeadAttribution(params, variant.path);
  return (
    <main className={anton.variable}>
      <StripPiiParams />
      <ReplayHero variant={variant} expiresAt={liveExpiry(event.startsAt)} />
      <ReplayBooking variant={variant} attribution={attribution} />
      <ReplayTestimonials variant={variant} />
      <MasterclassFooter />
    </main>
  );
}

/**
 * Between Sunday 23:00 and the next room the expiry is in the past while the
 * replay still plays, so show no countdown then rather than "ended".
 */
function liveExpiry(startsAt: string | null): string | null {
  const expiry = replayExpiry(startsAt);
  return replayCountdownLive(expiry, Date.now()) ? expiry : null;
}
