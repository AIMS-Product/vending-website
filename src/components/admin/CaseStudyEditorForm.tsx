"use client";

import type { FormEvent } from "react";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import {
  saveCaseStudy,
  type EditorActionState,
} from "@/app/admin/case-studies/actions";
import { normalizeCaseStudySlug } from "@/app/admin/case-studies/case-study-slug";
import {
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { CaseStudyCoverCard } from "@/components/admin/CaseStudyCoverCard";
import { CaseStudyMobileSaveBar } from "@/components/admin/CaseStudyMobileSaveBar";
import { CaseStudyPublishButton } from "@/components/admin/CaseStudyPublishButton";
import { CaseStudyStatsEditor } from "@/components/admin/CaseStudyStatsEditor";
import {
  formatDate,
  joinCommaList,
  resolveYoutubeVideoId,
  tabClass,
} from "@/components/admin/case-study-editor-helpers";
import { useCaseStudyAutosave } from "@/components/admin/useCaseStudyAutosave";
import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";
import type { CaseStudy } from "@/lib/services/case-studies";
import { parseStats } from "@/lib/case-studies/stats";

type CaseStudyEditorFormProps = {
  caseStudy?: CaseStudy;
  savedFromRedirect?: boolean;
};

const initialState: EditorActionState = { status: "idle" };

export function CaseStudyEditorForm({
  caseStudy,
  savedFromRedirect = false,
}: CaseStudyEditorFormProps) {
  const [state, formAction] = useActionState(saveCaseStudy, initialState);
  const [title, setTitle] = useState(caseStudy?.title ?? "");
  const [slug, setSlug] = useState(caseStudy?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(caseStudy?.slug));
  const [memberName, setMemberName] = useState(caseStudy?.member_name ?? "");
  const [memberRole, setMemberRole] = useState(caseStudy?.member_role ?? "");
  const [excerpt, setExcerpt] = useState(caseStudy?.excerpt ?? "");
  const [youtubeInput, setYoutubeInput] = useState(
    caseStudy?.youtube_video_id ?? "",
  );
  const [quote, setQuote] = useState(caseStudy?.quote ?? "");
  const [quoteAttribution, setQuoteAttribution] = useState(
    caseStudy?.quote_attribution ?? "",
  );
  const [body, setBody] = useState(caseStudy?.body ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [coverUrl, setCoverUrl] = useState(caseStudy?.cover_url ?? "");
  const [coverAlt, setCoverAlt] = useState(caseStudy?.cover_alt ?? "");
  const [monthlyRevenueUsd, setMonthlyRevenueUsd] = useState(
    caseStudy?.monthly_revenue_usd?.toString() ?? "",
  );
  const [machineCount, setMachineCount] = useState(
    caseStudy?.machine_count?.toString() ?? "",
  );
  const [locationCount, setLocationCount] = useState(
    caseStudy?.location_count?.toString() ?? "",
  );
  const [monthsToResult, setMonthsToResult] = useState(
    caseStudy?.months_to_result?.toString() ?? "",
  );
  const [priorOccupation, setPriorOccupation] = useState(
    caseStudy?.prior_occupation ?? "",
  );
  const [locationTypes, setLocationTypes] = useState(
    joinCommaList(caseStudy?.location_types ?? []),
  );
  const [tags, setTags] = useState(joinCommaList(caseStudy?.tags ?? []));
  const [relatedSlugs, setRelatedSlugs] = useState(
    joinCommaList(caseStudy?.related_slugs ?? []),
  );
  const [stats, setStats] = useState(parseStats(caseStudy?.stats ?? []));
  const [featured, setFeatured] = useState(caseStudy?.featured ?? false);

  const status = caseStudy?.status ?? "draft";
  const canUnpublish = status === "published";
  const canArchive = Boolean(caseStudy?.id) && status !== "archived";
  const visibleSlug = slugTouched ? slug : normalizeCaseStudySlug(title);
  const resolvedVideoId = resolveYoutubeVideoId(youtubeInput);
  const videoInputInvalid = resolvedVideoId === undefined;

  // I5-equivalent: background autosave for existing DRAFT rows only. Gated
  // inside the hook on caseStudy.id (a brand-new case study has no row yet
  // and relies on manual "Save draft") and on draft status (a published
  // row's content IS the live content, so autosave must never write it).
  const { autosave, clearAutosave } = useCaseStudyAutosave({
    caseStudyId: caseStudy?.id ?? null,
    status,
    title,
    slug: visibleSlug,
    memberName,
    memberRole,
    excerpt,
    body,
    coverUrl,
    coverAlt,
    youtubeVideoId: youtubeInput,
    quote,
    quoteAttribution,
    monthlyRevenueUsd,
    machineCount,
    locationCount,
    monthsToResult,
    priorOccupation,
    locationTypes,
    tags,
    relatedSlugs,
    stats,
  });

  // A manual Save draft / Publish persists the whole row, so drop any
  // pending autosave failure indicator when the user takes the manual
  // fallback.
  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name === "intent") {
      clearAutosave();
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderMarkdown(body).then((html) => {
        if (!cancelled) setPreviewHtml(html);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [body]);

  const statusLabel =
    status === "published" && caseStudy?.published_at
      ? `Published ${formatDate(caseStudy.published_at)}`
      : status[0].toUpperCase() + status.slice(1);

  return (
    <>
      <form
        id="case-study-editor-form"
        action={formAction}
        onSubmit={handleManualSubmit}
        className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0"
      >
        {caseStudy?.id && (
          <input type="hidden" name="id" value={caseStudy.id} />
        )}
        <input type="hidden" name="stats" value={JSON.stringify(stats)} />

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin/case-studies"
              className="text-ui-accent hover:text-ui-accent-hover text-sm font-semibold"
            >
              Back to case studies
            </Link>
            <span className="bg-ui-line text-ui-text-muted rounded-full px-3 py-1 text-xs font-semibold">
              {statusLabel}
            </span>
          </div>

          <label className="block">
            <span className="text-ui-text-muted text-sm font-medium">
              Title
            </span>
            <input
              name="title"
              aria-label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="border-ui-line text-ui-text focus:border-ui-accent focus:ring-ui-accent/15 mt-2 w-full rounded-lg border bg-white px-4 py-3 text-2xl font-semibold shadow-sm transition outline-none focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-ui-text-muted text-sm font-medium">Slug</span>
            <input
              name="slug"
              aria-label="Slug"
              aria-describedby="case-study-slug-hint"
              value={visibleSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(normalizeCaseStudySlug(event.target.value));
              }}
              required
              className={`${adminInputClass} font-mono`}
            />
            <span
              id="case-study-slug-hint"
              className="text-ui-text-subtle mt-1.5 block text-xs"
            >
              Lowercase letters, numbers, and hyphens only — spaces and
              punctuation are removed automatically.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-ui-text-muted text-sm font-medium">
                Member name
              </span>
              <input
                name="member_name"
                aria-label="Member name"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                required
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="text-ui-text-muted text-sm font-medium">
                Member role
              </span>
              <input
                name="member_role"
                aria-label="Member role"
                placeholder="e.g. Retired teacher, 3 machines"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
                className={adminInputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-ui-text-muted text-sm font-medium">
              Excerpt
            </span>
            <textarea
              name="excerpt"
              aria-label="Excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={3}
              maxLength={240}
              className={adminTextareaClass}
            />
          </label>

          <div className={adminCardClass}>
            <h2 className="text-ui-text text-sm font-semibold">
              YouTube video
            </h2>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-sm font-medium">
                Video ID or URL
              </span>
              <input
                name="youtube_video_id"
                aria-label="YouTube video ID or URL"
                aria-invalid={videoInputInvalid || undefined}
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeInput}
                onChange={(event) => setYoutubeInput(event.target.value)}
                className={adminInputClass}
              />
            </label>
            {videoInputInvalid ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                Could not read a YouTube video ID from that value. Paste the
                full video URL or the bare 11-character ID.
              </p>
            ) : (
              <p className="text-ui-text-subtle mt-2 text-xs">
                Publishing requires a video. The public page falls back to this
                video&rsquo;s thumbnail when no cover image is set.
              </p>
            )}
            {resolvedVideoId ? (
              // eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, not a local/optimizable asset
              <img
                src={`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`}
                alt="YouTube thumbnail preview"
                width={320}
                height={180}
                className="border-ui-line mt-3 w-full max-w-xs rounded-md border"
              />
            ) : null}
          </div>

          <div className={adminCardClass}>
            <h2 className="text-ui-text text-sm font-semibold">Pull quote</h2>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-sm font-medium">
                Quote
              </span>
              <textarea
                name="quote"
                aria-label="Quote"
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                rows={3}
                maxLength={600}
                className={adminTextareaClass}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-sm font-medium">
                Attribution
              </span>
              <input
                name="quote_attribution"
                aria-label="Quote attribution"
                placeholder="e.g. Jane D., Route owner since 2024"
                value={quoteAttribution}
                onChange={(event) => setQuoteAttribution(event.target.value)}
                className={adminInputClass}
              />
            </label>
          </div>

          <div className="border-ui-line overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="border-ui-line bg-ui-canvas flex border-b">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={tabClass(activeTab === "write")}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={tabClass(activeTab === "preview")}
              >
                Preview
              </button>
            </div>
            {activeTab === "write" ? (
              <textarea
                name="body"
                aria-label="Body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={24}
                className="text-ui-text min-h-[520px] w-full resize-y border-0 p-4 font-mono text-sm leading-6 outline-none"
              />
            ) : (
              <>
                <input type="hidden" name="body" value={body} />
                <div
                  className="news-prose min-h-[520px] p-5"
                  dangerouslySetInnerHTML={{
                    __html:
                      previewHtml ||
                      "<p>Start writing to preview the story.</p>",
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className={adminCardClass}>
            <h2 className="text-ui-text text-sm font-semibold">Publish</h2>
            {(state.status !== "idle" || savedFromRedirect) && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                  state.status === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {state.message ?? "Case study saved."}
              </p>
            )}
            {autosave?.status === "saved" && (
              <p className="text-ui-text-subtle mt-3 text-xs font-medium">
                Saved automatically · {formatPacificDateTime(autosave.savedAt)}
              </p>
            )}
            {autosave?.status === "error" && (
              <p className="mt-3 text-xs font-medium text-red-600">
                {autosave.message}
              </p>
            )}
            <div className="mt-5 grid gap-2">
              <button
                type="submit"
                className={adminSecondaryButtonClass}
                name="intent"
                value="save"
              >
                Save draft
              </button>
              <CaseStudyPublishButton className={adminPrimaryButtonClass} />
              {canUnpublish && (
                <button
                  type="submit"
                  className={adminSecondaryButtonClass}
                  name="intent"
                  value="unpublish"
                >
                  Unpublish
                </button>
              )}
              {canArchive && (
                <button
                  type="submit"
                  className={adminSecondaryButtonClass}
                  name="intent"
                  value="archive"
                >
                  Archive
                </button>
              )}
            </div>
          </div>

          <CaseStudyCoverCard
            coverUrl={coverUrl}
            coverAlt={coverAlt}
            onCoverUrlChange={setCoverUrl}
            onCoverAltChange={setCoverAlt}
          />

          <CaseStudyStatsEditor rows={stats} onChange={setStats} />

          <div className={adminCardClass}>
            <h2 className="text-ui-text text-sm font-semibold">
              Result figures
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-ui-text-muted text-xs font-medium">
                  Monthly revenue ($)
                </span>
                <input
                  type="number"
                  name="monthly_revenue_usd"
                  aria-label="Monthly revenue in dollars"
                  value={monthlyRevenueUsd}
                  onChange={(event) => setMonthlyRevenueUsd(event.target.value)}
                  className={`${adminInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-ui-text-muted text-xs font-medium">
                  Machines
                </span>
                <input
                  type="number"
                  name="machine_count"
                  aria-label="Machine count"
                  value={machineCount}
                  onChange={(event) => setMachineCount(event.target.value)}
                  className={`${adminInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-ui-text-muted text-xs font-medium">
                  Locations
                </span>
                <input
                  type="number"
                  name="location_count"
                  aria-label="Location count"
                  value={locationCount}
                  onChange={(event) => setLocationCount(event.target.value)}
                  className={`${adminInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-ui-text-muted text-xs font-medium">
                  Months to result
                </span>
                <input
                  type="number"
                  name="months_to_result"
                  aria-label="Months to result"
                  value={monthsToResult}
                  onChange={(event) => setMonthsToResult(event.target.value)}
                  className={`${adminInputClass} mt-1`}
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-xs font-medium">
                Prior occupation
              </span>
              <input
                name="prior_occupation"
                aria-label="Prior occupation"
                value={priorOccupation}
                onChange={(event) => setPriorOccupation(event.target.value)}
                className={`${adminInputClass} mt-1`}
              />
            </label>
            {/*
              Only one story can be featured. The database trigger un-features
              the previous one on save, so this is a plain checkbox rather than
              a picker that has to know what is currently featured.
            */}
            <label className="border-ui-border mt-4 flex items-start gap-3 border-t pt-4">
              <input
                type="checkbox"
                name="featured"
                checked={featured}
                onChange={(event) => setFeatured(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="text-ui-text block text-xs font-semibold">
                  Feature at the top of the case studies index
                </span>
                <span className="text-ui-text-muted mt-0.5 block text-xs">
                  Replaces whichever story is featured now. Published stories
                  only.
                </span>
              </span>
            </label>
          </div>

          <div className={adminCardClass}>
            <h2 className="text-ui-text text-sm font-semibold">
              Filters &amp; related
            </h2>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-xs font-medium">
                Location types
              </span>
              <input
                name="location_types"
                aria-label="Location types, comma separated"
                placeholder="office, gym, apartment"
                value={locationTypes}
                onChange={(event) => setLocationTypes(event.target.value)}
                className={`${adminInputClass} mt-1`}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-xs font-medium">
                Tags
              </span>
              <input
                name="tags"
                aria-label="Tags, comma separated"
                placeholder="retiree, side-hustle"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className={`${adminInputClass} mt-1`}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-ui-text-muted text-xs font-medium">
                Related case study slugs
              </span>
              <input
                name="related_slugs"
                aria-label="Related case study slugs, comma separated"
                placeholder="another-member, third-member"
                value={relatedSlugs}
                onChange={(event) => setRelatedSlugs(event.target.value)}
                className={`${adminInputClass} mt-1`}
              />
            </label>
          </div>
        </div>
      </form>
      <CaseStudyMobileSaveBar formId="case-study-editor-form" />
    </>
  );
}
