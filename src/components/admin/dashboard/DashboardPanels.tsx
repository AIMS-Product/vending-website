import Link from "next/link";
import type { ReactNode } from "react";
import {
  AdminBar,
  AdminDeltaChip,
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
  adminLinkClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  ChannelFlowChart,
  FLOW_COLORS,
} from "@/components/admin/dashboard/ChannelFlowChart";
import {
  Sparkline,
  TrendChart,
} from "@/components/admin/dashboard/DashboardCharts";
import {
  FLOW_CHANNELS,
  buildChannelFlow,
  flowChannelForFunnel,
} from "@/lib/analytics/channel-flow";
import {
  bySetter,
  capturedByChannel,
  costPerBookedByMonth,
  countInRange,
  dailyCounts,
  deltaPct,
  inRange,
  keptCalls,
  monthKeys,
  planBooked,
  sameDayLastWeek,
  showRateHeld,
  sparkPoints,
  windowPlanTarget,
} from "@/lib/analytics/dashboard-metrics";
import {
  REPORTING_TIME_ZONE,
  addDays,
  type DashboardWindow,
  type DayRange,
} from "@/lib/analytics/dashboard-window";
import { isYes } from "@/lib/services/close-week-view";
import {
  callSpan,
  leadsNotInClose,
  readBookedOn,
  readCac,
  readCalls,
  readDeals,
  readFacts,
  readLeads,
  readTrust,
  spineSpan,
  type Read,
} from "@/lib/services/analytics-dashboard-data";

/*
 * The cards of /admin/analytics. Each is its own async server component
 * behind its own Suspense boundary, reads only the sources it needs (shared
 * per request), and says plainly when a source is empty or unreadable. A
 * number on screen always names its METRICS.md section in its card's source line.
 */

const num = (n: number) => n.toLocaleString("en-US");
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
const stamp = (iso: string | null) =>
  iso
    ? `${new Date(iso).toLocaleString("en-US", {
        timeZone: REPORTING_TIME_ZONE,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} ET`
    : "never";

/** At least 14 days ending where the window ends, so a short window still has a line. */
function sparkRange(window: DashboardWindow): DayRange {
  return window.days >= 14
    ? window
    : { startDay: addDays(window.endDay, -13), endDay: window.endDay };
}

// ── Shared card chrome ──────────────────────────────────────────────────

function DashboardCard({
  title,
  source,
  action,
  id,
  className = "",
  children,
}: {
  title: string;
  /** Where the numbers come from, in plain words, with the METRICS.md section. */
  source: string;
  action?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={`${adminCardClass} min-w-0 scroll-mt-6 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={adminSectionTitleClass}>{title}</h2>
          <p className="text-ui-text-subtle mt-0.5 text-xs">{source}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function CardMessage({
  tone,
  children,
}: {
  tone: "empty" | "error";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-ui border px-3 py-6 text-center text-sm ${
        tone === "error"
          ? "border-ui-bad-fill bg-ui-bad-fill/40 text-ui-bad-ink"
          : "border-ui-line bg-ui-canvas text-ui-text-muted"
      }`}
    >
      {children}
    </div>
  );
}

/** The first failed read, as a card message; null when every read is fine. */
function failed(...reads: Read<unknown>[]): ReactNode {
  const bad = reads.find((r) => !r.ok);
  return bad && !bad.ok ? (
    <CardMessage tone="error">
      {bad.error} The rest of the page is unaffected;{" "}
      <Link className={adminLinkClass} href="/admin/data">
        check data health
      </Link>
      .
    </CardMessage>
  ) : null;
}

export function CardSkeleton({
  height = "h-40",
  label,
}: {
  height?: string;
  label: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className={`${adminCardClass} bg-ui-canvas ${height} animate-pulse`}
    />
  );
}

