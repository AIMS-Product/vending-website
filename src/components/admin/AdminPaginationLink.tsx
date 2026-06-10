import Link from "next/link";

const baseClass =
  "flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none";

function PaginationChevron({ next }: { next: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={next ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"}
      />
    </svg>
  );
}

export function AdminPaginationLink({
  href,
  label,
  disabled = false,
  next = false,
}: {
  href: string;
  label: string;
  disabled?: boolean;
  next?: boolean;
}) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className={`${baseClass} cursor-not-allowed text-slate-300`}
      >
        <PaginationChevron next={next} />
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${baseClass} text-slate-700 transition hover:bg-slate-50 hover:text-slate-950`}
    >
      <PaginationChevron next={next} />
    </Link>
  );
}
