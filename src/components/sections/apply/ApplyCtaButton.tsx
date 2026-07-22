import { APPLY_QUIZ_ANCHOR } from "@/lib/content/apply-page";
import { cn } from "@/lib/utils";

// Every "I'm Ready to Build My Route" CTA on the page is a same-page anchor to
// the quiz section. A plain <a href="#..."> gives native (CSS smooth) scrolling
// without any client JS; the styling mirrors the site's Button primitive.

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
      className={cn(
        "group inline-flex items-center justify-center gap-3 rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 active:shadow-[3px_3px_0_#111111]",
        size === "lg"
          ? "min-h-13 px-7 py-3.5 text-sm"
          : "min-h-11 px-6 py-3 text-sm",
        className,
      )}
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
