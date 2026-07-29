"use client";

import { useState } from "react";
import {
  NextPublishStepCard,
  SeoReadinessPanel,
} from "@/components/admin/seo-page-editor/SeoReadinessPanel";
import {
  PUBLISH_BLOCKER_LIST_ID,
  PublishBlockerChecklist,
  focusPublishBlockerChecklist,
} from "@/components/admin/seo-page-editor/PublishBlockerChecklist";
import { ScheduleStatusCard } from "@/components/admin/seo-page-editor/ScheduleStatusCard";
import { PublishSuccessCard } from "@/components/admin/seo-page-editor/PublishSuccessCard";
import { PublishVerdictCard } from "@/components/admin/seo-page-editor/PublishVerdictCard";
import { SeoPanelTabs } from "@/components/admin/seo-page-editor/SeoPanelTabs";
import {
  compactInputClass,
  primaryButtonClass,
  textareaClass,
} from "@/components/admin/seo-page-editor/editor-styles";
import { EditorCharLimit } from "@/components/admin/seo-page-editor/EditorInputs";
import { editorPublishConfirmMessage } from "@/components/admin/seo-page-editor/editor-publish-confirmation";
import { META_DESCRIPTION_MAX_LENGTH } from "@/lib/page-builder/copy-standards";
import { thinPageWarning } from "@/components/admin/seo-page-editor/SeoReadinessHelpers";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";
import { formatPacificDate } from "@/lib/page-builder/datetime-format";
import {
  SCHEDULED_PUBLISH_TIME_ZONE,
  SCHEDULED_PUBLISH_TIME_ZONE_LABEL,
  formatDateTimeLocalInTimeZone,
} from "@/lib/page-builder/scheduled-publishing";

// S7: a clearly-disabled (greyed) variant for the Publish button so a blocked
// page doesn't render an active-looking blue primary button. Clicking it still
// works — it reveals the "next required step" reason rather than submitting.
const disabledPublishButtonClass =
  "rounded-lg border border-ui-line bg-ui-line px-4 py-2 text-sm font-semibold text-ui-text-subtle shadow-none transition cursor-help";

export function SeoPublishPanel({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);

  return (
    <section
      aria-labelledby="seo-panel-title"
      data-builder-walkthrough="seo"
      className="border-ui-line fixed top-32 right-4 bottom-4 z-[60] order-3 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-white shadow-xl xl:sticky xl:top-4 xl:right-auto xl:bottom-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none"
    >
      <SeoPanelHeader editor={editor} />
      <PublishStatusSection
        editor={editor}
        isExpanded={isStatusExpanded}
        onExpandedChange={setIsStatusExpanded}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <PublishVerdictCard
          blockers={editor.publishBlockerChecklist}
          summary={editor.seoReadiness}
        />
        {/* Verdict leads; the readiness findings and the settings info-dump
            move behind tabs so the panel doesn't open as a wall of fields. */}
        <SeoPanelTabs
          tabs={[
            {
              id: "readiness",
              label: "Readiness",
              content: (
                <SeoReadinessPanel
                  content={editor.content}
                  summary={editor.seoReadiness}
                  internalLinkSuggestions={editor.internalLinkSuggestions}
                  linkSuggestionMessage={editor.linkSuggestionMessage}
                  onApplyInternalLinkSuggestion={editor.applyLinkSuggestion}
                  onAddSuggestedBlock={editor.addSuggestedBlock}
                  onOpenSettings={editor.focusSeoSetting}
                  mediaAssetCount={editor.mediaAssets.length}
                />
              ),
            },
            {
              id: "settings",
              label: "Settings",
              content: <SeoMetadataFields editor={editor} />,
            },
          ]}
        />
      </div>
    </section>
  );
}

