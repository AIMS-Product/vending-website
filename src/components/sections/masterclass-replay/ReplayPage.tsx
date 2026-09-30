import "server-only";

import type { Metadata } from "next";
import "@/app/home-v2.css";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
import {
  ReplayBooking,
  ReplayHero,
  ReplayTestimonials,
} from "@/components/sections/masterclass-replay/ReplaySections";
import {
  replayExpiry,
  replayVariants,
  type ReplayVariantKey,
} from "@/lib/content/masterclass-replay";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

/** Replay pages are sent by email, SMS, and ads; never indexed. */
export function replayMetadata(key: ReplayVariantKey): Metadata {
  return {
    title: replayVariants[key].metaTitle,
    robots: { index: false, follow: false },
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
    <main>
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
  return expiry && Date.parse(expiry) > Date.now() ? expiry : null;
}
