import { cn } from "@/lib/utils";

// The money-phrase block from the funnel hero. An inline-block, so the line
// box grows to fit it instead of the fill painting over the lines above and
// below (a plain inline background covers Anton's whole content area).
export function Highlight({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "bg-brand-600 my-[0.08em] inline-block px-[0.08em] leading-[1.08] whitespace-nowrap text-white shadow-[0.08em_0.08em_0_#111111]",
        className,
      )}
    >
      {children}
    </span>
  );
}
