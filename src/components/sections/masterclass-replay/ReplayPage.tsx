import "server-only";

import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import "@/app/home-v2.css";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
import {
  ReplayBooking,
  ReplayHero,
  ReplayTestimonials,
} from "@/components/sections/masterclass-replay/ReplaySections";
import {
  replayVariants,
  type ReplayVariantKey,
} from "@/lib/content/masterclass-replay";
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
  const attribution = buildLeadAttribution(await searchParams, variant.path);
  return (
    <main>
      <ReplayHero variant={variant} />
      <ReplayBooking
        variant={variant}
        attribution={attribution}
        idempotencyKey={randomUUID()}
      />
      <ReplayTestimonials variant={variant} />
      <MasterclassFooter />
    </main>
  );
}
