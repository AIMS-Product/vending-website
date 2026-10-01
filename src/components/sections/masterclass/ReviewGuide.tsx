import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { SENDER_EMAIL } from "@/lib/content/masterclass";
import { reviewCopy } from "@/lib/content/masterclass-review";
import { cn } from "@/lib/utils";

const isExternal = (href: string) => href.startsWith("http");

/** The page path a row points to, without the review UTMs. */
function pathOf(href: string) {
  const url = new URL(href, "https://www.vendingpreneurs.com");
  return isExternal(href)
    ? `${url.host}${url.pathname}`
    : `${url.pathname}${url.searchParams.has("first") ? url.search : ""}`;
}

/** Step CTA: wraps on a phone instead of pushing the card wider. */
function StepCta({ href, children }: { href: string; children: string }) {
  const className = (variant: "primary" | "ghost") =>
    buttonClass({
      variant,
      className: "h-auto min-h-12 w-full py-3 whitespace-normal sm:w-auto",
    });
  return isExternal(href) ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className("ghost")}
    >
      {children}
    </a>
  ) : (
    <Link href={href} className={className("primary")}>
      {children}
    </Link>
  );
}

/** Body text with the sender address set as a code chip that can wrap. */
function WithEmail({ text }: { text: string }) {
  const at = text.indexOf(SENDER_EMAIL);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <code className="bg-tint text-ink rounded-[4px] px-1.5 font-mono text-[14px] [overflow-wrap:anywhere]">
        {SENDER_EMAIL}
      </code>
      {text.slice(at + SENDER_EMAIL.length)}
    </>
  );
}

function NumberChip({ n }: { n: number }) {
  return (
    <span className="bg-brand-700 grid size-8 shrink-0 place-items-center rounded-md text-sm font-black text-white tabular-nums">
      {String(n).padStart(2, "0")}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand-700 size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const H2 = "text-ink mt-12 text-2xl font-black text-balance uppercase";

/** One page the team can follow to review and sign off the site funnel. */
export function ReviewGuide() {
  return (
    <main className="bg-tint min-h-screen">
      <div className="mx-auto max-w-[860px] px-5 py-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {reviewCopy.eyebrow}
        </p>
        <h1 className="text-ink mt-2 text-[clamp(2rem,5vw,3rem)] leading-none font-black text-balance uppercase">
          {reviewCopy.heading}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
          {reviewCopy.intro}
        </p>

        <div
          role="note"
          className="rounded-card border-ink mt-6 flex overflow-hidden border-2 bg-white"
        >
          <span className="bg-brand-700 border-ink grid w-12 shrink-0 place-items-center border-r-2 text-white">
            <InfoIcon />
          </span>
          <p className="text-ink p-4 text-[15px] leading-relaxed">
            {reviewCopy.note}
          </p>
        </div>

        <h2 className={H2}>{reviewCopy.stepsHeading}</h2>
        <ol className="mt-5 grid gap-4">
          {reviewCopy.steps.map((step, index) => {
            const cta = "cta" in step ? step.cta : undefined;
            return (
              <li
                key={step.title}
                className={cn(
                  "rounded-card border-ink flex min-w-0 flex-col gap-3 border-2 bg-white p-5 sm:flex-row sm:gap-4",
                  cta && "shadow-card",
                )}
              >
                <div className="flex items-center gap-3 sm:items-start">
                  <NumberChip n={index + 1} />
                  <p className="text-ink text-lg leading-tight font-black uppercase sm:hidden">
                    {step.title}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-ink hidden text-lg leading-tight font-black uppercase sm:block">
                    {step.title}
                  </p>
                  <p className="text-[15px] leading-relaxed [overflow-wrap:anywhere] text-slate-600 sm:mt-1">
                    <WithEmail text={step.body} />
                  </p>
                  {cta ? (
                    <div className="mt-4">
                      <StepCta href={cta.href}>{cta.label}</StepCta>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        <h2 className={H2}>{reviewCopy.flowHeading}</h2>
        <ol className="rounded-card border-ink mt-5 border-2 bg-white">
          {reviewCopy.flow.map((item, index) => (
            <li
              key={item.step}
              className="flex gap-4 border-b border-slate-200 p-4 last:border-b-0"
            >
              <NumberChip n={index + 1} />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="text-ink font-black [overflow-wrap:anywhere]">
                  {item.step}
                </p>
                <p className="text-sm [overflow-wrap:anywhere] text-slate-600">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className={H2}>{reviewCopy.pagesHeading}</h2>
        <ul className="rounded-card border-ink mt-5 grid overflow-hidden border-2 bg-white sm:grid-cols-2">
          {reviewCopy.pages.map((page) => {
            const external = isExternal(page.href);
            const row = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="text-ink block font-black">
                    {page.label}
                  </span>
                  <span className="block text-sm [overflow-wrap:anywhere] text-slate-500">
                    {external ? "external · " : ""}
                    {pathOf(page.href)}
                  </span>
                </span>
                <ArrowRightIcon />
              </>
            );
            const rowClass =
              "group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-tint focus-visible:bg-tint focus-visible:outline-none";
            return (
              <li
                key={page.href}
                className="border-b border-slate-200 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                {external ? (
                  <a
                    href={page.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={rowClass}
                  >
                    {row}
                  </a>
                ) : (
                  <Link href={page.href} className={rowClass}>
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
