import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PlaybookCtaProps {
  href: string;
  label: string;
  className?: string;
}

/** Every buy button on /playbook: one link to the GHL order form. */
export function PlaybookCta({ href, label, className }: PlaybookCtaProps) {
  return (
    <Button href={href} size="lg" showArrow className={className}>
      {label}
    </Button>
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
/** Oversized outlined numeral used for chapters, steps and bonuses. */
export const NUMERAL = "v2-display v2-outline leading-none tabular-nums";
