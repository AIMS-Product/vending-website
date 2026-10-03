import Link from "next/link";
import {
  ADMIN_ANALYTICS_RANGES,
  ADMIN_ANALYTICS_RANGE_KEYS,
  recentWeekRanges,
  resolveAdminAnalyticsRange,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";

/*
 * Date controls shared by the analytics drill-downs. The dashboard itself
 * (/admin/analytics) has its own window control; see dashboard/.
 */

/** Segmented range switcher. Plain links so the page stays a Server Component. */
export function AnalyticsRangeTabs({
  active,
  includeInternal = false,
  tab = "overview",
  hrefFor,
}: {
  active: AdminAnalyticsRangeKey;
  includeInternal?: boolean;
  tab?: string;
  /** Set by a page that is not /admin/analytics and keeps its own URL shape. */
  hrefFor?: (key: AdminAnalyticsRangeKey) => string;
}) {
  return (
    <div
      className="border-ui-line rounded-ui bg-ui-surface shadow-ui inline-flex border p-0.5"
      role="group"
      aria-label="Date range"
    >
      {ADMIN_ANALYTICS_RANGE_KEYS.map((key) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={
              hrefFor ? hrefFor(key) : analyticsHref(key, includeInternal, tab)
            }
            aria-current={isActive ? "page" : undefined}
            // Selection is a soft fill. A filled dark segment would be a second
            // filled control competing with the page's primary button.
            className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] font-medium transition ${
              isActive
                ? "bg-ui-accent-soft text-ui-accent"
                : "text-ui-text-muted hover:text-ui-text"
            }`}
          >
            {ADMIN_ANALYTICS_RANGES[key].label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Named Mon-Sun weeks, so a whole week can be pulled without knowing its dates.
 *
 * The option values are `custom:` range keys the page already parses, so this
 * adds no server vocabulary: it is the existing custom window with the dates
 * filled in. Submits on change where JS is available and falls back to the
 * button otherwise, keeping the page a Server Component.
 */
export function AnalyticsWeekPicker({
  active,
  includeInternal = false,
  tab = "overview",
  today,
  action = "/admin/analytics",
}: {
  active: AdminAnalyticsRangeKey;
  includeInternal?: boolean;
  tab?: string;
  today: string;
  action?: string;
}) {
  const weeks = recentWeekRanges(today);
  if (weeks.length === 0) return null;
  const selected = weeks.find((week) => week.key === active)?.key ?? "";

  return (
    <form
      method="get"
      action={action}
      className="border-ui-line rounded-ui bg-ui-surface shadow-ui flex items-center gap-1.5 border px-2 py-1"
      aria-label="Whole week"
    >
      {tab && tab !== "overview" ? (
        <input type="hidden" name="tab" value={tab} />
      ) : null}
      {includeInternal ? (
        <input type="hidden" name="internal" value="1" />
      ) : null}
      <label
        className="text-ui-text-subtle text-[0.75rem] font-medium"
        htmlFor="range-week"
      >
        Week
      </label>
      <select
        id="range-week"
        name="range"
        defaultValue={selected}
        className="border-ui-line text-ui-text rounded-[4px] border bg-transparent px-1.5 py-0.5 text-[0.8125rem]"
      >
        <option value="">Pick a week…</option>
        {weeks.map((week) => (
          <option key={week.key} value={week.key}>
            {week.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="text-ui-accent hover:bg-ui-accent-soft rounded-[4px] px-1.5 py-0.5 text-[0.8125rem] font-medium transition"
      >
        Go
      </button>
    </form>
  );
}

/**
 * Explicit start/end window. A plain GET form with two native date inputs: no
 * picker library, no client component, and the browser does the validation.
 * The reply carries `from`/`to`, which the page folds back into a single
 * `range=custom:...` key so every tab and toggle link keeps the window.
 */
export function AnalyticsCustomRange({
  active,
  includeInternal = false,
  tab = "overview",
  today,
  action = "/admin/analytics",
}: {
  active: AdminAnalyticsRangeKey;
  includeInternal?: boolean;
  tab?: string;
  /** Latest selectable day, passed in so the server renders one stable value. */
  today: string;
  action?: string;
}) {
  const resolved = resolveAdminAnalyticsRange(
    active,
    new Date(`${today}T00:00:00.000Z`),
  );
  const endDay = resolved.endDay ?? today;
  const startDay =
    resolved.startDay ??
    new Date(
      Date.parse(`${endDay}T00:00:00.000Z`) - (resolved.days - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
  const isCustom = Boolean(resolved.startDay);

  return (
    <form
      method="get"
      action={action}
      className="border-ui-line rounded-ui bg-ui-surface shadow-ui flex items-center gap-1.5 border px-2 py-1"
      aria-label="Custom date range"
    >
      {tab && tab !== "overview" ? (
        <input type="hidden" name="tab" value={tab} />
      ) : null}
      {includeInternal ? (
        <input type="hidden" name="internal" value="1" />
      ) : null}
      <label
        className="text-ui-text-subtle text-[0.75rem] font-medium"
        htmlFor="range-from"
      >
        From
      </label>
      <input
        id="range-from"
        type="date"
        name="from"
        required
        max={today}
        defaultValue={startDay}
        className="border-ui-line text-ui-text rounded-[4px] border bg-transparent px-1.5 py-0.5 text-[0.8125rem]"
      />
      <label
        className="text-ui-text-subtle text-[0.75rem] font-medium"
        htmlFor="range-to"
      >
        to
      </label>
      <input
        id="range-to"
        type="date"
        name="to"
        required
        max={today}
        defaultValue={endDay}
        className="border-ui-line text-ui-text rounded-[4px] border bg-transparent px-1.5 py-0.5 text-[0.8125rem]"
      />
      <button
        type="submit"
        className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] font-medium transition ${
          isCustom
            ? "bg-ui-accent-soft text-ui-accent"
            : "text-ui-text-muted hover:text-ui-text"
        }`}
      >
        Apply
      </button>
    </form>
  );
}

export function AnalyticsInternalToggle({
  range,
  includeInternal,
  excludedCount,
  tab,
}: {
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  excludedCount: number;
  tab: string;
}) {
  return (
    <Link
      href={analyticsHref(range, !includeInternal, tab)}
      className="border-ui-line text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text rounded-ui bg-ui-surface shadow-ui inline-flex items-center gap-2 border px-2.5 py-1.5 text-[0.8125rem] font-medium transition"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${
          includeInternal
            ? "border-ui-accent bg-ui-accent text-white"
            : "border-ui-line-strong bg-ui-surface"
        }`}
      >
        {includeInternal ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      Include test &amp; internal leads
      {!includeInternal && excludedCount > 0 ? (
        <span className="text-ui-text-subtle">({excludedCount} hidden)</span>
      ) : null}
    </Link>
  );
}

/** The analytics views that live on their own path under /admin/analytics. */
const ANALYTICS_VIEW_PATHS: Readonly<Record<string, string>> = {
  channels: "/admin/analytics/channels",
  youtube: "/admin/analytics/youtube",
  video: "/admin/analytics/video",
};

function analyticsHref(
  range: AdminAnalyticsRangeKey,
  includeInternal: boolean,
  tab?: string,
): string {
  const params = new URLSearchParams({ range });
  if (includeInternal) params.set("internal", "1");
  return `${ANALYTICS_VIEW_PATHS[tab ?? ""] ?? "/admin/analytics"}?${params.toString()}`;
}

/**
 * Every analytics view key the trust bar has a feed list for. The first five
 * still have a page; the rest were folded into the dashboard in 2026-10 and
 * are kept only so old trust-bar scopes and their tests stay valid.
 */
export const ANALYTICS_TABS = [
  { key: "channels", label: "Channels" },
  { key: "youtube", label: "YouTube" },
  { key: "video", label: "Pre-call video" },
  { key: "close", label: "Close view" },
  { key: "mom", label: "Month over month" },
  { key: "overview", label: "Overview (retired)" },
  { key: "acquisition", label: "Acquisition (retired)" },
  { key: "pages", label: "Pages & funnel (retired)" },
  { key: "quality", label: "Lead quality (retired)" },
  { key: "journeys", label: "Journeys (retired)" },
  { key: "map", label: "Funnel map (retired)" },
  { key: "booked", label: "Booked calls (retired)" },
  { key: "won", label: "Closed-won (retired)" },
  { key: "exec", label: "Executive (retired)" },
  { key: "kpi", label: "KPI (retired)" },
  { key: "funnels", label: "Funnels by month (retired)" },
] as const;

export type AnalyticsTabKey = (typeof ANALYTICS_TABS)[number]["key"];
