import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${site.publication} handles the email address you give it.`,
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    heading: "What we collect",
    body: "Your email address, and nothing else. There is no account to create, no phone number, and no payment.",
  },
  {
    heading: "What we do with it",
    body: "We send you Entrepreneurship Collective twice a week, and occasionally a note about something Mike is running. That's the whole list of uses.",
  },
  {
    heading: "Who else sees it",
    body: "Our email delivery provider, because that is how the email reaches you. We do not sell, rent, or trade the list.",
  },
  {
    heading: "Leaving",
    body: "Every issue carries an unsubscribe link in the footer. One click and you're off the list — no confirmation email, no retention offer.",
  },
  {
    heading: "Questions",
    body: "Reply to any issue, or email mike@vendingpreneurs.com.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 border-b border-rule">
        <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-8 lg:py-24">
          <p className="eyebrow text-accent">Privacy</p>
          <h1 className="font-display mt-4 text-4xl leading-tight sm:text-5xl">
            The short version
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink-muted">
            This is a newsletter, not a product. The only thing we ask for is an
            email address, and the only thing we do with it is send you the
            newsletter.
          </p>

          <div className="mt-12 border-t border-rule">
            {sections.map((section) => (
              <section key={section.heading} className="border-b border-rule py-7">
                <h2 className="font-display text-xl">{section.heading}</h2>
                <p className="mt-2 leading-7 text-ink-muted">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
