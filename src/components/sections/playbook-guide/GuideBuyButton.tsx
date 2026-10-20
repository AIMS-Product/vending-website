import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface GuideBuyButtonProps {
  label: string;
  className?: string;
  /** Carried from a secret test link (?promo=...) to the checkout route. */
  promo?: string;
}

/**
 * A plain form POST that the server turns into a Stripe Checkout redirect:
 * works before hydration, and no price ever comes from the browser.
 */
export function GuideBuyButton({
  label,
  className,
  promo,
}: GuideBuyButtonProps) {
  return (
    <form
      action="/api/playbook-guide/checkout"
      method="post"
      className="contents"
    >
      {promo ? <input type="hidden" name="promo" value={promo} /> : null}
      <button
        type="submit"
        className={buttonClass({
          size: "lg",
          className: cn("min-h-14 w-full sm:w-auto", className),
        })}
      >
        <span>{label}</span>
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-full bg-[#111111] text-white transition group-hover:translate-x-0.5"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </form>
  );
}
