import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { reviewCopy } from "@/lib/content/masterclass-review";

function Anchor({ href, children }: { href: string; children: string }) {
  const external = href.startsWith("http");
  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant: "ghost" })}
    >
      {children}
    </a>
  ) : (
    <Link href={href} className={buttonClass()}>
      {children}
    </Link>
  );
}

/** One page the team can follow to review and sign off the site funnel. */
export function ReviewGuide() {
  return (
    <main className="bg-tint min-h-screen">
      <div className="mx-auto max-w-[860px] px-5 py-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {reviewCopy.eyebrow}
        </p>
        <h1 className="text-ink mt-2 text-[clamp(2rem,5vw,3rem)] leading-none font-black uppercase">
          {reviewCopy.heading}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
          {reviewCopy.intro}
        </p>

        <h2 className="text-ink mt-12 text-2xl font-black uppercase">
          {reviewCopy.stepsHeading}
        </h2>
        <ol className="mt-5 grid gap-4">
          {reviewCopy.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-card border-ink shadow-card flex gap-4 border-2 bg-white p-5"
            >
              <span className="bg-brand-700 grid size-10 shrink-0 place-items-center rounded-md text-sm font-black text-white">
                0{index + 1}
              </span>
              <div>
                <p className="text-ink text-lg font-black uppercase">
                  {step.title}
                </p>
                <p className="mt-1 text-[15px] text-slate-600">{step.body}</p>
                {"cta" in step && step.cta ? (
                  <div className="mt-3">
                    <Anchor href={step.cta.href}>{step.cta.label}</Anchor>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <h2 className="text-ink mt-12 text-2xl font-black uppercase">
          {reviewCopy.flowHeading}
        </h2>
        <ol className="rounded-card border-ink mt-5 border-2 bg-white">
          {reviewCopy.flow.map((item, index) => (
            <li
              key={item.step}
              className="flex gap-4 border-b border-slate-200 p-4 last:border-b-0"
            >
              <span className="text-eyebrow w-6 shrink-0 font-black">
                {index + 1}
              </span>
              <div>
                <p className="text-ink font-black">{item.step}</p>
                <p className="text-sm text-slate-600">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="text-ink mt-12 text-2xl font-black uppercase">
          {reviewCopy.pagesHeading}
        </h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {reviewCopy.pages.map((page) => (
            <Anchor key={page.href} href={page.href}>
              {page.label}
            </Anchor>
          ))}
        </div>

        <p className="mt-10 border-l-4 border-[#2a8fcc] pl-4 text-sm text-slate-600">
          {reviewCopy.note}
        </p>
      </div>
    </main>
  );
}
