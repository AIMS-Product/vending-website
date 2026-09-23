import { APPLY_QUIZ_ANCHOR } from "@/lib/content/apply-page";
import { buttonClass } from "@/components/ui/Button";

// Every "I'm Ready to Build My Route" CTA on the page is a same-page anchor to
// the quiz section. A plain <a href="#..."> gives native (CSS smooth) scrolling
// without any client JS. The shell is the site's Button (buttonClass), so the
// funnel CTAs sit on the same 48 / 56px sizes as every other button.

type Size = "md" | "lg";

export function ApplyCtaButton({
  children,
  size = "lg",
  className,
}: {
  children: React.ReactNode;
  size?: Size;
  className?: string;
}) {
  return (
    <a
      href={`#${APPLY_QUIZ_ANCHOR}`}
      className={buttonClass({ size, className })}
    >
      <span>{children}</span>
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
    </a>
  );
}