function PublishStatusSection({
  editor,
  isExpanded,
  onExpandedChange,
}: {
  editor: SeoPageEditorController;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  // I3: confirm state lives in the controller so the publish submit dismisses
  // it — guaranteeing a re-publish must re-open a fresh confirm.
  const { isConfirmingPublish, setIsConfirmingPublish } = editor;
  const { nextPublishStep, page, publishStateLabel } = editor;
  const statusDotClass =
    page?.status === "published" ? "bg-emerald-500" : "bg-amber-500";
  const nextStepToneClass =
    nextPublishStep.tone === "ready"
      ? "text-emerald-700"
      : nextPublishStep.tone === "blocked"
        ? "text-amber-700"
        : "text-sky-700";

  function revealPublishBlocker() {
    // Move attention to the canonical blocker checklist (the single source of
    // truth for what blocks publish), focusing its first actionable item.
    requestAnimationFrame(() => {
      if (focusPublishBlockerChecklist()) return;
      onExpandedChange(true);
      const reason = document.getElementById("publish-next-step");
      reason?.scrollIntoView({ behavior: "smooth", block: "center" });
      reason?.focus();
    });
  }

  return (
    <div className="border-ui-line shrink-0 border-b px-4 py-3 sm:px-5">
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="publish-status-content"
          className="hover:bg-ui-canvas focus-visible:ring-ui-accent/20 flex min-w-0 flex-1 items-start justify-between gap-3 rounded-lg px-1 py-1 text-left transition focus-visible:ring-4 focus-visible:outline-none"
          onClick={() => onExpandedChange(!isExpanded)}
        >
          <div className="min-w-0">
            <span className="text-ui-text-subtle text-xs font-semibold tracking-wider uppercase">
              Publish status
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="border-ui-line text-ui-text-muted inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                <span
                  className={`size-1.5 rounded-full ${statusDotClass}`}
                  aria-hidden="true"
                />
                {publishStateLabel}
              </span>
              <span
                className={`truncate text-xs font-semibold ${nextStepToneClass}`}
              >
                {nextPublishStep.title}
              </span>
            </div>
          </div>
          <CollapseChevronIcon expanded={isExpanded} />
        </button>
        <PublishButton
          editor={editor}
          onRevealPublishBlocker={revealPublishBlocker}
          onRequestConfirm={() => setIsConfirmingPublish(true)}
        />
      </div>

      {isConfirmingPublish ? (
        <PublishConfirmDialog
          editor={editor}
          onCancel={() => setIsConfirmingPublish(false)}
        />
      ) : null}

      {editor.publishBlockerChecklist.length > 0 ? (
        <div className="mt-3">
          <PublishBlockerChecklist
            items={editor.publishBlockerChecklist}
            onFocusBlocker={editor.focusPublishBlocker}
          />
        </div>
      ) : null}

      {editor.scheduleStatus.kind !== "none" ? (
        <div className="mt-3">
          <ScheduleStatusCard
            status={editor.scheduleStatus}
            isCancelling={editor.isCancellingSchedule}
            onCancelSchedule={editor.requestCancelSchedule}
          />
        </div>
      ) : null}

      {editor.publishJustSucceeded && editor.livePageUrl ? (
        <div className="mt-3">
          <PublishSuccessCard
            key={editor.livePageUrl}
            livePageUrl={editor.livePageUrl}
          />
        </div>
      ) : null}

      {isExpanded ? (
        <div id="publish-status-content" className="mt-3 space-y-3">
          <PublishStatusCard editor={editor} />
          <div
            id="publish-next-step"
            tabIndex={-1}
            className="scroll-mt-4 outline-none"
          >
            <NextPublishStepCard step={nextPublishStep} />
          </div>
        </div>
      ) : (
        <div
          id="publish-next-step"
          tabIndex={-1}
          className="sr-only"
          aria-hidden="true"
        >
          {nextPublishStep.title}: {nextPublishStep.detail}
        </div>
      )}
    </div>
  );
}

function CollapseChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`text-ui-text-subtle mt-0.5 size-4 shrink-0 transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SeoPanelHeader({ editor }: { editor: SeoPageEditorController }) {
  const { publishStateLabel, seoReadiness } = editor;

  return (
    <div className="border-ui-line flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
      <div>
        <p className="text-ui-text-subtle text-xs font-semibold tracking-wider uppercase">
          SEO
        </p>
        <h2
          id="seo-panel-title"
          className="text-ui-text mt-1 text-base font-semibold"
        >
          Readiness and publish
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs font-medium">
          {publishStateLabel} · SEO {seoReadiness.label}
        </p>
      </div>
      <span className="border-ui-line text-ui-text-muted rounded-full border bg-white px-2.5 py-1 text-xs font-semibold shadow-sm">
        {seoReadiness.label}
      </span>
    </div>
  );
}

function PublishStatusCard({ editor }: { editor: SeoPageEditorController }) {
  const { page, publishStateHelp, publishStateLabel } = editor;

  return (
    <div className="border-ui-line bg-ui-canvas grid gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ui-text-subtle text-xs font-semibold tracking-wider uppercase">
          Status
        </span>
        <span className="border-ui-line text-ui-text-muted rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold shadow-sm">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                page?.status === "published" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {publishStateLabel}
          </span>
        </span>
      </div>
      <p className="text-ui-text-subtle text-xs leading-5 font-medium">
        {publishStateHelp}
      </p>
      {/* Scheduled / failed schedule state is rendered once, in the always-
          visible ScheduleStatusCard above — not duplicated here. */}
      {page?.status === "published" && (
        <a
          href={page.route_path}
          target="_blank"
          rel="noreferrer"
          className="border-ui-line text-ui-text-muted hover:border-ui-line-strong hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 inline-flex min-h-9 items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold shadow-sm transition focus-visible:ring-4 focus-visible:outline-none"
        >
          Open live page
        </a>
      )}
      <dl className="text-ui-text-subtle grid gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium">Last updated</dt>
          <dd className="text-ui-text-muted font-semibold">
            {page?.updated_at ? formatPacificDate(page.updated_at) : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium">Published</dt>
          <dd className="text-ui-text-muted font-semibold">
            {page?.published_at
              ? formatPacificDate(page.published_at)
              : "Not yet"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// Note: no `required` on these inputs. The Settings tabpanel stays mounted but
// hidden when another tab is active, and Chrome silently aborts form submission
// on an invalid hidden control — a save/publish click would no-op with zero
// feedback. The server action validates title/slug and the manual-submit toast
// surfaces its message, matching the collapsed-panel path.
function SeoMetadataFields({ editor }: { editor: SeoPageEditorController }) {
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-ui-text text-sm font-semibold">Page title</span>
        <input
          name="title"
          aria-label="Page title"
          value={editor.title}
          id="page-title-field"
          onChange={(event) => editor.setTitle(event.target.value)}
          className={compactInputClass}
          placeholder="Internal page title and SEO fallback"
        />
        <span className="text-ui-text-subtle mt-1.5 block text-xs leading-5">
          Used for admin lists, slug generation, and as the SEO title fallback.
          The visible page headline is edited in the hero block.
        </span>
      </label>

      <label className="block">
        <span className="text-ui-text text-sm font-semibold">
          URL ending (slug)
        </span>
        <div className="border-ui-line focus-within:border-ui-accent focus-within:ring-ui-accent/10 mt-1.5 flex items-center rounded-lg border bg-white shadow-sm transition focus-within:ring-4">
          <select
            name="routePrefix"
            aria-label="Route prefix"
            value={editor.routePrefix}
            onChange={(event) => editor.setRoutePrefix(event.target.value)}
            className="border-ui-line bg-ui-canvas text-ui-text-muted max-w-32 rounded-l-lg border-r px-2 py-2.5 text-sm font-semibold outline-none"
          >
            {editor.routePrefixOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
          <input
            name="slug"
            id="page-slug-field"
            value={editor.visibleSlug}
            onChange={(event) => editor.updateSlugFromInput(event.target.value)}
            aria-label="URL ending (slug)"
            className="text-ui-text min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-slate-300"
            placeholder="page-slug"
          />
        </div>
        <span className="text-ui-text-subtle mt-1.5 block text-xs leading-5">
          Lowercase letters, numbers and hyphens only. Auto-generated from the
          title until you edit it, and the full path must be unique across
          active pages.
        </span>
      </label>

      <TextInput
        name="targetKeyword"
        label="Target keyword"
        value={editor.targetKeyword}
        id="seo-target-keyword-field"
        onChange={editor.setTargetKeyword}
        placeholder="e.g. vending machine business"
      />
      <TextInput
        name="seoTitle"
        label="SEO title"
        value={editor.seoTitle}
        id="seo-title-field"
        onChange={editor.setSeoTitle}
        placeholder="Leave blank to use page headline"
      />

      <label className="block">
        <span className="text-ui-text text-sm font-semibold">
          Meta description
        </span>
        <textarea
          name="metaDescription"
          aria-label="Meta description"
          value={editor.metaDescription}
          id="page-meta-description-field"
          onChange={(event) => editor.setMetaDescription(event.target.value)}
          rows={3}
          maxLength={META_DESCRIPTION_MAX_LENGTH}
          className={textareaClass}
          placeholder="Search result summary for this page."
        />
        <EditorCharLimit
          value={editor.metaDescription}
          max={META_DESCRIPTION_MAX_LENGTH}
        />
      </label>

      <ScheduleField editor={editor} />
      <AdvancedSeoFields editor={editor} />
      <SearchPreviewCard editor={editor} />
    </div>
  );
}

function ScheduleField({ editor }: { editor: SeoPageEditorController }) {
  const page = editor.page;
  // Mount-time baseline for the uncontrolled schedule input: the server only
  // writes scheduler state when the submitted value differs from this, so
  // routine saves and stale tabs never re-arm or unlock a schedule.
  const [scheduledPublishBaseline] = useState(() =>
    formatDateTimeLocalInTimeZone(
      page?.scheduled_publish_at,
      SCHEDULED_PUBLISH_TIME_ZONE,
    ),
  );

  return (
    <label className="border-ui-line bg-ui-canvas block rounded-xl border p-4">
      <span className="text-ui-text text-sm font-semibold">
        Schedule publish
      </span>
      <input
        type="datetime-local"
        name="scheduledPublishAt"
        aria-label="Scheduled publish"
        defaultValue={scheduledPublishBaseline}
        className={compactInputClass}
      />
      <input
        type="hidden"
        name="scheduledPublishAtBaseline"
        value={scheduledPublishBaseline}
      />
      <span className="text-ui-text-subtle mt-1.5 block text-xs leading-5">
        Uses {SCHEDULED_PUBLISH_TIME_ZONE_LABEL} ({SCHEDULED_PUBLISH_TIME_ZONE}
        ). Leave blank unless this page should publish later. Save the draft to
        arm the schedule.
      </span>
    </label>
  );
}

function TextInput({
  id,
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-ui-text text-sm font-semibold">{label}</span>
      <input
        name={name}
        aria-label={label}
        value={value}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
        placeholder={placeholder}
      />
    </label>
  );
}

function AdvancedSeoFields({ editor }: { editor: SeoPageEditorController }) {
  return (
    <details
      id="advanced-seo-fields"
      className="border-ui-line bg-ui-canvas rounded-xl border p-4"
    >
      <summary className="text-ui-text cursor-pointer text-sm font-semibold">
        Advanced SEO
      </summary>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">
            Preferred URL
          </span>
          <input
            name="canonicalUrl"
            aria-label="Preferred URL"
            value={editor.canonicalUrl}
            id="seo-canonical-url-field"
            onChange={(event) => editor.setCanonicalUrl(event.target.value)}
            className={compactInputClass}
            placeholder="https://..."
          />
          <span className="text-ui-text-subtle mt-1.5 block text-xs leading-5">
            Optional. Use only when this page should point search engines to a
            different preferred URL.
          </span>
        </label>

        <div className="border-ui-line space-y-3 rounded-lg border bg-white p-4">
          <CheckboxSetting
            checked={editor.noindex}
            id="seo-noindex-field"
            label="Hide from search engines"
            name="noindex"
            onChange={(checked) => {
              editor.setNoindex(checked);
              if (checked) editor.setSitemapEnabled(false);
            }}
            help="Use this only for pages that should not appear in search results."
          />
          <CheckboxSetting
            checked={editor.sitemapEnabled}
            id="seo-sitemap-enabled-field"
            disabled={editor.noindex}
            label="Include in sitemap"
            name="sitemapEnabled"
            onChange={editor.setSitemapEnabled}
            help="Help search engines discover this page."
          />
        </div>

        <div className="border-ui-line space-y-3 rounded-lg border bg-white p-4">
          <div>
            <p className="text-ui-text text-sm font-semibold">
              Structured data
            </p>
            <p className="text-ui-text-subtle mt-0.5 text-xs leading-5 font-normal">
              Control the search metadata generated from this published page.
            </p>
          </div>
          <CheckboxSetting
            checked={editor.structuredDataBreadcrumb}
            id="seo-structured-data-breadcrumb-field"
            label="Breadcrumb trail"
            name="structuredDataBreadcrumb"
            onChange={editor.setStructuredDataBreadcrumb}
            help="Add page path context for search engines."
          />
          <CheckboxSetting
            checked={editor.structuredDataFaq}
            id="seo-structured-data-faq-field"
            label="Visible FAQs"
            name="structuredDataFaq"
            onChange={editor.setStructuredDataFaq}
            help="Generate FAQ metadata only from published FAQ blocks."
          />
        </div>

        <GovernanceFields editor={editor} />
      </div>
    </details>
  );
}

function GovernanceFields({ editor }: { editor: SeoPageEditorController }) {
  const page = editor.page;
  return (
    <div className="border-ui-line space-y-4 rounded-lg border bg-white p-4">
      <div>
        <p className="text-ui-text text-sm font-semibold">
          Internal &amp; social
        </p>
        <p className="text-ui-text-subtle mt-0.5 text-xs leading-5">
          Internal tags, review timing, and how this page looks when shared.
        </p>
      </div>
      <label className="block">
        <span className="text-ui-text text-sm font-semibold">
          Internal tags
        </span>
        <input
          name="internalTags"
          aria-label="Internal tags"
          defaultValue={(page?.internal_tags ?? []).join(", ")}
          className={compactInputClass}
          placeholder="cluster, campaign, funnel"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">
            Topic cluster
          </span>
          <input
            name="topicCluster"
            aria-label="Topic cluster"
            defaultValue={page?.topic_cluster ?? ""}
            className={compactInputClass}
          />
        </label>
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">Campaign</span>
          <input
            name="campaignLabel"
            aria-label="Campaign"
            defaultValue={page?.campaign_label ?? ""}
            className={compactInputClass}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">
            Funnel stage
          </span>
          <input
            name="funnelStage"
            aria-label="Funnel stage"
            defaultValue={page?.funnel_stage ?? ""}
            className={compactInputClass}
          />
        </label>
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">Lifecycle</span>
          <select
            name="lifecycleStatus"
            aria-label="Lifecycle"
            defaultValue={page?.lifecycle_status ?? "drafting"}
            className={compactInputClass}
          >
            <option value="drafting">Drafting</option>
            <option value="updating">Updating</option>
            <option value="needs_review">Needs review</option>
            <option value="approved">Approved</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">
            Review period
          </span>
          <select
            name="reviewPeriodMonths"
            aria-label="Review period"
            defaultValue={page?.review_period_months ?? 6}
            className={compactInputClass}
          >
            {[3, 6, 9, 12, 15, 18].map((months) => (
              <option key={months} value={months}>
                {months} months
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-ui-text text-sm font-semibold">
            Next review
          </span>
          <input
            type="date"
            name="nextReviewAt"
            aria-label="Next review"
            defaultValue={page?.next_review_at?.slice(0, 10) ?? ""}
            className={compactInputClass}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-ui-text text-sm font-semibold">Social title</span>
        <input
          name="ogTitle"
          aria-label="Social title"
          defaultValue={page?.og_title ?? ""}
          className={compactInputClass}
          placeholder="Leave blank to use SEO title"
        />
      </label>
      <label className="block">
        <span className="text-ui-text text-sm font-semibold">
          Social description
        </span>
        <textarea
          name="ogDescription"
          aria-label="Social description"
          defaultValue={page?.og_description ?? ""}
          rows={3}
          className={textareaClass}
          placeholder="Leave blank to use meta description"
        />
      </label>
    </div>
  );
}

function CheckboxSetting({
  checked,
  disabled = false,
  help,
  id,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  help: string;
  id: string;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="text-ui-text-muted flex cursor-pointer items-start gap-3 text-sm font-medium">
      <input
        name={name}
        aria-label={label}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="border-ui-line-strong text-ui-accent focus:ring-ui-accent mt-1 size-4 rounded disabled:opacity-50"
      />
      <div className={disabled ? "opacity-50" : ""}>
        <span className="text-ui-text block">{label}</span>
        <span className="text-ui-text-subtle mt-0.5 block text-xs font-normal">
          {help}
        </span>
      </div>
    </label>
  );
}

function SearchPreviewCard({ editor }: { editor: SeoPageEditorController }) {
  return (
    <div className="border-ui-line rounded-xl border bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ui-accent"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <h3 className="text-ui-text text-sm font-semibold">Search Preview</h3>
      </div>
      <div className="space-y-1">
        <p className="cursor-pointer truncate text-lg font-medium text-[#1a0dab] hover:underline">
          {editor.seoTitle || editor.title || "Your Page Title Here"}
        </p>
        <p className="truncate text-sm text-[#006621]">
          www.vendingpreneurs.com{editor.routePrefix}/
          {editor.visibleSlug || "your-slug"}
        </p>
        <p className="line-clamp-2 text-sm text-[#545454]">
          {editor.metaDescription ||
            "Your meta description will appear here. Make it compelling to encourage clicks from search results."}
        </p>
      </div>
    </div>
  );
}

function PublishButton({
  editor,
  onRevealPublishBlocker,
  onRequestConfirm,
}: {
  editor: SeoPageEditorController;
  onRevealPublishBlocker: () => void;
  onRequestConfirm: () => void;
}) {
  const blockerCount = editor.publishBlockerChecklist.length;
  return (
    <button
      type="button"
      data-testid="seo-publish-button"
      className={`shrink-0 ${
        editor.publishDisabled ? disabledPublishButtonClass : primaryButtonClass
      }`}
      aria-disabled={editor.publishDisabled || undefined}
      aria-describedby={blockerCount > 0 ? PUBLISH_BLOCKER_LIST_ID : undefined}
      title={
        blockerCount > 0
          ? `Resolve ${blockerCount} ${
              blockerCount === 1 ? "item" : "items"
            } in the checklist before publishing.`
          : undefined
      }
      onClick={(event) => {
        if (editor.publishDisabled) {
          event.preventDefault();
          onRevealPublishBlocker();
          return;
        }
        onRequestConfirm();
      }}
    >
      {editor.publishButtonLabel}
    </button>
  );
}

function PublishConfirmDialog({
  editor,
  onCancel,
}: {
  editor: SeoPageEditorController;
  onCancel: () => void;
}) {
  const publishConfirmMessage = editorPublishConfirmMessage({
    isPublishedPage: editor.isPublishedPage,
    routePrefix: editor.routePrefix,
    visibleSlug: editor.visibleSlug,
  });
  // I20 follow-up: surface the SAME non-blocking thin-page advisory (n6's
  // thinPageWarning helper) at the moment of commitment. It is a soft cue, not
  // a blocker — Confirm publish stays enabled and publishDisabled is untouched.
  const thinWarning = thinPageWarning(editor.content);

  return (
    <div
      role="alertdialog"
      aria-labelledby="editor-publish-confirm-title"
      aria-describedby="editor-publish-confirm-body"
      className="mt-3 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
    >
      <div>
        <p
          id="editor-publish-confirm-title"
          className="font-semibold text-amber-950"
        >
          Confirm publish
        </p>
        <p
          id="editor-publish-confirm-body"
          className="mt-1 text-xs leading-5 whitespace-pre-line text-amber-900"
        >
          {publishConfirmMessage}
        </p>
      </div>
      {thinWarning ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-xs leading-5 text-amber-900"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 size-4 shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span>{thinWarning}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 focus-visible:ring-4 focus-visible:ring-amber-200/70 focus-visible:outline-none"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          className={primaryButtonClass}
        >
          Confirm publish
        </button>
      </div>
    </div>
  );
}
