"use client";

import { useState } from "react";
import {
  AdminIcon,
  AdminStatusBadge,
  adminInputClass,
  adminPanelClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import { CopyButton } from "@/components/admin/CopyButton";
import {
  checkLinkStandard,
  isShareableLink,
  parseLinkUtms,
  UTM_KEYS,
  utmTupleKey,
  type LinkUtms,
} from "@/lib/analytics/link-standard";
import type { RegistryLink } from "@/lib/services/marketing-links";
import { cn } from "@/lib/utils";

type Filter = "all" | "built" | "imported" | "fix";
type Sort = "newest" | "leads";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "built", label: "Built here" },
  { key: "imported", label: "Imported" },
  { key: "fix", label: "Needs fixing" },
];

const PAGE = 50;

export function MarketingLinkRegistry({
  links,
  statsFailed,
  onStartFrom,
}: {
  links: RegistryLink[];
  statsFailed: boolean;
  onStartFrom: (link: RegistryLink) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("leads");
  const [limit, setLimit] = useState(PAGE);

  const pasted = parseLinkUtms(query.trim());
  const pastedKey =
    pasted && UTM_KEYS.some((key) => query.includes(key))
      ? utmTupleKey(pasted)
      : null;

  const pastedMatch = pastedKey
    ? (links.find((link) => keyOf(link) === pastedKey) ?? null)
    : null;

  const visible = links
    .filter((link) => matchesFilter(link, filter))
    .filter((link) =>
      pastedKey ? keyOf(link) === pastedKey : matchesText(link, query),
    )
    .sort((a, b) =>
      sort === "leads"
        ? (b.stats?.leads ?? 0) - (a.stats?.leads ?? 0) ||
          b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at),
    );

  const counts = {
    all: links.length,
    built: links.filter((link) => !link.imported).length,
    imported: links.filter((link) => link.imported).length,
    fix: links.filter((link) => link.problems.length > 0).length,
  };

  return (
    <section className={adminPanelClass} aria-label="Link registry">
      <div className="border-ui-line space-y-3 border-b p-4">
        <div>
          <h2 className="text-ui-text text-base font-semibold">Every link</h2>
          <p className="text-ui-text-muted mt-1 text-sm">
            Each row shows what its link brought in, all time. A lead counts for
            a link only when it arrived with all five of that link&apos;s tags.
            Imported rows are links that were already out before this builder;
            rebuild one with Use as template.
          </p>
        </div>
        {statsFailed ? (
          <p role="alert" className="text-ui-bad text-sm">
            Results could not load, so they show as a dash. The links are still
            correct; reload to try again.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">
              Search links or paste one to check it
            </span>
            <span className="text-ui-text-subtle pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 [&_svg]:size-4">
              <AdminIcon icon="search" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search, or paste any link to check it"
              className={cn(adminInputClass, "pl-8")}
            />
          </label>
          <div
            role="group"
            aria-label="Show"
            className="flex flex-wrap gap-1.5"
          >
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => {
                  setFilter(item.key);
                  setLimit(PAGE);
                }}
                className={cn(
                  adminSmallButtonClass,
                  filter === item.key &&
                    "border-ui-accent text-ui-accent bg-ui-accent-soft",
                )}
              >
                {item.label}
                <span className="tabular-nums opacity-70">
                  {counts[item.key]}
                </span>
              </button>
            ))}
          </div>
          <label className="text-ui-text-muted inline-flex items-center gap-2 text-sm">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className={cn(adminInputClass, "h-8 w-auto py-0")}
            >
              <option value="leads">Most leads</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
        {pastedKey ? (
          <PastedCheck
            url={query.trim()}
            utms={pasted!}
            match={pastedMatch}
            onStartFrom={onStartFrom}
          />
        ) : null}
      </div>

      {/* relative: keeps the sr-only "Actions" header inside the scroll box;
          without it the absolute span escapes and the page scrolls sideways. */}
      <div className="relative overflow-x-auto">
        <table className="divide-ui-line w-full min-w-[60rem] divide-y text-left text-sm">
          <thead className="bg-ui-canvas text-ui-text-subtle text-xs font-semibold uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Link
              </th>
              <Num>Leads</Num>
              <Num>Booked</Num>
              <Num title="Calendly bookings made straight from the link">
                Calendar
              </Num>
              <Num>Clicks</Num>
              <th scope="col" className="px-4 py-2.5">
                Last lead
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-ui-line bg-ui-surface divide-y">
            {visible.slice(0, limit).map((link) => (
              <LinkRow key={link.id} link={link} onStartFrom={onStartFrom} />
            ))}
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-ui-text-subtle px-4 py-8 text-center text-sm"
                >
                  {links.length === 0
                    ? "No links yet. Build the first one above."
                    : "No link matches. Clear the search or pick All."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {visible.length > limit ? (
        <div className="border-ui-line border-t p-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((current) => current + PAGE * 4)}
            className={adminSmallButtonClass}
          >
            Show more ({visible.length - limit} left)
          </button>
        </div>
      ) : null}
    </section>
  );
}

