"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  retryCloseSyncEvent,
  type LeadAdminActionState,
} from "@/app/admin/leads/actions";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminCardClass,
  adminPanelClass,
  adminSecondaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import type {
  AdminCloseSyncEventSummary,
  AdminLeadDetail,
  AdminLeadListItem,
} from "@/lib/services/lead-admin";

const initialActionState: LeadAdminActionState = { status: "idle" };

const lifecycleFilters = [
  { value: "all", label: "All" },
  { value: "qualification_pending", label: "Pending" },
  { value: "qualified", label: "Qualified" },
  { value: "qualification_stale", label: "Stale" },
  { value: "qualification_expired", label: "Expired" },
] as const;

const syncFilters = [
  { value: "all", label: "All sync" },
  { value: "pending", label: "Pending sync" },
  { value: "retrying", label: "Retrying" },
  { value: "failed", label: "Failed sync" },
  { value: "needs_review", label: "Needs review" },
  { value: "dead_letter", label: "Permanently failed" },
  { value: "synced", label: "Synced" },
] as const;

const retryableStatuses = new Set(["failed", "needs_review", "dead_letter"]);

// I6: internal Close sync enum/DB values stay unchanged — this only swaps the
// admin-facing label and caption for "dead_letter" so admins see plain
// language instead of queue jargon. AdminStatusBadge's generic formatter
// would otherwise render this as "Dead letter".
const DEAD_LETTER_CAPTION =
  "We stopped retrying after repeated failures — needs manual attention.";

function CloseSyncStatusBadge({ status }: { status: string }) {
  if (status === "dead_letter") {
    return (
      <span className="grid gap-1">
        <span className="inline-flex w-fit rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          Permanently failed
        </span>
        <span className="text-xs text-slate-500">{DEAD_LETTER_CAPTION}</span>
      </span>
    );
  }
  return <AdminStatusBadge status={status} />;
}

function SyncIssuesBanner({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="font-semibold">
        {count} {count === 1 ? "lead is" : "leads are"} stuck because Close sync
        keeps failing — these need manual attention.
      </p>
      <a
        href="#sync-issues-table"
        className="mt-2 inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none sm:mt-0"
      >
        Fix now
      </a>
    </div>
  );
}

