import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { PRICE, hero, images, playbookHref } from "@/lib/content/playbook";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./PlaybookCta";

/** "Find it. Decide on..." -> lead "Find it." + the rest (styling only). */
function splitLead(text: string) {
  const end = text.indexOf(". ");
  return end === -1
    ? { lead: text, rest: "" }
    : { lead: text.slice(0, end + 1), rest: text.slice(end + 1) };
}

interface PlaybookTeaserProps {
  /** The host page's searchParams; attribution and prefill carry to /playbook. */
  searchParams?: Record<string, string | string[] | undefined>;
  className?: string;
}

/** The $67 offer as one card another page can drop in: mockup beside the price. */
export function PlaybookTeaser({
  searchParams,
  className,
}: PlaybookTeaserProps) {
  return (
    <div
      className={cn(
        "border-ink shadow-card rounded-card grid overflow-hidden border-2 bg-white md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="bg-tint border-ink v2-dots flex items-center justify-center overflow-hidden border-b-2 p-6 md:items-center md:border-r-2 md:border-b-0 lg:p-8">
        <Image
          src={images.productTrimmed.src}
          alt={images.productTrimmed.alt}
          width={images.productTrimmed.width}
          height={images.productTrimmed.height}
          sizes="(min-width: 768px) 640px, 100vw"
          className="h-auto w-full max-w-none object-contain"
        />
      </div>
      <div className="p-6 lg:p-8">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {hero.eyebrow}
        </p>
        <h2 className="v2-display text-ink mt-2 text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.02] text-balance uppercase">
          {hero.teaserHeadline}
        </h2>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-ink/55 text-xl font-black line-through">
            {PRICE.anchor}
          </span>
          <span className="v2-display text-brand-700 text-5xl leading-none">
            {PRICE.today}
          </span>
          <span className="text-sm font-bold">{PRICE.save}</span>
        </p>
        <ul className="mt-5 space-y-2.5 text-[0.95rem] leading-snug">
          {hero.teaserBullets.map((b) => {
            const { lead, rest } = splitLead(b);
            return (
              <li key={b} className="flex gap-3">
                <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
                <span>
                  <strong className="text-ink font-black">{lead}</strong>
                  {rest}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href={playbookHref(searchParams)}
          className={buttonClass({ size: "lg", className: "mt-6 w-full" })}
        >
          See the Playbook
        </Link>
      </div>
    </div>
  );
}
