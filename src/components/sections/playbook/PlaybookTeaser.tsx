import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { PRICE, hero, playbookHref } from "@/lib/content/playbook";

interface PlaybookTeaserProps {
  /** The host page's searchParams; attribution and prefill carry to /playbook. */
  searchParams?: Record<string, string | string[] | undefined>;
  className?: string;
}

/** Compact offer card another page can drop in. Not wired anywhere yet. */
export function PlaybookTeaser({
  searchParams,
  className,
}: PlaybookTeaserProps) {
  return (
    <Card className={className}>
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
        {hero.eyebrow}
      </p>
      <p className="mt-3 flex items-baseline gap-3">
        <span className="text-ink/60 text-xl font-black line-through">
          {PRICE.anchor}
        </span>
        <span className="text-brand-700 text-4xl font-black">
          {PRICE.today}
        </span>
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-snug">
        {hero.teaserBullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="bg-brand-600 mt-1.5 size-2 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={playbookHref(searchParams)}
        className={buttonClass({ size: "md", className: "mt-5 w-full" })}
      >
        See the Playbook
      </Link>
    </Card>
  );
}
