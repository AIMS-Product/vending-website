"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cohortBannerHref } from "@/lib/content/cohort-banner";

const noopSubscribe = () => () => {};

// Text is filled in after hydration (server HTML carries only a screen-reader
// label). The bar keeps its height while empty, so there is no layout shift.
export function CohortBanner() {
  const text = useSyncExternalStore(
    noopSubscribe,
    // No seat count or cohort wording: scarcity claims get Google Ads
    // disapproval ("Unreliable claims", 2026-10-10).
    () => "Talk to Vendingpreneurs about your market",
    () => null,
  );

  return (
    <Link
      href={cohortBannerHref}
      className="flex min-h-11 items-center justify-center gap-2 border-b-2 border-[#111111] bg-[#111111] px-5 text-center text-sm font-bold text-white hover:underline focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:outline-none focus-visible:ring-inset"
    >
      {text ? (
        <>
          <span>{text}</span>
          <span className="hidden text-[#55b8e8] sm:inline">
            · Book your call
          </span>
          <span aria-hidden className="text-[#55b8e8]">
            →
          </span>
        </>
      ) : (
        // Server HTML and the first client paint have no count yet. Without a
        // name the link is the first focusable element and reads as empty.
        <span className="sr-only">Book your call</span>
      )}
    </Link>
  );
}
