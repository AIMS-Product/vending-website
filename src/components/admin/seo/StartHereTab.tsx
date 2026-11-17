import Link from "next/link";
import { adminCardClass } from "@/components/admin/AdminUi";

// Orientation for whoever owns SEO and the blog. Every label below must match
// the Studio screen it names; change both in the same commit.

const TASKS = [
  {
    task: "Write a new article",
    where: "SEO pages → New page",
    href: "/admin/pages/new",
    how: "New articles go live under vendingpreneurs.com/resources. Fill in SEO title, Meta description and Target keyword, then Publish, or set a Scheduled publish date.",
  },
  {
    task: "Edit an older blog post",
    where: "Blog and news",
    href: "/admin/news",
    how: "The original blog, under /news. Google shows the post title as its search title and the excerpt as its description, so write both for search.",
  },
  {
    task: "Update a success story",
    where: "Case studies",
    href: "/admin/case-studies",
    how: "Member stories under /case-studies. These are published under real names: check edits with the team first.",
  },
  {
    task: "Rename or retire a page",
    where: "SEO pages → Redirects",
    href: "/admin/pages/redirects",
    how: "Add a redirect from the old address to the closest live page on the same topic. Never send an article to the /news or /resources list pages: Google drops it.",
  },
  {
    task: "Add images",
    where: "Media library",
    href: "/admin/media",
    how: "Upload once, then pick from the library inside any editor. Always fill in the alt text.",
  },
  {
    task: "Decide what to write next",
    where: "SEO → Content Plan",
    href: "/admin/seo?tab=plan",
    how: "The planned pieces with their keywords. A piece turns live by itself once its /resources page is published.",
  },
  {
    task: "See how search is going",
    where: "SEO → Overview, Pages, Keywords",
    href: "/admin/seo?tab=overview",
    how: "Google Search Console numbers, refreshed nightly. They run 2–3 days behind and start on 26 Nov 2025.",
  },
  {
    task: "Weekly to-dos",
    where: "SEO → Agent tasks",
    href: "/admin/seo?tab=tasks",
    how: "Every Monday the system flags pages that slipped in Google or could rank higher. Mark each done or dismiss it.",
  },
] as const;

const CHECKLIST = [
  "SEO title under 60 characters, with the main keyword near the front.",
  "Meta description under 155 characters that gives a reason to click.",
  "One clear H1, and alt text on every image.",
  "Links to at least two related articles, plus a link to /contact for readers ready to talk.",
  "Leave “Hide from search engines” off, unless the page is a thank-you or test page.",
  "Open the live page after publishing. It is added to the sitemap automatically, and Google usually picks it up within days.",
] as const;

const CODED = [
  "Home, About and Contact",
  "Solutions and Process",
  "Masterclass, Playbook and the booking pages",
  "Lead-magnet pages (Roadmap, Finance templates)",
] as const;

export function SeoStartHereTab() {
  return (
    <div className="grid gap-5">
      <section className={`${adminCardClass} p-5`}>
        <h2 className="text-ui-text mb-3 text-base font-semibold">
          Where everything lives
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TASKS.map((t) => (
            <li key={t.task}>
              <Link
                href={t.href}
                className="border-ui-line hover:border-ui-accent rounded-ui block h-full border p-4 transition"
              >
                <span className="text-ui-text block text-sm font-semibold">
                  {t.task}
                </span>
                <span className="text-ui-accent mt-0.5 block text-xs font-medium">
                  {t.where}
                </span>
                <span className="text-ui-text-muted mt-1 block text-[0.8125rem]">
                  {t.how}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Before you publish
          </h2>
          <ul className="text-ui-text-muted grid list-disc gap-2 pl-5 text-sm">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={`${adminCardClass} p-5`}>
          <h2 className="text-ui-text mb-3 text-base font-semibold">
            Pages the Studio cannot edit
          </h2>
          <p className="text-ui-text-muted mb-2 text-sm">
            These are built by the developers. Send changes to Adam:
          </p>
          <ul className="text-ui-text-muted grid list-disc gap-1 pl-5 text-sm">
            {CODED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-ui-text-muted mt-3 text-sm">
            The figures on the homepage and Contact page (income ranges, counts,
            testimonials) are signed off by the CEO and stay as they are.
          </p>
        </section>
      </div>
    </div>
  );
}
