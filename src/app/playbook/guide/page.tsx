import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "../../home-v2.css";
import { antonFont } from "../../fonts";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { GuideBuyButton } from "@/components/sections/playbook-guide/GuideBuyButton";
import {
  GuideBenefits,
  GuideFaq,
  GuideFinalOffer,
  GuideHero,
  GuideInside,
  GuideProof,
} from "@/components/sections/playbook-guide/GuideSections";
import { GuideStickyBuy } from "@/components/sections/playbook-guide/GuideStickyBuy";
import { GUIDE, guideOffer } from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";
import {
  LTF_COOKIE,
  LTF_PATHS,
  getLtfVisitor,
  recordLtfEvent,
} from "@/lib/ltf/assignment";
import { createAdminClient } from "@/lib/supabase/admin";

const TITLE = `${GUIDE.title} by Mike Hoffmann`;

export const metadata: Metadata = {
  title: TITLE,
  description: GUIDE.subtitle,
  openGraph: {
    title: TITLE,
    description: GUIDE.subtitle,
    images: [guideImages.cover.src],
  },
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const NOTICES: Record<string, string> = {
  checkout:
    "Checkout couldn't open just now. Nothing was charged. Please try the button again.",
};

/**
 * LTF V2 offer page, the same for both test versions; only the buy button
 * differs (GuideBuyButton). Visitors without an assignment go through
 * /playbook/go first so every view belongs to a version.
 */
export default async function PlaybookGuidePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const db = createAdminClient();
  // Tracking is never allowed to block the page: if the visitor can't be read
  // or recorded, the offer still renders (untracked) and still sells.
  let visitorId: string | null = null;
  try {
    const visitor = await getLtfVisitor(
      db,
      (await cookies()).get(LTF_COOKIE)?.value,
    );
    visitorId = visitor?.visitorId ?? null;
  } catch (error) {
    console.error("ltf offer: visitor lookup failed", error);
  }
  if (!visitorId && params.ltf_fallback !== "1") {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ).toString();
    redirect(`${LTF_PATHS.go}${query ? `?${query}` : ""}`);
  }
  if (visitorId) {
    await recordLtfEvent(db, visitorId, "offer_view").catch((error) =>
      console.error("ltf offer: view not recorded", error),
    );
  }

  const promo =
    typeof params.promo === "string" ? params.promo.slice(0, 100) : undefined;
  const error =
    typeof params.error === "string" ? NOTICES[params.error] : undefined;
  const buy = (className?: string) => (
    <GuideBuyButton
      label={guideOffer.cta}
      className={className}
      promo={promo}
    />
  );

  return (
    <div className={antonFont()}>
      <StripPiiParams />
      <GuideHero buy={buy()} notice={error} />
      <GuideBenefits />
      <GuideInside />
      <GuideProof />
      <GuideFaq />
      <GuideFinalOffer buy={buy("sm:w-full")} />
      <GuideStickyBuy title={GUIDE.title}>
        {buy("w-full sm:w-auto")}
      </GuideStickyBuy>
    </div>
  );
}