function Delta({
  value,
  better = "up",
}: {
  value: number | null;
  better?: "up" | "down";
}) {
  if (value === null) return null;
  const good = better === "up" ? value > 0 : value < 0;
  return (
    <AdminDeltaChip tone={value === 0 ? "neutral" : good ? "up" : "down"}>
      {value > 0 ? "+" : ""}
      {value}%
    </AdminDeltaChip>
  );
}

// ── Header chip: what needs you today ───────────────────────────────────

export async function AttentionChip({ window }: { window: DashboardWindow }) {
  const span = callSpan(window);
  const [booked, stuck, trust] = await Promise.all([
    readBookedOn([window.today]),
    leadsNotInClose(span.from, window.today),
    readTrust(),
  ]);
  const calls = booked.ok
    ? (booked.data[window.today]?.onCalendar ?? null)
    : null;
  const failing = trust.problems.filter((p) => p.tone === "bad").length;
  const items: Array<{
    href: string;
    text: string;
    tone: "ok" | "warn" | "bad";
  }> = [
    {
      href: "/admin/bookings",
      text:
        calls === null
          ? "Calls today unknown"
          : `${num(calls)} first call${calls === 1 ? "" : "s"} today`,
      tone: calls === null ? "warn" : "ok",
    },
    {
      href: "/admin/leads",
      text:
        stuck === null
          ? "Lead hand-off unknown"
          : `${num(stuck)} lead${stuck === 1 ? "" : "s"} not in Close`,
      tone: stuck === null || stuck > 0 ? "warn" : "ok",
    },
    {
      href: "/admin/data",
      text: failing
        ? `${failing} source${failing === 1 ? "" : "s"} failing`
        : "All sources current",
      tone: failing ? "bad" : "ok",
    },
  ];
  return (
    <nav
      aria-label="Needs attention today"
      className="flex flex-wrap items-center gap-1.5"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-ui inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.8125rem] font-medium whitespace-nowrap tabular-nums transition hover:opacity-80 ${
            item.tone === "bad"
              ? "border-ui-bad-fill bg-ui-bad-fill text-ui-bad-ink"
              : item.tone === "warn"
                ? "border-ui-warn-fill bg-ui-warn-fill text-ui-warn-ink"
                : "border-ui-line bg-ui-surface text-ui-text"
          }`}
        >
          {item.text}
        </Link>
      ))}
    </nav>
  );
}

// ── Today strip ─────────────────────────────────────────────────────────

export async function TodayStrip({ window }: { window: DashboardWindow }) {
  const today = window.today;
  const yesterday = addDays(today, -1);
  const lastWeek = sameDayLastWeek(today);
  const days = [today, yesterday, lastWeek];
  const span = callSpan(window);
  const [booked, leads, calls] = await Promise.all([
    readBookedOn(days),
    readLeads(span.from),
    readCalls(span.from, span.to),
  ]);
  const onDay = (d: string) => ({ startDay: d, endDay: d });
  const leadsOn = (d: string) =>
    leads.ok ? countInRange(leads.data, (l) => l.day, onDay(d)) : null;
  const outcomes = (d: string) => {
    if (!calls.ok) return null;
    const list = keptCalls(calls.data).filter((c) => c.bookedDate === d);
    const showed = list.filter((c) => isYes(c.showUp)).length;
    const noShow = list.filter(
      (c) => (c.showUp ?? "").trim().toLowerCase() === "no",
    ).length;
    return { showed, noShow, unlogged: list.length - showed - noShow };
  };
  const o = days.map(outcomes);
  const cells: Array<{
    label: string;
    values: Array<number | null>;
    note?: string;
    source: string;
  }> = [
    {
      label: "Calls booked today",
      values: days.map((d) =>
        booked.ok ? (booked.data[d]?.newBooked ?? null) : null,
      ),
      source: "New calls booked, Lane 2 out (§5)",
    },
    {
      label: "First calls on the calendar",
      values: days.map((d) =>
        booked.ok ? (booked.data[d]?.onCalendar ?? null) : null,
      ),
      source: "Close first calls dated today (§5)",
    },
    {
      label: "Leads in today",
      values: days.map(leadsOn),
      source: "Site leads, people (§4)",
    },
    {
      label: "Showed so far",
      values: o.map((x) => x?.showed ?? null),
      note: o[0]
        ? `${num(o[0].noShow)} no-show · ${num(o[0].unlogged)} not logged yet`
        : undefined,
      source: "Rep-logged first-call show (§6)",
    },
  ];
  return (
    <section aria-label="Today" className={`${adminPanelClass} mb-4`}>
      <div className="divide-ui-line grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
        {cells.map((cell) => {
          const [now, prev, week] = cell.values;
          return (
            <div key={cell.label} className="min-w-0 px-4 py-3.5">
              <p className={adminEyebrowClass}>{cell.label}</p>
              <p className="text-ui-text mt-2 text-2xl leading-none font-semibold tabular-nums">
                {now === null ? "–" : num(now)}
              </p>
              <p className="text-ui-text-muted mt-1.5 text-xs tabular-nums">
                Yesterday {prev === null ? "–" : num(prev)} · Last{" "}
                {weekday(lastWeek)} {week === null ? "–" : num(week)}
              </p>
              {cell.note ? (
                <p className="text-ui-text-subtle mt-0.5 text-xs tabular-nums">
                  {cell.note}
                </p>
              ) : null}
              <p className="text-ui-text-subtle mt-1 text-[0.6875rem]">
                {cell.source}
              </p>
            </div>
          );
        })}
      </div>
      {!booked.ok || !leads.ok || !calls.ok ? (
        <p
          role="alert"
          className="border-ui-line text-ui-bad-ink border-t px-4 py-2 text-xs"
        >
          {[booked, leads, calls]
            .flatMap((r) => (r.ok ? [] : [r.error]))
            .join(" ")}{" "}
          A dash means not read, never zero.
        </p>
      ) : null}
    </section>
  );
}

// ── KPI strip ───────────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  delta,
  caption,
  spark,
  href,
}: {
  label: string;
  value: string;
  delta: ReactNode;
  caption: ReactNode;
  spark: number[] | null;
  href?: string;
}) {
  const body = (
    <>
      <p className={adminEyebrowClass}>{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ui-text text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
          {value}
        </span>
        {delta}
      </p>
      <p className="text-ui-text-muted mt-1.5 text-xs tabular-nums">
        {caption}
      </p>
      <div className="mt-2">
        {spark ? <Sparkline data={spark} /> : <div className="h-8" />}
      </div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="hover:bg-ui-canvas block min-w-0 px-4 py-3.5 transition"
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-0 px-4 py-3.5">{body}</div>
  );
}

export async function KpiStrip({ window }: { window: DashboardWindow }) {
  const span = callSpan(window);
  const spark = sparkRange(window);
  const dealsFrom = [window.prior.startDay, spark.startDay].sort()[0]!;
  const [leads, calls, deals, cac] = await Promise.all([
    readLeads(span.from),
    readCalls(span.from, span.to),
    readDeals(dealsFrom, window.today),
    readCac(),
  ]);
  const prior = window.prior;
  const cells: ReactNode[] = [];

  if (leads.ok) {
    const now = countInRange(leads.data, (l) => l.day, window);
    const before = countInRange(leads.data, (l) => l.day, prior);
    cells.push(
      <KpiCell
        key="leads"
        label="Leads"
        value={num(now)}
        delta={<Delta value={deltaPct(now, before)} />}
        caption={`People on site forms · ${num(before)} before`}
        spark={sparkPoints(dailyCounts(leads.data, (l) => l.day, spark))}
        href="/admin/leads"
      />,
    );
  } else
    cells.push(
      <KpiCell
        key="leads"
        label="Leads"
        value="–"
        delta={null}
        caption={leads.error}
        spark={null}
      />,
    );

  if (calls.ok) {
    const kept = keptCalls(calls.data);
    const inWindow = kept.filter((c) => inRange(c.bookedDate, window));
    const before = kept.filter((c) => inRange(c.bookedDate, prior)).length;
    const reactivation = inWindow.filter(
      (c) => flowChannelForFunnel(c.funnel) === "reactivation",
    ).length;
    const show = showRateHeld(calls.data, window, window.today);
    const showBefore = showRateHeld(calls.data, prior, window.today);
    const showDaily = dailyCounts(kept, (c) => c.bookedDate, spark).map(
      ({ day }) => {
        const r = showRateHeld(
          calls.data,
          { startDay: day, endDay: day },
          window.today,
        ).rate;
        return { value: r ?? 0 };
      },
    );
    cells.push(
      <KpiCell
        key="booked"
        label="Booked calls"
        value={num(inWindow.length)}
        delta={<Delta value={deltaPct(inWindow.length, before)} />}
        caption={`${num(inWindow.length - reactivation)} marketing · ${num(reactivation)} reactivation`}
        spark={sparkPoints(dailyCounts(kept, (c) => c.bookedDate, spark))}
        href="#bookings"
      />,
      <KpiCell
        key="show"
        label="Show rate"
        value={show.rate === null ? "–" : `${show.rate.toFixed(1)}%`}
        delta={
          show.rate !== null && showBefore.rate !== null ? (
            <AdminDeltaChip tone={show.rate >= showBefore.rate ? "up" : "down"}>
              {show.rate >= showBefore.rate ? "+" : ""}
              {(show.rate - showBefore.rate).toFixed(1)} pts
            </AdminDeltaChip>
          ) : null
        }
        caption={
          show.held
            ? `${num(show.showed)} of ${num(show.held)} calls held`
            : "No calls held yet in this window"
        }
        spark={showDaily.length > 1 ? showDaily.map((d) => d.value) : null}
      />,
    );
  } else {
    cells.push(
      <KpiCell
        key="booked"
        label="Booked calls"
        value="–"
        delta={null}
        caption={calls.error}
        spark={null}
      />,
      <KpiCell
        key="show"
        label="Show rate"
        value="–"
        delta={null}
        caption={calls.error}
        spark={null}
      />,
    );
  }

  if (deals.ok) {
    const sum = (r: DayRange) =>
      deals.data
        .filter((d) => inRange(d.dateWon, r))
        .reduce((s, d) => s + (d.value ?? 0), 0);
    const won = deals.data.filter((d) => inRange(d.dateWon, window)).length;
    const now = sum(window);
    cells.push(
      <KpiCell
        key="won"
        label="Revenue won"
        value={money(now)}
        delta={<Delta value={deltaPct(now, sum(prior))} />}
        caption={`${num(won)} deal${won === 1 ? "" : "s"} won, by date won`}
        spark={sparkPoints(
          dailyCounts(deals.data, (d) => d.dateWon, spark).map(({ day }) => ({
            value: sum({ startDay: day, endDay: day }),
          })),
        )}
        href="#flow"
      />,
    );
  } else
    cells.push(
      <KpiCell
        key="won"
        label="Revenue won"
        value="–"
        delta={null}
        caption={deals.error}
        spark={null}
      />,
    );

  if (cac.ok && cac.data.some((p) => p.cac !== null)) {
    const points = cac.data.filter((p) => p.cac !== null);
    const last = points.at(-1)!;
    const prev = points.at(-2) ?? null;
    const current = window.today.slice(0, 7);
    cells.push(
      <KpiCell
        key="cac"
        label={`CAC · ${last.label.split(" ")[0]}`}
        value={money(last.cac!)}
        delta={
          <Delta value={deltaPct(last.cac, prev?.cac ?? null)} better="down" />
        }
        caption={
          last.month < current
            ? `${new Date(`${current}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} not entered yet`
            : "Blended, monthly model"
        }
        spark={points.length > 1 ? points.map((p) => p.cac!) : null}
        href="/admin/cac"
      />,
    );
  } else {
    cells.push(
      <KpiCell
        key="cac"
        label="CAC"
        value="–"
        delta={null}
        caption={cac.ok ? "No month has CAC inputs yet" : cac.error}
        spark={null}
        href="/admin/cac"
      />,
    );
  }

  return (
    <section aria-label="Key numbers" className={`${adminPanelClass} mb-4`}>
      <div className="divide-ui-line grid divide-y sm:grid-cols-3 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
        {cells}
      </div>
      <p className="border-ui-line text-ui-text-subtle border-t px-4 py-2 text-[0.6875rem]">
        {window.label}, {dayLabel(window.startDay)} – {dayLabel(window.endDay)},
        against {dayLabel(prior.startDay)} – {dayLabel(prior.endDay)}. Leads §4
        · Booked §5 Close mirror, SteelTrap rule §3 · Show rate §7 calls held ·
        Revenue §8 · CAC §10.
      </p>
    </section>
  );
}

