import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  showText?: boolean;
};

export function Wordmark({ className, showText = true }: WordmarkProps) {
  return (
    <span
      className={cn("text-brand-500 inline-flex items-center gap-2", className)}
    >
      <VMark className="size-9" />
      {showText && (
        <span className="text-xl font-semibold tracking-tight">
          <span className="font-bold">Vending</span>preneurs
        </span>
      )}
    </span>
  );
}

function VMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="vmark-grad" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="var(--brand-300)" />
          <stop offset="100%" stopColor="var(--brand-500)" />
        </linearGradient>
      </defs>
      {/* horizontal bar across the top */}
      <rect
        x="6"
        y="10"
        width="36"
        height="3"
        rx="1.5"
        fill="url(#vmark-grad)"
      />
      {/* left wing of V */}
      <path d="M9 16 L24 38 L24 30 L15 16 Z" fill="url(#vmark-grad)" />
      {/* right wing of V */}
      <path
        d="M39 16 L24 38 L24 30 L33 16 Z"
        fill="url(#vmark-grad)"
        opacity="0.85"
      />
    </svg>
  );
}
