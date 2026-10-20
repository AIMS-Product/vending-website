import type { Metadata } from "next";
import Link from "next/link";
import "../../home-v2.css";
import { EYEBROW } from "@/components/sections/playbook/PlaybookCta";
import { PlaybookThankYouBreakout } from "@/components/sections/playbook/PlaybookThankYou";
import {
  GuideCard,
  GuideShell,
} from "@/components/sections/playbook-guide/GuideShell";
import { buttonClass } from "@/components/ui/Button";
import { GUIDE, guideThanks } from "@/lib/content/playbook-guide";
import { LTF_PATHS } from "@/lib/ltf/assignment";
import { ltfOrderDeps, pageOrigin } from "@/lib/ltf/deps";
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
 * B: Stripe returns here with ?session_id. The page runs the same
 * fulfillment as the webhook (whichever lands first wins, the other is a
 * no-op), and shows the download only if Stripe says the session is paid.
 * A: GHL's order form redirects here inside its iframe with no session id;
 * the breakout moves the tab here and GHL emails the PDF.
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
  if (!sessionId) return <GhlThanks />;

  const origin = await pageOrigin();
  let result: FulfillResult | "error";
  if (!SESSION_ID.test(sessionId)) {
    result = "error";
  } else {
    try {
      result = await fulfillCheckoutSession(ltfOrderDeps(origin), sessionId);
    } catch (error) {
      console.error("ltf thank-you fulfillment failed", error);
      result = "error";
    }
  }

  if (result !== "error" && result.status === "paid") {
    return (
      <GuideShell>
        <GuideCard>
          <p className={EYEBROW}>{guideThanks.eyebrow}</p>
          <h1 className="v2-display text-ink mt-3 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] uppercase">
            {guideThanks.title}
          </h1>
          <p className="text-ink/80 mt-4 text-lg leading-snug">
            {result.email
              ? guideThanks.body.replace("{email}", result.email)
              : guideThanks.body.replace(" to {email}", "")}
          </p>
          <a
            href={downloadUrlFor(origin, result.accessToken)}
            className={buttonClass({
              size: "lg",
              className: "mt-8 w-full sm:w-auto",
            })}
          >
            {guideThanks.cta}
          </a>
          <p className="text-ink/70 mt-6 text-sm font-bold">
            {guideThanks.next}
          </p>
        </GuideCard>
      </GuideShell>
    );
  }

  if (result !== "error" && result.status === "unpaid") {
    return (
      <GuideShell>
        <meta httpEquiv="refresh" content="4" />
        <GuideCard>
          <p className={EYEBROW}>One moment</p>
          <h1 className="v2-display text-ink mt-3 text-4xl uppercase">
            {guideThanks.pendingTitle}
          </h1>
          <p className="text-ink/80 mt-4 text-lg leading-snug">
            {guideThanks.pendingBody}
          </p>
        </GuideCard>
      </GuideShell>
    );
  }

  return (
    <GuideShell>
      <GuideCard>
        <p className={EYEBROW}>Need a hand?</p>
        <h1 className="v2-display text-ink mt-3 text-4xl uppercase">
          We couldn&rsquo;t load your order here
        </h1>
        <p className="text-ink/80 mt-4 text-lg leading-snug">
          If you paid, your download link is in your inbox. You can also get a
          fresh link sent to the email you used at checkout.
        </p>
        <Link
          href={LTF_PATHS.access}
          className={buttonClass({ size: "lg", className: "mt-8" })}
        >
          Send me my link
        </Link>
      </GuideCard>
    </GuideShell>
  );
}

function GhlThanks() {
  return (
    <GuideShell>
      <PlaybookThankYouBreakout trackPurchase={false} />
      <GuideCard>
        <p className={EYEBROW}>Order confirmed</p>
        <h1 className="v2-display text-ink mt-3 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] uppercase">
          {guideThanks.ghlTitle}
        </h1>
        <p className="text-ink/80 mt-4 text-lg leading-snug">
          {guideThanks.ghlBody}
        </p>
        <p className="text-ink/70 mt-6 text-sm font-bold">{guideThanks.next}</p>
      </GuideCard>
    </GuideShell>
  );
}
