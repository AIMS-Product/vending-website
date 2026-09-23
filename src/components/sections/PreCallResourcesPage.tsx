import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  VidalyticsGlobalTag,
  VidalyticsPlayer,
} from "@/components/media/VidalyticsPlayer";
import {
  preCallHero,
  preCallNext,
  preCallOperators,
  preCallOperatorTiers,
  preCallPrep,
  preCallResources,
} from "@/lib/content/pre-call-resources";

// /pre-call-resources — the one link sales sends after a call is booked.
// Order is marketing's (Google Doc, 2026-09-15): framing video, the six
// objection answers, operator stories, live wins, prep checklist, booking CTA.
// Type scale, dotted hero wash and centered eyebrow/heading pattern all mirror
// /apply so a prospect moving between the two pages sees one site.
export function PreCallResourcesPage() {
  return (
    <>
      <VidalyticsGlobalTag />
      <PreCallHero />
      <PreCallResources />
      <PreCallOperators />
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
      <div className="relative mx-auto max-w-[940px] px-5 pt-28 pb-20 lg:px-10 lg:pt-32">
        <div>
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {preCallHero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-[20ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.04] font-black tracking-tight text-balance text-[#111111] uppercase">
            {preCallHero.title}
          </h1>
        </div>
        <VidalyticsPlayer embedId={preCallHero.embedId} className="mt-10" />
        {preCallHero.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-6 max-w-[64ch] text-[17px] leading-relaxed font-semibold text-slate-700"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

function PreCallResources() {
  return (
    <section className="border-t-2 border-[#111111] bg-white px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[940px]">
        <h2 className="text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-balance text-[#111111] uppercase">
          {preCallResources.title}
        </h2>
        <div className="mt-14 space-y-20">
          {preCallResources.items.map((item) => (
            <article key={item.id}>
              <h3 className="mx-auto max-w-[28ch] text-center text-[clamp(1.4rem,2.4vw,1.9rem)] leading-[1.15] font-black text-balance text-[#111111]">
                {item.question}
              </h3>
              <VidalyticsPlayer
                embedId={item.embedId}
                loadOn="click"
                title={item.question}
                className="mt-7"
              />
              <p className="mx-auto mt-6 max-w-[64ch] text-center text-[17px] leading-relaxed font-semibold text-slate-700">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreCallOperators() {
  return (
    <section className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[1180px]">
        <h2 className="mx-auto max-w-[24ch] text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-balance text-[#111111] uppercase">
          {preCallOperators.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[62ch] text-center text-[16px] leading-relaxed font-semibold text-slate-700">
          {preCallOperators.disclaimer}
        </p>
        {preCallOperatorTiers.map((tier) => {
          const items = preCallOperators.items.filter(
            (operator) => operator.tier === tier.id,
          );
          if (items.length === 0) return null;
          return (
            <div key={tier.id} className="mt-14">
              {/* The rule is what makes a left-aligned h3 read as a deliberate
                  rail under the centered h2, rather than as a third alignment
                  the page forgot about. The count tells a skimmer how much of
                  the section each tier actually is. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-[#111111] pb-3">
                <h3 className="text-[clamp(1.4rem,2.2vw,1.9rem)] leading-tight font-black text-[#111111] uppercase">
                  {tier.label}
                </h3>
                <p className="text-[13px] font-black tracking-[0.12em] text-slate-500 uppercase">
                  {items.length} {items.length === 1 ? "story" : "stories"}
                </p>
              </div>
              <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed font-semibold text-slate-700">
                {tier.note}
              </p>
              <ul className="mt-8 grid gap-x-8 gap-y-12 lg:grid-cols-2">
                {items.map((operator) => (
                  <li key={operator.id} className="min-w-0">
                    <OperatorCard operator={operator} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="mt-14 text-center">
          <Link
            href={preCallOperators.moreCta.href}
            className="text-base font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]"
          >
            {preCallOperators.moreCta.label}
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * One operator. Most are a Vidalytics video; the hardest-start tier includes
 * members whose story is a published /case-studies article rather than a
 * video, so those render their pull quote and link to the article instead.
 */
function OperatorCard({
  operator,
}: {
  operator: (typeof preCallOperators.items)[number];
}) {
  const embedId = "embedId" in operator ? operator.embedId : null;
  const href = "href" in operator ? operator.href : null;
  const quote = "quote" in operator ? operator.quote : null;

  return (
    <>
      <h4 className="text-[clamp(1.25rem,2vw,1.6rem)] leading-tight font-black text-[#111111]">
        {operator.name}
      </h4>
      <p className="mt-2 text-[13px] font-black tracking-[0.08em] text-[#111111] uppercase">
        {operator.stats.join(" \u00b7 ")}
      </p>
      {embedId ? (
        <VidalyticsPlayer
          embedId={embedId}
          loadOn="click"
          title={operator.name}
          className="mt-5"
        />
      ) : (
        quote && (
          <blockquote className="mt-5 rounded-[12px] border-2 border-[#111111] bg-white p-6 shadow-[8px_8px_0_#111111]">
            <p className="text-[18px] leading-relaxed font-black text-[#111111]">
              &ldquo;{quote}&rdquo;
            </p>
          </blockquote>
        )
      )}
      <p className="mt-5 text-[16px] leading-relaxed font-semibold text-slate-700">
        {operator.blurb}
      </p>
      {href && (
        <p className="mt-4">
          <Link
            href={href}
            className="text-base font-black text-[#066a99] underline underline-offset-4 hover:text-[#111111]"
          >
            Read {operator.name}&rsquo;s story
          </Link>
        </p>
      )}
    </>
  );
}

function PreCallPrep() {
  return (
    <section className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {preCallPrep.eyebrow}
        </p>
        <h2 className="mx-auto mt-4 max-w-[22ch] text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-balance text-[#111111] uppercase">
          {preCallPrep.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-center text-[17px] leading-relaxed font-semibold text-slate-700">
          {preCallPrep.body}
        </p>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
