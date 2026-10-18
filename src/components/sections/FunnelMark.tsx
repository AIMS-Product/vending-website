import { cn } from "@/lib/utils";

interface FunnelMarkProps {
  keep: boolean;
}

/** Check (do this) or cross (stop doing this) beside a cheat-sheet rule. */
export function FunnelMark({ keep }: FunnelMarkProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn(
        "mt-0.5 size-5 shrink-0",
        keep ? "text-[#066a99]" : "text-slate-400",
      )}
    >
      <circle
        cx="10"
        cy="10"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {keep ? (
        <path
          d="M6 10.5l2.5 2.5L14 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M7 7l6 6M13 7l-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
