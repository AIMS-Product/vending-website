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
import { PlaybookStickyBuy } from "@/components/sections/playbook/PlaybookStickyBuy";
import {
  PlaybookCurriculum,
  PlaybookMoreBonuses,
  PlaybookSteps,
} from "@/components/sections/playbook/PlaybookOffer";
import { checkoutHref, images } from "@/lib/content/playbook";

// Paid-traffic landing page; kept out of search.
const TITLE = "Mike Hoffmann's Vending Playbook";
const DESCRIPTION =
  "Mike Hoffmann's Playbook: the Profit Machine System for finding, closing and running vending locations.";

export const metadata: Metadata = {
  // The root layout appends " | Vendingpreneurs".
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/playbook",
    images: [
      {
        url: images.productTrimmed.src,
        width: images.productTrimmed.width,
        height: images.productTrimmed.height,
        alt: images.productTrimmed.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [images.productTrimmed.src],
  },
  robots: { index: false, follow: false },
};

export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const href = checkoutHref(await searchParams);
  return (
    <div className={anton.variable}>
      <StripPiiParams />
      <RevealObserver />
      <PlaybookHero checkoutHref={href} />
      <PlaybookSteps />
      <PlaybookCurriculum checkoutHref={href} />
      <PlaybookOpportunity />
      <PlaybookMoreBonuses checkoutHref={href} />
      <PlaybookStories checkoutHref={href} />
      <PlaybookCompare />
      <PlaybookHost checkoutHref={href} />
      <PlaybookFaq />
      <PlaybookFinalOffer checkoutHref={href} />
      <PlaybookStickyBuy href={href} />
    </div>
  );
}
