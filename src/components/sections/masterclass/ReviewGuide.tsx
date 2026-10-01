import Link from "next/link";
import { Fragment } from "react";
import { anton } from "@/app/fonts";
import { MasterclassFooter } from "@/components/sections/masterclass/RegistrationSections";
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

/**
 * Step CTA: wraps on a phone instead of pushing the card wider. No button
 * shadow: the card already carries the sky shadow, so hover is colour only.
 */
function StepCta({ href, children }: { href: string; children: string }) {
  const className = (variant: "primary" | "ghost") =>
    buttonClass({
      variant,
      className: cn(
        "h-auto min-h-12 w-full py-3 whitespace-normal shadow-none hover:translate-y-0 hover:shadow-none active:shadow-none sm:w-auto",
        variant === "primary" && "hover:bg-[#185b84] active:bg-[#14496a]",
        variant === "ghost" && "active:bg-brand-100",
      ),
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

/** A path or URL with a break opportunity after each "/", never mid-word. */
function Slashed({ text }: { text: string }) {
  const parts = text.split("/");
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              /<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

/** Body text with the sender address set as a code chip that can wrap. */
function WithEmail({ text }: { text: string }) {
  const at = text.indexOf(SENDER_EMAIL);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <code className="bg-tint text-ink rounded-control px-1.5 font-mono text-[14px] [overflow-wrap:anywhere]">
        {SENDER_EMAIL}
      </code>
      {text.slice(at + SENDER_EMAIL.length)}
    </>
  );
}

function NumberChip({ n }: { n: number }) {
  return (
    <span className="bg-brand-700 rounded-control grid size-8 shrink-0 place-items-center text-sm font-black text-white tabular-nums">
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
      className="text-brand-700 mt-0.5 size-5 shrink-0"
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

const H2 =
  "v2-display text-ink mt-12 text-[2rem] leading-none text-balance uppercase";

/** One page the team can follow to review and sign off the site funnel. */
export function ReviewGuide() {
  return (
    <main className={cn(anton.variable, "bg-tint min-h-screen")}>
      <div className="mx-auto max-w-[860px] px-5 pt-14 pb-20">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {reviewCopy.eyebrow}
        </p>
        <h1 className="v2-display text-ink mt-2 text-[clamp(2.25rem,6vw,3.5rem)] leading-none text-balance uppercase">
          {reviewCopy.heading}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
          {reviewCopy.intro}
        </p>

        <div
          role="note"
          className="rounded-card border-ink border-l-brand-700 mt-6 flex gap-3 border-2 border-l-[6px] bg-white p-4"
        >
          <InfoIcon />
          <p className="text-ink text-[15px] leading-relaxed">
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
                className="rounded-card border-ink shadow-card flex min-w-0 flex-col gap-3 border-2 bg-white p-5 sm:flex-row sm:gap-4"
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
                  <p className="text-[15px] leading-relaxed break-words text-slate-600 sm:mt-1">
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
              className="flex items-start gap-4 border-b border-slate-200 p-4 last:border-b-0"
            >
              <NumberChip n={index + 1} />
              <div className="min-w-0 break-words">
                <p className="text-ink text-[15px] font-black">
                  <Slashed text={item.step} />
                </p>
                <p className="text-sm text-slate-600">
                  <Slashed text={item.detail} />
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
                    {external ? (
                      <span className="border-ink rounded-control ml-2 inline-block border px-1.5 align-middle text-[11px] font-black tracking-wide uppercase">
                        external
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm break-words text-slate-500">
                    <Slashed text={pathOf(page.href)} />
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
      <MasterclassFooter />
    </main>
  );
}
