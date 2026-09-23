import { randomUUID } from "node:crypto";
import Image from "next/image";
import {
  finishNewsletterSignup,
  startNewsletterSignup,
} from "@/app/qualification-intake/actions";
import { NewsletterSignupForm } from "@/components/forms/NewsletterSignupForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
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
    source_page_id: "",
    source_page_slug: "newsletter",
    source_block_id: "newsletter_signup",
    source_cta_tracking_name: "newsletter-signup-form",
  };

  return (
    <div className="text-ink overflow-hidden bg-white">
      <section className="border-ink relative border-b-2 bg-[#f5fbff] py-14 lg:py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
              {newsletterPageContent.hero.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.25rem,4.6vw,4.25rem)] leading-[1.05] font-black text-balance uppercase">
              {newsletterPageContent.hero.heading}
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 font-semibold text-slate-600">
              {newsletterPageContent.hero.body}
            </p>
            <dl className="divide-ink border-ink mt-9 grid max-w-xl grid-cols-3 divide-x-2 border-y-2 py-4">
              {newsletterPageContent.hero.stats.map((stat) => (
                <div key={stat.label} className="px-3 first:pl-0 sm:px-5">
                  <dt className="text-xs font-black tracking-wider text-slate-500 uppercase">
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
            className="border-ink rounded-card shadow-card scroll-mt-24 border-2 bg-white p-6 sm:p-8"
          >
            <NewsletterSignupForm
              action={startNewsletterSignup}
              finishAction={finishNewsletterSignup}
              attribution={attribution}
              idempotencyKey={`newsletter:${randomUUID()}`}
            />
          </div>
        </Container>
      </section>

      <section className="border-ink border-b-2 bg-white py-10">
        <Container>
          <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
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
                  className="h-11 w-auto max-w-full object-contain"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24">
        <Container>
          <h2 className="text-center text-[clamp(1.75rem,3.4vw,2.9rem)] leading-[1.05] font-black uppercase">
            {newsletterPageContent.expertsHeading}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {newsletterPageContent.experts.map((expert) => (
              <article
                key={expert.name}
                className="border-ink rounded-card shadow-card bg-tint grid gap-6 border-2 p-7 sm:grid-cols-[8rem_1fr]"
              >
                <Image
                  src={expert.image}
                  alt={expert.name}
                  width={256}
                  height={256}
                  className="border-ink rounded-control aspect-square w-32 border-2 object-cover"
                />
                <div>
                  <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
                    {expert.publication}
                  </p>
                  <h3 className="mt-2 text-2xl font-black uppercase">
                    {expert.name}
                  </h3>
                  <p className="mt-3 leading-7 font-medium text-slate-600">
                    {expert.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-ink bg-ink border-y-2 px-5 py-16 text-center text-white lg:py-20">
        <h2 className="mx-auto max-w-4xl text-[clamp(1.75rem,3.4vw,2.9rem)] leading-[1.05] font-black uppercase">
          {newsletterPageContent.closingHeading}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-slate-200">
          {newsletterPageContent.closingBody}
        </p>
        <div className="mt-9 flex justify-center">
          <Button href="#newsletter-signup" variant="onInk" size="lg">
            Join The Route — free
          </Button>
        </div>
      </section>
    </div>
  );
}
