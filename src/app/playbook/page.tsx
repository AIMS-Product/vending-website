import type { Metadata } from "next";
import "../home-v2.css";
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
import { PlaybookHero } from "@/components/sections/playbook/PlaybookHero";
import {
  PlaybookCurriculum,
  PlaybookMoreBonuses,
  PlaybookSteps,
} from "@/components/sections/playbook/PlaybookOffer";
import { checkoutHref } from "@/lib/content/playbook";

// Paid-traffic landing page; kept out of search.
export const metadata: Metadata = {
  title: "Mike Hoffmann's Vending Playbook | Vendingpreneurs",
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
    <main>
      <RevealObserver />
      <PlaybookHero checkoutHref={href} />
      <PlaybookSteps checkoutHref={href} />
      <PlaybookCurriculum checkoutHref={href} />
      <PlaybookOpportunity checkoutHref={href} />
      <PlaybookMoreBonuses checkoutHref={href} />
      <PlaybookStories checkoutHref={href} />
      <PlaybookCompare />
      <PlaybookHost checkoutHref={href} />
      <PlaybookFaq />
      <PlaybookFinalOffer checkoutHref={href} />
    </main>
  );
}