export function AdminLeadsManager({
  activeCloseSyncStatus,
  activeLifecycleStatus,
  leads,
}: {
  activeCloseSyncStatus: string;
  activeLifecycleStatus: string;
  leads: AdminLeadListItem[];
}) {
  const pendingCount = leads.filter(
    (lead) => lead.lifecycleStatus === "qualification_pending",
  ).length;
  const qualifiedCount = leads.filter(
    (lead) => lead.lifecycleStatus === "qualified",
  ).length;
  const failedSyncCount = leads.filter((lead) =>
    ["failed", "needs_review", "dead_letter"].includes(
      lead.closeSyncStatus ?? "",
    ),
  ).length;

  return (
    <div className="grid gap-5">
      {/* I7: the amber metric card alone buried the one actionable problem
          below the fold on mobile. A prominent banner now surfaces sync
          failures in plain English with a direct jump to the affected rows. */}
      <SyncIssuesBanner count={failedSyncCount} />

      <AdminMetricStrip>
        <AdminMetricPanel
          icon="mail"
          tone="blue"
          label="Visible"
          value={leads.length}
          caption="leads"
        />
        <AdminMetricPanel
          icon="filter"
          tone="amber"
          label="Pending"
          value={pendingCount}
          caption="qualification"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Qualified"
          value={qualifiedCount}
          caption="completed"
        />
        <AdminMetricPanel
          icon="shield"
          tone={failedSyncCount ? "amber" : "slate"}
          label="Sync issues"
          value={failedSyncCount}
          caption="recoverable"
        />
      </AdminMetricStrip>

      <section id="sync-issues-table" className={adminPanelClass}>
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Lead backstop
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Review captured leads, qualification progress, source
                attribution, and Close sync recovery state.
              </p>
            </div>
            <div className="grid gap-2 xl:grid-cols-2">
              <FilterNav
                activeValue={activeLifecycleStatus}
                ariaLabel="Lifecycle filters"
                param="lifecycle"
                options={lifecycleFilters}
                otherParam="sync"
                otherValue={activeCloseSyncStatus}
              />
              <FilterNav
                activeValue={activeCloseSyncStatus}
                ariaLabel="Close sync filters"
                param="sync"
                options={syncFilters}
                otherParam="lifecycle"
                otherValue={activeLifecycleStatus}
              />
            </div>
          </div>
        </div>

        {leads.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Lead
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lifecycle
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Qualification
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Close sync
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No leads match these filters
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Change lifecycle or Close sync filters to review captured leads.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminLeadDetailView({ lead }: { lead: AdminLeadDetail }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* I2: the root layout already provides the main#main-content
          landmark, so this is a plain container — nesting a second main
          landmark here tripped axe's landmark-no-duplicate-main rule. */}
      <div className="grid gap-5">
        <section className={adminCardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {lead.fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{lead.email}</p>
              {lead.phone ? (
                <p className="mt-1 text-sm text-slate-600">{lead.phone}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge status={lead.lifecycleStatus} />
              {lead.closeSyncStatus ? (
                <CloseSyncStatusBadge status={lead.closeSyncStatus} />
              ) : null}
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailMetric label="Source" value={lead.sourcePath} />
            <DetailMetric label="Page" value={lead.sourcePageSlug} />
            <DetailMetric label="Experiment" value={lead.experimentKey} />
            <DetailMetric label="Variant" value={lead.variantKey} />
          </dl>
        </section>

        <section className={adminCardClass}>
          <h2 className="text-base font-semibold text-slate-950">
            Qualification answers
          </h2>
          <div className="mt-4 grid gap-3">
            {lead.answers.length ? (
              lead.answers.map((answer) => (
                <div
                  key={answer.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        {answer.questionLabel}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700">
                        {answer.displayValue}
                      </p>
                    </div>
                    {answer.normalizedRole ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {formatStatus(answer.normalizedRole)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No qualification answers have been saved yet.
              </p>
            )}
          </div>
        </section>

        <section className={adminCardClass}>
          <h2 className="text-base font-semibold text-slate-950">
            Qualification sessions
          </h2>
          <div className="mt-4 grid gap-3">
            {lead.sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AdminStatusBadge status={session.status} />
                  <span className="text-xs font-semibold text-slate-500">
                    {session.answerCount} answers
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <DetailMetric
                    label="Experiment"
                    value={session.experimentKey}
                  />
                  <DetailMetric label="Variant" value={session.variantKey} />
                  <DetailMetric
                    label="Started"
                    value={formatDate(session.startedAt)}
                  />
                  <DetailMetric
                    label="Completed"
                    value={formatDate(session.completedAt)}
                  />
                </dl>
                <SummaryList summary={session.normalizedSummary} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* I2: this rail is editor chrome inside AdminShell's section region,
          not page-complementary content — a complementary landmark here
          tripped axe's landmark-complementary-is-top-level rule. A plain div
          keeps the visuals without the nested landmark role (see
          NewsEditorForm.landmarks.test.ts precedent). */}
      <div className="grid content-start gap-5">
        <section className={adminCardClass}>
          <h2 className="text-sm font-semibold text-slate-950">Close sync</h2>
          <p className="mt-2 text-sm text-slate-600">
            Failed and review-needed events can be queued for the retry runner.
          </p>
          <div className="mt-4 grid gap-3">
            {lead.closeSyncEvents.length ? (
              lead.closeSyncEvents.map((event) => (
                <CloseSyncEventCard
                  key={event.id}
                  event={event}
                  leadId={lead.id}
                />
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No Close sync events are attached to this lead.
              </p>
            )}
          </div>
        </section>

        <section className={adminCardClass}>
          <h2 className="text-sm font-semibold text-slate-950">
            Source details
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <DetailMetric label="VP session" value={lead.vpSessionId} />
            <DetailMetric label="First landing" value={lead.firstLandingPath} />
            <DetailMetric
              label="Latest landing"
              value={lead.latestLandingPath}
            />
            <DetailMetric label="Landing path" value={lead.landingPath} />
            <DetailMetric label="Source path" value={lead.sourcePath} />
            <DetailMetric label="Block" value={lead.sourceBlockId} />
            <DetailMetric label="CTA" value={lead.sourceCtaTrackingName} />
            <DetailMetric label="Clicked href" value={lead.clickedHref} />
          </dl>

          {/* I6(b): ad-tech acronyms grouped under a plain-language heading,
              each with a marketer-facing label first and the raw technical
              term shown secondary (e.g. "Campaign source (utm_source)"). */}
          <h3 className="mt-6 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-950">
            Where this lead came from
          </h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <DetailMetric
              label="Campaign source"
              technicalTerm="utm_source"
              value={lead.utmSource}
            />
            <DetailMetric
              label="Campaign medium"
              technicalTerm="utm_medium"
              value={lead.utmMedium}
            />
            <DetailMetric
              label="Campaign name"
              technicalTerm="utm_campaign"
              value={lead.utmCampaign}
            />
            <DetailMetric label="Ad platform" value={lead.paidPlatform} />
            <DetailMetric
              label="Paid tracking key"
              value={lead.paidSourceKey}
            />
            <DetailMetric label="Campaign" value={lead.campaignId} />
            <DetailMetric label="Ad set" value={lead.adsetId} />
            <DetailMetric label="Ad group" value={lead.adGroupId} />
            <DetailMetric label="Ad group (Meta)" value={lead.groupId} />
            <DetailMetric label="Ad" value={lead.adId} />
            <DetailMetric
              label="Google click ID"
              technicalTerm="GCLID"
              value={lead.gclid}
            />
            <DetailMetric
              label="Facebook click ID"
              technicalTerm="FBCLID"
              value={lead.fbclid}
            />
          </dl>
        </section>
      </div>
    </div>
  );
}

function LeadRow({ lead }: { lead: AdminLeadListItem }) {
  return (
    <tr>
      <td className="px-5 py-4">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="font-semibold text-slate-950 hover:text-[#0b63f6]"
        >
          {lead.fullName}
        </Link>
        <p className="mt-1 text-xs text-slate-500">{lead.email}</p>
        {lead.phone ? (
          <p className="mt-1 text-xs text-slate-500">{lead.phone}</p>
        ) : null}
      </td>
      <td className="px-4 py-4">
        <AdminStatusBadge status={lead.lifecycleStatus} />
      </td>
      <td className="px-4 py-4">
        {lead.qualificationStatus ? (
          <AdminStatusBadge status={lead.qualificationStatus} />
        ) : (
          <span className="text-xs font-semibold text-slate-500">None</span>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="grid gap-1">
          {lead.closeSyncStatus ? (
            <CloseSyncStatusBadge status={lead.closeSyncStatus} />
          ) : (
            <span className="text-xs font-semibold text-slate-500">None</span>
          )}
          {lead.closeSyncLastError ? (
            <p className="max-w-48 truncate text-xs text-red-700">
              {lead.closeSyncLastError}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="grid gap-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">
            {lead.sourcePath ?? lead.landingPath ?? "Unknown source"}
          </span>
          {lead.sourcePageSlug ? <span>{lead.sourcePageSlug}</span> : null}
          {lead.experimentKey || lead.variantKey ? (
            <span>
              {[lead.experimentKey, lead.variantKey]
                .filter(Boolean)
                .join(" / ")}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/admin/leads/${lead.id}`}
            className={adminSmallButtonClass}
          >
            Inspect
          </Link>
          {lead.latestCloseSyncEvent &&
          retryableStatuses.has(lead.latestCloseSyncEvent.status) ? (
            <RetrySyncForm event={lead.latestCloseSyncEvent} leadId={lead.id} />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CloseSyncEventCard({
  event,
  leadId,
}: {
  event: AdminCloseSyncEventSummary;
  leadId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {formatStatus(event.eventType)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Next retry {formatDate(event.nextRetryAt) ?? "not scheduled"}
          </p>
        </div>
        <CloseSyncStatusBadge status={event.status} />
      </div>
      {event.lastError ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {event.lastError}
        </p>
      ) : null}
      {retryableStatuses.has(event.status) ? (
        <div className="mt-3">
          <RetrySyncForm event={event} leadId={leadId} />
        </div>
      ) : null}
    </div>
  );
}

function RetrySyncForm({
  event,
  leadId,
}: {
  event: AdminCloseSyncEventSummary;
  leadId: string;
}) {
  const [state, formAction] = useActionState(
    retryCloseSyncEvent,
    initialActionState,
  );
  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="leadId" value={leadId} />
      <RetrySubmitButton />
      <ActionMessage state={state} />
    </form>
  );
}

function RetrySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminSecondaryButtonClass}
    >
      <span aria-hidden="true">
        <AdminIcon icon="upload" />
      </span>
      {pending ? "Queueing..." : "Retry sync"}
    </button>
  );
}

function ActionMessage({ state }: { state: LeadAdminActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      className={`text-xs font-medium ${
        state.status === "error" ? "text-red-600" : "text-emerald-700"
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

function FilterNav({
  activeValue,
  ariaLabel,
  options,
  otherParam,
  otherValue,
  param,
}: {
  activeValue: string;
  ariaLabel: string;
  options: readonly { value: string; label: string }[];
  otherParam: string;
  otherValue: string;
  param: string;
}) {
  return (
    <nav
      className="inline-flex min-h-11 flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <Link
          key={option.value}
          href={leadListHref({
            [param]: option.value,
            [otherParam]: otherValue,
          })}
          aria-current={activeValue === option.value ? "page" : undefined}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
            activeValue === option.value
              ? "bg-[#f4f8ff] text-[#0b63f6] shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function leadListHref(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/leads?${query}` : "/admin/leads";
}

function DetailMetric({
  label,
  technicalTerm,
  value,
}: {
  label: string;
  technicalTerm?: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase">
        {label}
        {technicalTerm ? (
          <span className="ml-1 font-normal text-slate-400 normal-case">
            ({technicalTerm})
          </span>
        ) : null}
      </dt>
      <dd className="mt-1 text-sm font-medium break-words text-slate-800">
        {value || "None"}
      </dd>
    </div>
  );
}

function SummaryList({ summary }: { summary: unknown }) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }
  const entries = Object.entries(summary).filter(([, value]) => value != null);
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <DetailMetric
          key={key}
          label={formatStatus(key)}
          value={formatSummaryValue(value)}
        />
      ))}
    </dl>
  );
}

function formatSummaryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