// ── Hero: channel flow ──────────────────────────────────────────────────

export async function FlowCard({ window }: { window: DashboardWindow }) {
  const span = callSpan(window);
  const spine = spineSpan(window);
  const [calls, facts, deals] = await Promise.all([
    readCalls(span.from, span.to),
    readFacts(spine.from, spine.to),
    readDeals(window.startDay, window.today),
  ]);
  const error = failed(calls, facts, deals);
  const flow =
    calls.ok && facts.ok && deals.ok
      ? buildChannelFlow({
          calls: calls.data.filter((c) => inRange(c.bookedDate, window)),
          captured: capturedByChannel(facts.data, window),
          wins: deals.data.filter((d) => d.dateWon >= window.startDay),
        })
      : null;
  return (
    <DashboardCard
      id="flow"
      title="Every channel, from capture to sale"
      source="Captured: leads and contacts on the channel spine (§4, UTC days). Booked onward: Close first calls in the window and what became of them to date (§5, §6, §16)."
      action={
        <Link
          href="/admin/analytics/channels"
          className={`${adminLinkClass} text-[0.8125rem]`}
        >
          Channel detail
        </Link>
      }
    >
      {error ??
        (flow && flow.totals[1] + flow.totals[0] > 0 ? (
          <>
            <ChannelFlowChart flow={flow} />
            <p className="text-ui-text-subtle mt-3 text-xs tabular-nums">
              {num(flow.excluded)} first calls left out by the SteelTrap rule.{" "}
              {flow.qualifiedWithoutShow
                ? `${num(flow.qualifiedWithoutShow)} qualified with no show logged; counted as qualified, never as a show. `
                : ""}
              {flow.unvalued
                ? `${num(flow.unvalued)} won deals carry no value in Close. `
                : ""}
              Chatbot leads are in Website & search, where Close files their
              calls.
            </p>
          </>
        ) : (
          <CardMessage tone="empty">
            No captures or first calls in {window.label.toLowerCase()}. Try a
            wider window.
          </CardMessage>
        ))}
    </DashboardCard>
  );
}

