import type { Metadata } from "next";
import Link from "next/link";
import "../../home-v2.css";
import { EYEBROW } from "@/components/sections/playbook/PlaybookCta";
import {
  GuideCard,
  GuideShell,
} from "@/components/sections/playbook-guide/GuideShell";
import { buttonClass } from "@/components/ui/Button";
import { CalendlyEmbed } from "@/components/embeds/CalendlyEmbed";
import { CheckIcon } from "@/components/sections/playbook/PlaybookCta";
import {
  GuideHelpLine,
  GuideOrderLine,
} from "@/components/sections/playbook-guide/GuideOrderLine";
import { GuidePurchaseTracker } from "@/components/sections/playbook-guide/GuidePurchaseTracker";
import {
  GUIDE,
  GUIDE_CLOSER_CALENDLY,
  guideThanks,
  guideUpsell,
} from "@/lib/content/playbook-guide";
import { config } from "@/lib/config";
import { LTF_PATHS } from "@/lib/ltf/assignment";
import { ltfOrderDeps, pageBrowserContext, pageOrigin } from "@/lib/ltf/deps";
import {
  downloadUrlFor,
  fulfillCheckoutSession,
  type FulfillResult,
} from "@/lib/ltf/orders";

export const metadata: Metadata = {
  title: `Thank you · ${GUIDE.title}`,
  robots: { index: false, follow: false },
};

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Stripe returns here with ?session_id. The page runs the same
 * fulfillment as the webhook (whichever lands first wins, the other is a
 * no-op), and shows the download only if Stripe says the session is paid.
 * Never unlocks anything from the URL alone.
 */
export default async function GuideThanksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;

  const support = config.LTF_SUPPORT_EMAIL;
  const origin = await pageOrigin();
  let result: FulfillResult | "error";
  if (!sessionId || !SESSION_ID.test(sessionId)) {
    result = "error";
  } else {
    try {
      result = await fulfillCheckoutSession(
        ltfOrderDeps(origin, await pageBrowserContext()),
        sessionId,
      );
    } catch (error) {
      console.error("ltf thank-you fulfillment failed", error);
      result = "error";
    }
  }

  if (result !== "error" && result.status === "paid") {
    return (
      <GuideShell>
        <GuideCard>
          <GuideOrderLine status="Paid" />
          <p className={`${EYEBROW} mt-6`}>{guideThanks.eyebrow}</p>
          <h1 className="v2-display text-ink mt-2 text-[clamp(2rem,4.4vw,3rem)] leading-[1.04] uppercase">
            {guideThanks.title}
          </h1>
          <p className="text-ink/80 mt-3 text-lg leading-snug break-words">
            {result.email
              ? guideThanks.body.replace("{email}", result.email)
              : guideThanks.body.replace(" to {email}", "")}
          </p>
          <a
            href={downloadUrlFor(origin, result.accessToken)}
            className={buttonClass({
              size: "lg",
              className: "mt-6 w-full sm:w-auto",
            })}
          >
            {guideThanks.cta}
          </a>
          <p className="text-ink/70 mt-5 text-sm font-bold">
            {guideThanks.next}
          </p>
          <GuideHelpLine email={support} />
        </GuideCard>
        {result.livemode && (result.amountCents ?? 0) > 0 ? (
          <GuidePurchaseTracker
            sessionId={sessionId!}
            value={(result.amountCents ?? 500) / 100}
            currency={(result.currency ?? "usd").toUpperCase()}
          />
        ) : null}
        <section className="mt-10" aria-labelledby="guide-upsell">
          <GuideCard>
            <p className={EYEBROW}>{guideUpsell.eyebrow}</p>
            <h2
              id="guide-upsell"
              className="v2-display text-ink mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-[1.02] uppercase"
            >
              {guideUpsell.title}
            </h2>
            <p className="text-ink/80 mt-4 text-lg leading-snug">
              {guideUpsell.body}
            </p>
            <ul className="mt-5 space-y-2">
              {guideUpsell.points.map((point) => (
                <li key={point} className="text-ink flex gap-3 font-bold">
                  <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="text-ink/65 mt-5 text-sm font-bold">
              {guideUpsell.note}
            </p>
            <div className="mt-6">
              <CalendlyEmbed
                url={closerCalendarUrl(result)}
                title="Book your free consultation"
                hideDetails="phone"
                heightClassName="h-[1050px] md:h-[720px]"
              />
            </div>
          </GuideCard>
        </section>
      </GuideShell>
    );
  }

  if (result !== "error" && result.status === "unpaid") {
    return (
      <GuideShell>
        <meta httpEquiv="refresh" content="4" />
        <GuideCard>
          <GuideOrderLine status="Pending" />
          <p className={`${EYEBROW} mt-6`}>One moment</p>
          <h1 className="v2-display text-ink mt-2 text-3xl uppercase sm:text-4xl">
            {guideThanks.pendingTitle}
          </h1>
          <p role="status" className="text-ink/80 mt-3 text-lg leading-snug">
            {guideThanks.pendingBody}
          </p>
          <GuideHelpLine email={support} />
        </GuideCard>
      </GuideShell>
    );
  }

  return (
    <GuideShell>
      <GuideCard>
        <GuideOrderLine />
        <p className={`${EYEBROW} mt-6`}>Need a hand?</p>
        <h1 className="v2-display text-ink mt-2 text-3xl uppercase sm:text-4xl">
          We couldn&rsquo;t load your order here
        </h1>
        <p className="text-ink/80 mt-4 text-lg leading-snug">
          If you paid, your download link is in your inbox. You can also get a
          fresh link sent to the email you used at checkout.
        </p>
        <Link
          href={LTF_PATHS.access}
          className={buttonClass({
            size: "lg",
            className: "mt-6 w-full sm:w-auto",
          })}
        >
          Send me my link
        </Link>
        <GuideHelpLine email={support} />
      </GuideCard>
    </GuideShell>
  );
}

/** Closer calendar prefilled with the buyer, tagged so the booking reads as a playbook buyer's. */
function closerCalendarUrl(result: {
  email: string | null;
  name: string | null;
}) {
  const url = new URL(GUIDE_CLOSER_CALENDLY);
  if (result.name) url.searchParams.set("name", result.name);
  if (result.email) url.searchParams.set("email", result.email);
  url.searchParams.set("utm_source", "playbook-guide");
  url.searchParams.set("utm_medium", "purchase");
  url.searchParams.set("utm_campaign", "ltf-v2");
  return url.toString();
}
