import { randomUUID } from "node:crypto";
import Image from "next/image";
import {
  finishNewsletterSignup,
  startNewsletterSignup,
} from "@/app/qualification-intake/actions";
import { NewsletterSignupForm } from "@/components/forms/NewsletterSignupForm";
import { newsletterPageContent } from "@/lib/content/newsletter";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

export async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = {
    ...buildLeadAttribution(await searchParams, "/newsletter"),
    source_page_id: "coded:newsletter",
    source_page_slug: "newsletter",
    source_block_id: "newsletter_signup",
    source_cta_tracking_name: "newsletter-signup-form",
  };

  return (
    <div className="overflow-hidden bg-[#fffaf0] text-slate-950">
      <section className="relative border-b-2 border-slate-950 px-5 py-14 sm:px-8 lg:py-20">
        <div className="absolute inset-x-0 top-0 h-2 bg-orange-500" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-black tracking-[0.2em] text-orange-700 uppercase">
              {newsletterPageContent.hero.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl leading-[0.97] font-black tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
              {newsletterPageContent.hero.heading}
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 font-semibold text-slate-600">
              {newsletterPageContent.hero.body}
            </p>
            <dl className="mt-9 grid max-w-xl grid-cols-3 divide-x-2 divide-slate-900 border-y-2 border-slate-900 py-4">
              {newsletterPageContent.hero.stats.map((stat) => (
                <div key={stat.label} className="px-3 first:pl-0 sm:px-5">
                  <dt className="text-[0.68rem] font-black tracking-wider text-slate-500 uppercase sm:text-xs">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-2xl font-black sm:text-3xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            id="newsletter-signup"
            className="scroll-mt-24 rounded-2xl border-2 border-slate-950 bg-white p-6 shadow-[10px_10px_0_#0f172a] sm:p-8"
          >
            <NewsletterSignupForm
              action={startNewsletterSignup}
              finishAction={finishNewsletterSignup}
              attribution={attribution}
              idempotencyKey={`newsletter:${randomUUID()}`}
            />
          </div>
        </div>
      </section>

      <section className="border-b-2 border-slate-950 bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-black tracking-[0.2em] text-slate-500 uppercase">
            Ideas featured across
          </p>
          <div className="mt-7 grid grid-cols-2 items-center gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {newsletterPageContent.proof.map((item) => (
              <div key={item.name} className="flex min-h-12 justify-center">
                <Image
                  src={item.image}
                  alt={item.name}
                  width={180}
                  height={56}
                  className="h-11 w-auto max-w-full object-contain grayscale"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-black tracking-tight sm:text-5xl">
            {newsletterPageContent.expertsHeading}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {newsletterPageContent.experts.map((expert, index) => (
              <article
                key={expert.name}
                className={`grid gap-6 rounded-2xl border-2 border-slate-950 p-7 shadow-[7px_7px_0_#0f172a] sm:grid-cols-[8rem_1fr] ${
                  index === 0 ? "bg-sky-100" : "bg-orange-100"
                }`}
              >
                <Image
                  src={expert.image}
                  alt={expert.name}
                  width={256}
                  height={256}
                  className="aspect-square w-32 rounded-xl border-2 border-slate-950 object-cover"
                />
                <div>
                  <p className="text-xs font-black tracking-[0.14em] text-orange-700 uppercase">
                    {expert.publication}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">{expert.name}</h3>
                  <p className="mt-3 leading-7 font-medium text-slate-600">
                    {expert.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-slate-950 bg-orange-500 px-5 py-14 text-center sm:px-8">
        <h2 className="mx-auto max-w-4xl text-4xl leading-tight font-black tracking-tight sm:text-5xl">
          {newsletterPageContent.closingHeading}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-900">
          {newsletterPageContent.closingBody}
        </p>
        <a
          href="#newsletter-signup"
          className="mt-8 inline-flex min-h-14 items-center rounded-lg border-2 border-slate-950 bg-white px-8 py-3 font-black shadow-[5px_5px_0_#0f172a] transition hover:-translate-y-0.5"
        >
          Join The Route — free
        </a>
      </section>
    </div>
  );
}
