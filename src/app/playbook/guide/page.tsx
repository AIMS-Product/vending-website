import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import "../../home-v2.css";
import { anton } from "../../fonts";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import { GuideBuyButton } from "@/components/sections/playbook-guide/GuideBuyButton";
import {
  GuideBenefits,
  GuideFinalOffer,
  GuideHero,
  GuideInside,
} from "@/components/sections/playbook-guide/GuideSections";
import { GuideStickyBuy } from "@/components/sections/playbook-guide/GuideStickyBuy";
import { GUIDE, guideOffer } from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";
import {
  LTF_COOKIE,
  LTF_PATHS,
  getLtfVisitor,
  isLtfTestOpen,
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
  if (!isLtfTestOpen()) notFound();
  const params = await searchParams;
  const db = createAdminClient();
  const visitor = await getLtfVisitor(
    db,
    (await cookies()).get(LTF_COOKIE)?.value,
  );
  if (!visitor) {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ).toString();
    redirect(`${LTF_PATHS.go}${query ? `?${query}` : ""}`);
  }
  await recordLtfEvent(db, visitor.visitorId, "offer_view");

  const error =
    typeof params.error === "string" ? NOTICES[params.error] : undefined;
  const buy = (className?: string) => (
    <GuideBuyButton
      variant={visitor.variant}
      label={guideOffer.cta}
      className={className}
    />
  );

  return (
    <div className={anton.variable}>
      <StripPiiParams />
      <GuideHero buy={buy()} notice={error} />
      <GuideBenefits />
      <GuideInside />
      <GuideFinalOffer buy={buy()} />
      <GuideStickyBuy title={GUIDE.title}>
        {buy("w-full sm:w-auto")}
      </GuideStickyBuy>
    </div>
  );
}
