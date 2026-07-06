import { AdminTermHint } from "@/components/admin/AdminTermHint";
import {
  REDIRECT_STATUS_OPTIONS,
  redirectStatusPlainExplanation,
} from "./redirect-status-labels";

// I9: plain-English legend for the redirect-type field, shared by the create
// form and the per-row edit form. Technical labels ("Permanent move (301)")
// stay in each <select> for experts; this adds a hover/tap explanation of
// what each type actually does, without changing which codes are offered or
// how the field validates.
export function RedirectTypeLegend({
  heading = true,
}: {
  /** Set false in tighter layouts (e.g. the inline row editor). */
  heading?: boolean;
}) {
  return (
    <div>
      {heading ? (
        <span className="block text-xs font-medium text-slate-500">
          What does each redirect type mean?
        </span>
      ) : null}
      <ul
        className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 ${
          heading ? "mt-1" : ""
        }`}
      >
        {REDIRECT_STATUS_OPTIONS.map((option) => (
          <li key={option.code}>
            <AdminTermHint
              term={option.label}
              explanation={redirectStatusPlainExplanation(option.code)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
