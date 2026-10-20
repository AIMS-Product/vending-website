import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { LtfVariant } from "@/lib/ltf/assignment";
import { LTF_PATHS } from "@/lib/ltf/assignment";

interface GuideBuyButtonProps {
  variant: LtfVariant;
  label: string;
  className?: string;
}

/**
 * The only thing that differs between the test's two versions. A: link to
 * the GHL checkout embed. B: a plain form POST that the server turns into a
 * Stripe Checkout redirect (works before hydration, no client price).
 */
export function GuideBuyButton({
  variant,
  label,
  className,
}: GuideBuyButtonProps) {
  const classes = cn("min-h-14 w-full sm:w-auto", className);
  if (variant === "a") {
    return (
      <Button
        href={LTF_PATHS.ghlCheckout}
        size="lg"
        showArrow
        className={classes}
      >
        {label}
      </Button>
    );
  }
  return (
    <form
      action="/api/playbook-guide/checkout"
      method="post"
      className={cn("contents")}
    >
      <button
        type="submit"
        className={buttonClass({ size: "lg", className: classes })}
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
