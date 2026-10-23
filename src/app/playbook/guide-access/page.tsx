import type { Metadata } from "next";
import "../../home-v2.css";
import {
  GuideCard,
  GuideShell,
} from "@/components/sections/playbook-guide/GuideShell";
import {
  GuideHelpLine,
  GuideOrderLine,
} from "@/components/sections/playbook-guide/GuideOrderLine";
import { buttonClass } from "@/components/ui/Button";
import { config } from "@/lib/config";
import { GUIDE } from "@/lib/content/playbook-guide";

export const metadata: Metadata = {
  title: `Get your download link · ${GUIDE.title}`,
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  sent: {
    tone: "ok",
    text: "If that email bought the playbook, a fresh download link is on its way. Check spam if it isn't there in a few minutes.",
  },
  expired: {
    tone: "warn",
    text: "That download link isn't valid anymore. Enter the email you used at checkout and we'll send a working one.",
  },
  invalid: {
    tone: "warn",
    text: "That doesn't look like an email address. Please check it and try again.",
  },
  limited: {
    tone: "warn",
    text: "Too many requests for now. Please try again in an hour, or reply to your delivery email.",
  },
  error: {
    tone: "warn",
    text: "Something went wrong on our side. Please try again, or reply to your delivery email.",
  },
};

/** Purchase recovery: re-sends the download link to a paid buyer's email. Always on. */
export default async function GuideAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const key = Object.keys(MESSAGES).find((k) => params[k] === "1");
  const message = key ? MESSAGES[key] : null;
  return (
    <GuideShell>
      <GuideCard>
        <GuideOrderLine />
        <h1 className="v2-display text-ink mt-6 text-[clamp(2rem,4.4vw,3rem)] leading-[1.04] uppercase">
          Get your download link
        </h1>
        <p className="text-ink/80 mt-3 text-lg leading-snug">
          Already bought the playbook? Enter the email you used at checkout and
          we&rsquo;ll send you a working link. No need to buy again.
        </p>
        {message ? (
          <p
            role="status"
            className={`border-ink mt-5 border-2 px-4 py-3 text-sm font-bold ${
              message.tone === "ok"
                ? "bg-ui-ok-fill text-ui-ok-ink"
                : "bg-ui-warn-fill text-ui-warn-ink"
            }`}
          >
            {message.text}
          </p>
        ) : null}
        <form
          action="/api/playbook-guide/recover"
          method="post"
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <label className="sr-only" htmlFor="ltf-email">
            Email
          </label>
          <input
            id="ltf-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="border-ink text-ink focus-visible:outline-brand-600 min-h-14 min-w-0 border-2 bg-white px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button type="submit" className={buttonClass({ size: "lg" })}>
            Send my link
          </button>
        </form>
        <GuideHelpLine email={config.LTF_SUPPORT_EMAIL} />
      </GuideCard>
    </GuideShell>
  );
}
