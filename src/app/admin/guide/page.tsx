import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Start here",
  robots: { index: false, follow: false },
};

const WEBINAR_BOARD = "https://webinars.vendingpreneurs.com";

const WEEK = [
  {
    when: "Every morning",
    what: "Open Analytics. The top strip is today: calls booked, first calls on the calendar, leads in. The chips top right flag a lead missing from Close or a stale source.",
  },
  {
    when: "Monday",
    what: "The Leadership scorecard card on Analytics holds last week's sheet rows: booked calls, MQLs, ad spend, cost per MQL. Open “All weeks” for the history.",
  },
  {
    when: "Weekly",
    what: "Google Ads: read the one-line summary and anything under “Needs a decision”. Meta: the webinar board's “What to double down on” marks every ad keep, cut or double down.",
  },
  {
    when: "Before any new ad",
    what: "Build its link in Links so the UTM tags are right. Without them a booking cannot be traced back to the ad.",
  },
] as const;

const PAGES = [
  {
    href: "/admin/analytics",
    label: "Analytics",
    answers:
      "Every channel from lead to closed deal, with booked calls by channel, paid ads side by side and what each channel's calls are worth.",
  },
  {
    href: "/admin/analytics/google-ads",
    label: "Google Ads",
    answers:
      "What Google costs and brings back, the live ads, and the decisions it needs. Media buyer detail sits at the bottom.",
  },
  {
    href: "/admin/analytics/board",
    label: "Funnel board",
    answers: "The sales sheet, rebuilt on our own attribution.",
  },
  {
    href: "/admin/analytics/channels",
    label: "Channels",
    answers: "One channel at a time, from capture to sale.",
  },
  {
    href: "/admin/analytics/months",
    label: "Month over month",
    answers: "Each month against the one before.",
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    answers: "Every booked call and who set it.",
  },
  {
    href: "/admin/leads",
    label: "Leads",
    answers: "Every site lead and where it is in qualification.",
  },
  {
    href: "/admin/links",
    label: "Links",
    answers:
      "Build tracked links for ads, posts and emails, and see every link in use.",
  },
  {
    href: "/admin/data",
    label: "Data trust",
    answers:
      "What every number means, and whether last night's checks agreed with the system that owns it.",
  },
] as const;

const RULES = [
  [
    "Booked calls",
    "are first sales calls in Close dated in the window, minus cancelled, outside-the-US and quiz-funnel leads. Days are Eastern time, as the sales floor counts them.",
  ],
  [
    "Credit",
    "follows the Close funnel, except a lead whose form carried a Google click id counts as Google Ads.",
  ],
  [
    "Won deals lag.",
    "Recent bookings have had less time to close, so compare channels on the same window and use 90 days for close rate.",
  ],
  [
    "A dash is not a zero:",
    "there is no spend, or nothing to divide by. Under 10 booked calls is a small sample.",
  ],
  [
    "Landing-page figures",
    "on the homepage and /contact are CEO-approved. If an ad is disapproved over a claim, change the ad, never the page.",
  ],
] as const;

/** Orientation for whoever owns marketing: the week, where each answer lives, how to read it. */
export default async function AdminGuidePage() {
  const { user, role } = await requireReadAccess();
  return (
    <AdminShell
      activeSection="guide"
      eyebrow="Start here"
      title="How to use the studio"
      description="Marketing and sales reporting for vendingpreneurs.com. The webinar and its Meta ads have their own board."
      userEmail={user.email}
      userRole={role}
    >
      <div className="grid gap-5">
        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Your week
          </h2>
          <dl className="grid gap-3 text-sm">
            {WEEK.map((row) => (
              <div
                key={row.when}
                className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4"
              >
                <dt className="text-ui-text font-semibold">{row.when}</dt>
                <dd className="text-ui-text-muted">{row.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Where to look
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="border-ui-line hover:border-ui-accent rounded-ui block h-full border p-4 transition"
                >
                  <span className="text-ui-text block text-sm font-semibold">
                    {page.label}
                  </span>
                  <span className="text-ui-text-muted mt-1 block text-[0.8125rem]">
                    {page.answers}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Paid ads: Google here, Meta on the webinar board
          </h2>
          <div className="text-ui-text-muted grid gap-2 text-sm">
            <p>
              Google Ads sends people to this site, so it is reported here:{" "}
              <Link
                href="/admin/analytics/google-ads"
                className="text-ui-accent hover:underline"
              >
                Google Ads
              </Link>
              . Analytics shows Google and Meta side by side with spend,
              sign-ups, booked calls and wins.
            </p>
            <p>
              Meta mostly fills the webinar, so its ad sets, ads, creatives and
              audiences are on the{" "}
              <a
                href={`${WEBINAR_BOARD}/ads/winners`}
                className="text-ui-accent hover:underline"
              >
                webinar board
              </a>
              , which has its own Start here page.
            </p>
          </div>
        </section>

        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Reading the numbers
          </h2>
          <ul className="text-ui-text-muted grid list-disc gap-2 pl-5 text-sm">
            {RULES.map(([lead, rest]) => (
              <li key={lead}>
                <strong className="text-ui-text font-semibold">{lead}</strong>{" "}
                {rest}
              </li>
            ))}
          </ul>
          <p className={`${adminEyebrowClass} mt-4`}>
            Every “?” on Analytics opens that card’s definition.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
