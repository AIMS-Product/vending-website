import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ApplyVsl } from "./apply/ApplyVsl";
import { QuoteTestimonialCard, VideoTestimonialCard } from "./Testimonials";
import { caseStudyQuotes, caseStudyVideos } from "@/lib/content/case-studies";
import {
  preCallHero,
  preCallNext,
  preCallPrep,
  preCallProof,
  preCallVsl,
} from "@/lib/content/pre-call-resources";

// /pre-call-resources — the one link sales sends after a call is booked.
// Order is deliberate: framing, video, proof, prep checklist (Alysia + Kody,
// Slack 2026-08-17). Type scale, dotted hero wash and centered eyebrow/heading
// pattern all mirror /apply so a prospect moving between the two pages sees one
// site rather than two.
//
// VSL SWAP: the video band is the shared ApplyVsl frame pointed at Mike's
// YouTube VSL. When Alysia hands over the Vidalytics embed, replace this one
// <ApplyVsl> with the Vidalytics div + its per-video script; fast.vidalytics.com
// is already allowed in src/lib/content-security-policy.ts and the global
// player script already loads site-wide from TrackingScripts.
export function PreCallResourcesPage() {
  return (
    <>
      <PreCallHero />
      <ApplyVsl vsl={preCallVsl} />
      <PreCallProof />
      <PreCallPrep />
      <PreCallNext />
    </>
  );
}

function PreCallHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Same dotted paper-blue wash as the /apply hero. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[#eaf6ff]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto max-w-[1180px] px-5 pt-28 pb-16 lg:px-10 lg:pt-32 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {preCallHero.eyebrow}
          </p>
          <h1 className="mx-auto mt-5 max-w-[18ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.04] font-black tracking-tight text-balance text-[#111111] uppercase">
            {preCallHero.title}
          </h1>
          {preCallHero.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="mx-auto mt-5 max-w-[58ch] text-[17px] leading-relaxed font-semibold text-slate-700"
            >
              {paragraph}
            </p>
          ))}
          <p className="mx-auto mt-7 max-w-[52ch] text-[17px] leading-relaxed font-black text-balance text-[#111111]">
            {preCallHero.kicker}
          </p>
        </div>
      </div>
    </section>
  );
}

function PreCallProof() {
  const quotes = preCallProof.quoteIds
    .map((id) => caseStudyQuotes.find((quote) => quote.id === id))
    .filter((quote) => quote !== undefined);

  return (
    <section className="border-t-2 border-[#111111] bg-white px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[1180px]">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {preCallProof.eyebrow}
        </p>
        <h2 className="mx-auto mt-4 max-w-[20ch] text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-balance text-[#111111] uppercase">
          {preCallProof.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[50ch] text-center text-[17px] leading-relaxed font-semibold text-slate-700">
          {preCallProof.body}
        </p>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {caseStudyVideos.map((video) => (
            <li key={video.id} className="min-w-0">
              <VideoTestimonialCard video={video} />
            </li>
          ))}
        </ul>

        <ul className="mt-6 grid gap-6 lg:grid-cols-3">
          {quotes.map((quote) => (
            <li key={quote.id} className="min-w-0">
              <QuoteTestimonialCard quote={quote} />
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-base font-semibold text-slate-600">
          <Link
            href={preCallProof.moreCta.href}
            className="font-black text-[#066a99] underline underline-offset-2 hover:text-[#111111]"
          >
            {preCallProof.moreCta.label}
          </Link>
        </p>
      </div>
    </section>
  );
}

function PreCallPrep() {
  return (
    <section className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[1000px]">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {preCallPrep.eyebrow}
        </p>
        <h2 className="mx-auto mt-4 max-w-[22ch] text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-balance text-[#111111] uppercase">
          {preCallPrep.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-center text-[17px] leading-relaxed font-semibold text-slate-700">
          {preCallPrep.body}
        </p>
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {preCallPrep.items.map((item, index) => (
            <li
              key={item}
              className="flex h-full min-w-0 flex-col gap-4 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-sm font-black text-[#111111]"
              >
                {index + 1}
              </span>
              <p className="text-[15px] leading-relaxed font-semibold text-slate-700">
                {item}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PreCallNext() {
  return (
    <section className="border-t-2 border-[#111111] bg-white px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[820px] rounded-[12px] border-2 border-[#111111] bg-[#f5fbff] px-8 py-12 text-center shadow-[10px_10px_0_#55b8e8] lg:px-14">
        <h2 className="mx-auto max-w-[20ch] text-[clamp(1.75rem,3vw,2.4rem)] leading-[1.08] font-black text-balance text-[#111111] uppercase">
          {preCallNext.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[48ch] text-[17px] leading-relaxed font-semibold text-slate-700">
          {preCallNext.body}
        </p>
        <div className="mt-8">
          <Button href={preCallNext.cta.href} showArrow>
            {preCallNext.cta.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
