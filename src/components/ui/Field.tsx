import { cn } from "@/lib/utils";

// Every public form field. 52px tall (min-h-13 also pins <select>, which
// otherwise renders 2px shorter than an input), 16px text so iOS never zooms.
export const fieldClass =
  "min-h-13 w-full rounded-control border-2 border-ink bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2d9fd6] focus:ring-2 focus:ring-sky";

export const fieldErrorClass = "border-red-300 focus:ring-red-200";

export function FieldLabel({
  htmlFor,
  required,
  className,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium text-slate-700", className)}
    >
      {children}
      {required ? (
        <>
          <span className="ml-0.5 text-[#c2410c]" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : (
        <span className="ml-1 font-normal text-slate-600"> (optional)</span>
      )}
    </label>
  );
}