// ── Bookings ────────────────────────────────────────────────────────────

function BarList({
  rows,
  total,
}: {
  rows: Array<{ label: string; value: number; color?: string }>;
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.8125rem]">
            <span className="text-ui-text-muted flex min-w-0 items-center gap-2">
              {row.color ? (
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: row.color }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="text-ui-text tabular-nums">
              {num(row.value)}
              <span className="text-ui-text-subtle ml-1.5 text-xs">
                {total ? `${Math.round((row.value / total) * 100)}%` : ""}
              </span>
            </span>
          </div>
          <AdminBar share={row.value / max} />
        </li>
      ))}
    </ul>
  );
}

export async function BookingsCard({ window }: { window: DashboardWindow }) {
  const span = callSpan(window);
  const calls = await readCalls(span.from, span.to);
  if (!calls.ok) {
    return (
      <DashboardCard
        id="bookings"
        title="Booked calls"
        source="Close first calls (§5)"
      >
        {failed(calls)}
      </DashboardCard>
    );
  }
  const inWindow = calls.data.filter((c) => inRange(c.bookedDate, window));
  const kept = keptCalls(inWindow);
  const target = windowPlanTarget(window);
  const plan = planBooked(calls.data, window);
  const share = target ? plan / target : null;
  const byChannel = FLOW_CHANNELS.map((c) => ({
    label: c.label,
    color: FLOW_COLORS[c.key],
    value: kept.filter((k) => flowChannelForFunnel(k.funnel) === c.key).length,
  }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const setters = bySetter(inWindow).slice(0, 8);
  return (
    <DashboardCard
      id="bookings"
      title="Booked calls"
      source="Close first calls in the window, SteelTrap rule (§5). Target: the booking plan (§11), on its own basis."
      action={
        <Link
          href="/admin/bookings"
          className={`${adminLinkClass} text-[0.8125rem]`}
        >
          Booking ledger
        </Link>
      }
    >
      {kept.length === 0 ? (
        <CardMessage tone="empty">
          No first calls dated in {window.label.toLowerCase()}.
        </CardMessage>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-ui-text text-3xl font-semibold tracking-tight tabular-nums">
              {num(kept.length)}
            </span>
            {target !== null && share !== null ? (
              <AdminStatusBadge
                status={
                  share >= 1 ? "ahead" : share >= 0.9 ? "close" : "behind"
                }
                label={`${Math.round(share * 100)}% of plan`}
                tone={share >= 1 ? "ok" : share >= 0.9 ? "warn" : "bad"}
              />
            ) : null}
          </div>
          <p className="text-ui-text-muted mt-1 text-xs tabular-nums">
            {target === null
              ? "The booking plan starts in September 2026; no target for this window."
              : `Plan channels booked ${num(plan)} against a target of ${num(target)} for these days (cancellations included, as the plan counts them).`}
          </p>
          {share !== null ? (
            <div className="mt-3">
              <AdminBar share={Math.min(1, share)} />
            </div>
          ) : null}
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className={`${adminEyebrowClass} mb-2.5`}>By channel</h3>
              <BarList rows={byChannel} total={kept.length} />
            </div>
            <div>
              <h3 className={`${adminEyebrowClass} mb-2.5`}>
                By setter, as Close records it (§12)
              </h3>
              <BarList rows={setters} total={kept.length} />
            </div>
          </div>
        </>
      )}
    </DashboardCard>
  );
}

// ── Cost per booked call ────────────────────────────────────────────────

export async function CostCard({ window }: { window: DashboardWindow }) {
  const spine = spineSpan(window);
  const facts = await readFacts(spine.from, spine.to);
  const current = window.today.slice(0, 7);
  const months = monthKeys(addDays(`${current}-01`, -150), window.today);
  const rows = facts.ok ? costPerBookedByMonth(facts.data, months) : [];
  const monthName = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
  return (
    <DashboardCard
      title="Cost per booked call"
      source="Ad spend over channel bookings, by complete month (§9). The running month is shown as so far, never as the trend."
    >
      {failed(facts) ??
        (rows.length === 0 ? (
          <CardMessage tone="empty">
            No ad spend recorded in the last six months.
          </CardMessage>
        ) : (
          <ul className="divide-ui-line border-ui-line divide-y border-t">
            {rows.map((row) => {
              // A month two days old swings by hundreds of percent; compare whole months.
              const complete = row.months.filter((m) => m.month < current);
              const priced = complete.filter((m) => m.cost !== null);
              const last = complete.at(-1);
              const prev = complete.at(-2);
              const running = row.months.find((m) => m.month === current);
              const change = deltaPct(last?.cost ?? null, prev?.cost ?? null);
              return (
                <li
                  key={row.key}
                  className={`grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-4 py-3 ${row.key === "blended" ? "bg-ui-canvas -mx-5 px-5" : ""}`}
                >
                  <span className="text-ui-text truncate text-[0.8125rem]">
                    {row.label}
                  </span>
                  {priced.length > 1 ? (
                    <Sparkline
                      data={priced.map((m) => m.cost!)}
                      color={
                        row.key === "blended"
                          ? "var(--ui-text-muted)"
                          : FLOW_COLORS[row.key]
                      }
                    />
                  ) : (
                    <span className="text-ui-text-subtle text-xs">
                      Too few months to plot
                    </span>
                  )}
                  <span className="text-right">
                    <span className="text-ui-text flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums">
                      <span className="text-ui-text-subtle text-xs font-normal">
                        {last ? monthName(last.month) : ""}
                      </span>
                      {last?.cost == null ? "–" : money(last.cost)}
                      <Delta value={change} better="down" />
                    </span>
                    <span className="text-ui-text-subtle mt-0.5 block text-xs tabular-nums">
                      {running
                        ? `${monthName(current)} so far ${running.cost === null ? `${money(running.spend)} spent, ${num(running.booked)} booked` : money(running.cost)}`
                        : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
    </DashboardCard>
  );
}

// ── Trend ───────────────────────────────────────────────────────────────

export async function TrendCard({ window }: { window: DashboardWindow }) {
  const span = callSpan(window);
  const range = sparkRange(window);
  const [leads, calls] = await Promise.all([
    readLeads(span.from),
    readCalls(span.from, span.to),
  ]);
  const error = failed(leads, calls);
  const leadSeries = leads.ok
    ? dailyCounts(leads.data, (l) => l.day, range)
    : [];
  const callSeries = calls.ok
    ? dailyCounts(keptCalls(calls.data), (c) => c.bookedDate, range)
    : [];
  const empty = [...leadSeries, ...callSeries].every((d) => d.value === 0);
  return (
    <DashboardCard
      title="Leads and booked calls per day"
      source={`Site leads by the day they arrived (§4); Close first calls by the day they are dated (§5).${range === window ? "" : " Shown over 14 days so the line has a shape."}`}
    >
      {error ??
        (empty ? (
          <CardMessage tone="empty">
            Nothing arrived or was booked in these days.
          </CardMessage>
        ) : (
          <TrendChart
            labels={leadSeries.map((d) => dayLabel(d.day))}
            series={[
              {
                name: "Leads",
                data: leadSeries.map((d) => d.value),
                color: "var(--ui-chart-7)",
              },
              {
                name: "Booked calls",
                data: callSeries.map((d) => d.value),
                color: "var(--ui-chart-1)",
              },
            ]}
          />
        ))}
    </DashboardCard>
  );
}

// ── Sync health footer ──────────────────────────────────────────────────

export async function SyncFooter() {
  const trust = await readTrust();
  const tone = (t: "ok" | "warn" | "bad", connected: boolean) =>
    !connected ? "idle" : t;
  return (
    <section aria-label="Data sources" className={`${adminCardClass} mt-5`}>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>
          Where these numbers come from
        </h2>
        <p className="text-ui-text-muted text-xs">
          Last night&apos;s check:{" "}
          {trust.audit.error
            ? "could not be read"
            : trust.audit.ranLastNight
              ? `${trust.audit.passed} of ${trust.audit.total} agreed with the source`
              : "did not run"}
          {" · "}
          <Link href="/admin/data" className={adminLinkClass}>
            Data trust
          </Link>
        </p>
      </header>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {trust.feeds.map((feed) => (
          <li
            key={feed.feed}
            className="flex min-w-0 items-center justify-between gap-2 text-[0.8125rem]"
          >
            <span className="min-w-0">
              <span className="text-ui-text block truncate">{feed.label}</span>
              <span className="text-ui-text-subtle block truncate text-xs">
                {feed.connected
                  ? `Updated ${stamp(feed.lastSuccessAt)}`
                  : (feed.problem ?? "Not connected")}
              </span>
            </span>
            <AdminStatusBadge
              status={feed.tone}
              tone={tone(feed.tone, feed.connected)}
              label={
                !feed.connected
                  ? "Not connected"
                  : feed.tone === "ok"
                    ? "Current"
                    : feed.tone === "warn"
                      ? "Late"
                      : "Failing"
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