function LinkRow({
  link,
  onStartFrom,
}: {
  link: RegistryLink;
  onStartFrom: (link: RegistryLink) => void;
}) {
  const shareUrl = link.bitly_url ?? link.url;
  const shareable = isShareableLink(link);
  return (
    <tr className="align-top">
      <td className="max-w-[28rem] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ui-text font-medium break-all">
            {link.utm_campaign || "(no campaign)"}
          </span>
          {link.utm_term ? (
            <span className="text-ui-accent bg-ui-accent-soft rounded-ui px-1.5 py-0.5 text-xs font-semibold">
              {link.utm_term}
            </span>
          ) : null}
          {link.imported ? (
            <AdminStatusBadge status="imported" label="Imported" tone="idle" />
          ) : null}
        </div>
        <p className="text-ui-text-muted mt-0.5 text-xs break-all">
          {[link.utm_source, link.utm_medium, link.utm_content]
            .map((value) => value || "–")
            .join(" · ")}
        </p>
        {link.label ? (
          <p className="text-ui-text-subtle mt-0.5 text-xs">{link.label}</p>
        ) : null}
        {link.problems.length > 0 ? (
          <p className="text-ui-warn-ink mt-0.5 text-xs">
            {link.problems[0]}
            {link.problems.length > 1
              ? ` (+${link.problems.length - 1} more)`
              : ""}
          </p>
        ) : null}
        {shareable ? (
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            title={link.url}
            className="text-ui-accent mt-0.5 block truncate text-xs underline-offset-2 hover:underline"
          >
            {shareUrl}
          </a>
        ) : (
          <p className="text-ui-text-subtle mt-0.5 text-xs">
            Seen on Calendly bookings; the calendar page was not recorded.
          </p>
        )}
      </td>
      <Cell value={link.stats?.leads} strong />
      <Cell value={link.stats?.booked} />
      <Cell value={link.stats?.calendarBookings} />
      <Cell value={link.stats ? link.stats.clicks : undefined} />
      <td className="text-ui-text-muted px-4 py-2.5 text-xs whitespace-nowrap tabular-nums">
        {link.stats?.lastLeadAt?.slice(0, 10) ?? "–"}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1.5">
          {shareable ? <CopyButton value={shareUrl} /> : null}
          <button
            type="button"
            onClick={() => onStartFrom(link)}
            className={adminSmallButtonClass}
          >
            Use as template
          </button>
        </div>
      </td>
    </tr>
  );
}

function PastedCheck({
  url,
  utms,
  match,
  onStartFrom,
}: {
  url: string;
  utms: LinkUtms;
  match: RegistryLink | null;
  onStartFrom: (link: RegistryLink) => void;
}) {
  const check = checkLinkStandard(url);
  if (match) {
    return (
      <p
        role="status"
        className="text-ui-ok-ink bg-ui-ok-fill rounded-ui px-3 py-2 text-sm"
      >
        In the registry
        {match.stats
          ? `: ${match.stats.leads} leads, ${match.stats.booked} booked, ${match.stats.calendarBookings} calendar bookings.`
          : "."}
        {check.compliant
          ? ""
          : " It is not on the standard, so rebuild it before using it again."}
      </p>
    );
  }
  return (
    <div role="status" className="bg-ui-warn-fill rounded-ui px-3 py-2 text-sm">
      <p className="text-ui-warn-ink font-medium">
        Not in the registry, so it shows nowhere here.
        {check.compliant ? "" : ` ${check.problems.join(" ")}`}
      </p>
      <button
        type="button"
        onClick={() => onStartFrom(linkFromPasted(url, utms))}
        className={cn(adminSmallButtonClass, "mt-2")}
      >
        Build it properly
      </button>
    </div>
  );
}

function Num({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <th scope="col" title={title} className="px-4 py-2.5 text-right">
      {children}
    </th>
  );
}

function Cell({
  value,
  strong,
}: {
  value: number | null | undefined;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 text-right tabular-nums",
        strong ? "text-ui-text font-semibold" : "text-ui-text-muted",
      )}
    >
      {value === null || value === undefined ? "–" : value.toLocaleString()}
    </td>
  );
}

function keyOf(link: RegistryLink): string {
  return utmTupleKey({
    source: link.utm_source,
    medium: link.utm_medium,
    campaign: link.utm_campaign,
    content: link.utm_content,
    term: link.utm_term,
  });
}

function matchesFilter(link: RegistryLink, filter: Filter): boolean {
  if (filter === "built") return !link.imported;
  if (filter === "imported") return link.imported;
  if (filter === "fix") return link.problems.length > 0;
  return true;
}

function matchesText(link: RegistryLink, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    link.utm_source,
    link.utm_medium,
    link.utm_campaign,
    link.utm_content,
    link.utm_term,
    link.label,
    link.url,
    link.bitly_url,
  ].some((value) => value?.toLowerCase().includes(needle));
}

/** A pasted link as a registry-shaped row, so "Build it properly" can pre-fill. */
function linkFromPasted(url: string, utms: LinkUtms): RegistryLink {
  const base = new URL(url);
  for (const key of UTM_KEYS) base.searchParams.delete(key);
  return {
    id: "pasted",
    url,
    base_url: base.toString(),
    utm_source: utms.source ?? "",
    utm_medium: utms.medium ?? "",
    utm_campaign: utms.campaign ?? "",
    utm_content: utms.content ?? "",
    utm_term: utms.term ?? "",
    label: null,
    bitly_id: null,
    bitly_url: null,
    created_by: "",
    created_at: "",
    clicks_synced_at: null,
    imported: false,
    problems: [],
    stats: null,
  };
}
