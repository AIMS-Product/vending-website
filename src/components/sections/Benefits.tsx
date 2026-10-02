import type { Benefit } from "@/lib/content/home";

export function BenefitIcon({ icon }: { icon: Benefit["icon"] }) {
  switch (icon) {
    case "trend":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <path
            d="M4 17l5-5 4 4 7-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 7h6v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "people":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <circle
            cx="9"
            cy="9"
            r="3.25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="17"
            cy="10"
            r="2.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5M14 17c2.8 0 5 1.5 5 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "percent":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <path
            d="M5 19L19 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="7.5"
            cy="7.5"
            r="2.25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="16.5"
            cy="16.5"
            r="2.25"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
