import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import "../../home-v2.css";
import { EYEBROW, CheckIcon } from "@/components/sections/playbook/PlaybookCta";
import { PlaybookCheckoutFrame } from "@/components/sections/playbook/PlaybookCheckoutFrame";
import { GuideShell } from "@/components/sections/playbook-guide/GuideShell";
import { config } from "@/lib/config";
import { GUIDE, guideOffer } from "@/lib/content/playbook-guide";
import {
  LTF_COOKIE,
  LTF_PATHS,
  getLtfVisitor,
  isLtfTestOpen,
  recordLtfEvent,
} from "@/lib/ltf/assignment";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: `Checkout · ${GUIDE.title}`,
  robots: { index: false, follow: false },
};

/**
 * Version A's checkout: the GHL order form for the $5 PDF product, framed.
 * That product lives in its own GHL funnel so the "Webinar LTF" course
 * workflow (funnel General Webinar V2, any sale) can never fire for it.
 */
export default async function GuideCheckoutPage() {
  if (!isLtfTestOpen()) notFound();
  const db = createAdminClient();
  const visitor = await getLtfVisitor(
    db,
    (await cookies()).get(LTF_COOKIE)?.value,
  );
  if (!visitor) redirect(LTF_PATHS.go);
  if (visitor.variant !== "a") redirect(LTF_PATHS.offer);
  await recordLtfEvent(db, visitor.visitorId, "checkout_start");

  const src = config.PLAYBOOK_GUIDE_GHL_EMBED_URL;
  return (
    <GuideShell note="Secure checkout">
      <p className={EYEBROW}>Secure checkout</p>
      <h1 className="v2-display text-ink mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.04] uppercase">
        {GUIDE.title}
      </h1>
      <ul className="text-ink/80 mt-4 space-y-1.5 text-sm font-bold">
        {guideOffer.terms.slice(0, 2).map((t) => (
          <li key={t} className="flex gap-2">
            <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
            {t}
          </li>
        ))}
      </ul>
      <div className="border-ink mt-8 border-2 bg-white shadow-[8px_8px_0_#111111]">
        {src ? (
          <PlaybookCheckoutFrame src={src} thankYouPath={LTF_PATHS.thanks} />
        ) : (
          <p className="text-ink p-8 font-bold">
            Checkout isn&rsquo;t connected yet (PLAYBOOK_GUIDE_GHL_EMBED_URL is
            unset).
          </p>
        )}
      </div>
    </GuideShell>
  );
}
