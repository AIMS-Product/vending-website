import type { Metadata } from "next";
import "../home-v2.css";
import { anton } from "../fonts";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import {
  PlaybookCompare,
  PlaybookOpportunity,
  PlaybookStories,
} from "@/components/sections/playbook/PlaybookProof";
import {
  PlaybookFaq,
  PlaybookFinalOffer,
  PlaybookHost,
} from "@/components/sections/playbook/PlaybookClose";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { PlaybookHero } from "@/components/sections/playbook/PlaybookHero";
import {
  PlaybookCurriculum,
  PlaybookMoreBonuses,
  PlaybookSteps,
} from "@/components/sections/playbook/PlaybookOffer";
import { checkoutHref } from "@/lib/content/playbook";

// Paid-traffic landing page; kept out of search.
export const metadata: Metadata = {
  // The root layout appends " | Vendingpreneurs".
  title: "Mike Hoffmann's Vending Playbook",
  description:
    "Mike Hoffmann's Playbook: the Profit Machine System for finding, closing and running vending locations.",
  robots: { index: false, follow: false },
};

export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const href = checkoutHref(await searchParams);
  return (
    <main className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <PlaybookHero checkoutHref={href} />
      <PlaybookSteps />
      <PlaybookCurriculum checkoutHref={href} />
      <PlaybookOpportunity />
      <PlaybookMoreBonuses checkoutHref={href} />
      <PlaybookStories checkoutHref={href} />
      <PlaybookCompare />
      <PlaybookHost />
      <PlaybookFaq />
      <PlaybookFinalOffer checkoutHref={href} />
    </main>
  );
}
