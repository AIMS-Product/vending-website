import Link from "next/link";
import {
  DASHBOARD_WINDOW_LABELS,
  DASHBOARD_WINDOW_PRESETS,
  type DashboardWindow,
  type DashboardWindowKey,
} from "@/lib/analytics/dashboard-window";

/** The analytics URL for a window, keeping the marketing-only switch. */
function analyticsHref(
  key: DashboardWindowKey,
  window: DashboardWindow,
  marketingOnly: boolean,
): string {
  const query = new URLSearchParams();
  if (key.startsWith("custom:")) {
    query.set("from", window.startDay);
    query.set("to", window.endDay);
  } else if (key !== "30d") {
    query.set("range", key);
  }
  if (marketingOnly) query.set("marketing", "1");
  const qs = query.toString();
  return qs ? `/admin/analytics?${qs}` : "/admin/analytics";
}

const segmentClass = (active: boolean) =>
  `rounded-[4px] px-2.5 py-1 text-[0.8125rem] font-medium whitespace-nowrap transition ${
    active
      ? "bg-ui-accent-soft text-ui-accent"
      : "text-ui-text-muted hover:text-ui-text"
  }`;

/**
 * Presets as links, a custom range as a GET form with native date inputs.
 * No client code: the URL is the state, so a view can be shared as a link.
 */
export function DashboardWindowControl({
  window,
}: {
  window: DashboardWindow;
}) {
  const custom = window.key.startsWith("custom:");
  const marketingOnly = Boolean(window.marketingOnly);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="border-ui-line rounded-ui bg-ui-surface shadow-ui inline-flex border p-0.5"
        role="group"
        aria-label="Which calls count"
      >
        {[
          { label: "All calls", on: false },
          { label: "Marketing only", on: true },
        ].map((option) => (
          <Link
            key={option.label}
            href={analyticsHref(window.key, window, option.on)}
            aria-current={option.on === marketingOnly ? "page" : undefined}
            title={
              option.on
                ? "Keep only calls the marketing team booked (Lane 2 and Social DMs left out)"
                : undefined
            }
            className={segmentClass(option.on === marketingOnly)}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <div
        className="border-ui-line rounded-ui bg-ui-surface shadow-ui inline-flex max-w-full overflow-x-auto border p-0.5"
        role="group"
        aria-label="Date range"
      >
        {DASHBOARD_WINDOW_PRESETS.map((key) => {
          const active = key === window.key;
          return (
            <Link
              key={key}
              href={analyticsHref(key, window, marketingOnly)}
              aria-current={active ? "page" : undefined}
              className={segmentClass(active)}
            >
              {DASHBOARD_WINDOW_LABELS[key]}
            </Link>
          );
        })}
      </div>
      <form
        method="get"
        action="/admin/analytics"
        aria-label="Custom range"
        className={`rounded-ui shadow-ui flex flex-wrap items-center gap-1.5 border px-2 py-1 ${
          custom
            ? "border-ui-accent bg-ui-accent-soft"
            : "border-ui-line bg-ui-surface"
        }`}
      >
        {marketingOnly ? (
          <input type="hidden" name="marketing" value="1" />
        ) : null}
        <label className="sr-only" htmlFor="range-from">
          From
        </label>
        <input
          id="range-from"
          type="date"
          name="from"
          required
          max={window.today}
          defaultValue={custom ? window.startDay : undefined}
          className="text-ui-text rounded-[4px] bg-transparent text-[0.8125rem] tabular-nums"
        />
        <span className="text-ui-text-subtle text-xs" aria-hidden="true">
          to
        </span>
        <label className="sr-only" htmlFor="range-to">
          To
        </label>
        <input
          id="range-to"
          type="date"
          name="to"
          required
          max={window.today}
          defaultValue={custom ? window.endDay : undefined}
          className="text-ui-text rounded-[4px] bg-transparent text-[0.8125rem] tabular-nums"
        />
        <button
          type="submit"
          className="text-ui-accent hover:bg-ui-accent-soft rounded-[4px] px-1.5 py-0.5 text-[0.8125rem] font-medium"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
