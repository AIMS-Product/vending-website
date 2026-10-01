import { Button } from "@/components/ui/Button";
import { PRICE } from "@/lib/content/playbook";
import { cn } from "@/lib/utils";

interface PlaybookCtaProps {
  href: string;
  label: string;
  className?: string;
}

/**
 * Every buy button on /playbook: one link to the GHL order form. Full width
 * below sm so every phone CTA is the same 56px bar.
 */
export function PlaybookCta({ href, label, className }: PlaybookCtaProps) {
  return (
    <Button
      href={href}
      size="lg"
      showArrow
      className={cn("min-h-14 w-full sm:w-auto", className)}
    >
      {label}
    </Button>
  );
}

/** $199 struck, $67, and the save line: the compact price tag. */
export function PriceTag({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}
    >
      <span className="text-ink/55 text-xl font-black line-through">
        <span className="sr-only">Was </span>
        {PRICE.anchor}
      </span>
      <span className="v2-display text-brand-700 text-5xl leading-none">
        <span className="sr-only">Now </span>
        {PRICE.today}
      </span>
      <span className="text-sm font-bold">{PRICE.save}</span>
    </div>
  );
}

interface CheckListProps {
  items: readonly string[];
  className?: string;
}

/** Bullet list with the brand check mark, for chapter and bonus points. */
export function CheckList({ items, className }: CheckListProps) {
  return (
    <ul className={cn("space-y-2.5 leading-snug", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="square"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/** Anton section headline. */
export const H2 =
  "v2-display text-ink text-[clamp(2.3rem,4.6vw,3.75rem)] leading-[1.02] uppercase";
export const EYEBROW =
  "text-eyebrow text-xs font-black tracking-[0.14em] uppercase";
/** Oversized outlined numeral used for chapters and steps. */
export const NUMERAL = "v2-display v2-outline leading-none tabular-nums";
