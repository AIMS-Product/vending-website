"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  autosaveCaseStudyDraft,
  type CaseStudyAutosaveResult,
} from "@/app/admin/case-studies/actions";
import {
  autosaveFailureMessage,
  autosaveFailureMode,
  nextAutosaveRetryDelayMs,
} from "@/components/admin/seo-page-editor/autosave-retry-policy";
import type { CaseStudyStat } from "@/lib/case-studies/stats";

// Mirrors useNewsAutosave: debounce -> serialized request -> retry-with-
// backoff-then-rest, reusing the SEO autosave-retry-policy so the "retry
// storm" guard and the honest, never-"saved" failure copy stay identical
// across editors. See autosaveCaseStudyDraft for the draft-only server
// invariants this hook depends on.

const AUTOSAVE_DEBOUNCE_MS = 1200;

// The editor content this hook watches. Autosave only runs once a persisted
// row exists (`caseStudyId`), matching the server action's id-required
// invariant — a brand-new, never-saved case study is protected by manual
// "Save draft", not autosave. Numeric/list fields stay as raw strings here;
// they are parsed server-side so a half-typed value skips instead of erroring.
export type CaseStudyAutosaveInput = {
  caseStudyId: string | null;
  status: string;
  title: string;
  slug: string;
  memberName: string;
  memberRole: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  coverAlt: string;
  youtubeVideoId: string;
  quote: string;
  quoteAttribution: string;
  monthlyRevenueUsd: string;
  machineCount: string;
  locationCount: string;
  monthsToResult: string;
  priorOccupation: string;
  locationTypes: string;
  tags: string;
  relatedSlugs: string;
  stats: CaseStudyStat[];
};

export type CaseStudyAutosaveState = CaseStudyAutosaveResult | null;

// Whether autosave may run for this case study. Exported + pure so the
// invariants are unit-testable without driving React effects in a DOM. Two
// gates: id-required, and draft-only (a published row's content IS the live
// content, so a background save must never write it).
export function caseStudyAutosaveEnabled(
  input: Pick<CaseStudyAutosaveInput, "caseStudyId" | "status">,
): boolean {
  return Boolean(input.caseStudyId) && input.status === "draft";
}

// Pure payload builder shared by the hook and its test. Carries content
// fields ONLY (no intent, no status), so the server action it feeds cannot
// change publication state.
export function buildCaseStudyAutosaveFormData(
  input: CaseStudyAutosaveInput,
): FormData {
  const formData = new FormData();
  formData.set("id", input.caseStudyId ?? "");
  formData.set("title", input.title);
  formData.set("slug", input.slug);
  formData.set("member_name", input.memberName);
  formData.set("member_role", input.memberRole);
  formData.set("excerpt", input.excerpt);
  formData.set("body", input.body);
  formData.set("cover_url", input.coverUrl);
  formData.set("cover_alt", input.coverAlt);
  formData.set("youtube_video_id", input.youtubeVideoId);
  formData.set("quote", input.quote);
  formData.set("quote_attribution", input.quoteAttribution);
  formData.set("monthly_revenue_usd", input.monthlyRevenueUsd);
  formData.set("machine_count", input.machineCount);
  formData.set("location_count", input.locationCount);
  formData.set("months_to_result", input.monthsToResult);
  formData.set("prior_occupation", input.priorOccupation);
  formData.set("location_types", input.locationTypes);
  formData.set("tags", input.tags);
  formData.set("related_slugs", input.relatedSlugs);
  formData.set("stats", JSON.stringify(input.stats));
  return formData;
}

export function useCaseStudyAutosave(input: CaseStudyAutosaveInput): {
  autosave: CaseStudyAutosaveState;
  clearAutosave: () => void;
} {
  const [autosave, setAutosave] = useState<CaseStudyAutosaveState>(null);

  // Skip the very first render for a given case study so simply opening the
  // editor never triggers a save; only real edits after mount do.
  const armed = useRef(false);
  // Serialize requests: the draft update is a blind full-content write, so
  // two overlapping autosaves could commit out of order and regress the draft.
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  // Retries used by the CURRENT failure run; reset to 0 on a fresh edit or a
  // successful save so a new attempt is never treated as a continuation of an
  // exhausted failure.
  const retryCount = useRef(0);

  // Mirror the latest input into a ref so a serialized/replayed save reads
  // the freshest editor state, not the value captured when the request was
  // queued. Written in an effect (never during render) per react-hooks rules.
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  });

  const clearAutosave = useCallback(() => {
    // A manual save persists the whole row and supersedes any pending
    // autosave failure — clear the stale indicator and re-arm the retry budget.
    retryCount.current = 0;
    setAutosave(null);
  }, []);

  const {
    caseStudyId,
    status,
    title,
    slug,
    memberName,
    memberRole,
    excerpt,
    body,
    coverUrl,
    coverAlt,
    youtubeVideoId,
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
  } = input;

  useEffect(() => {
    if (!caseStudyAutosaveEnabled({ caseStudyId, status })) return;
    if (!armed.current) {
      armed.current = true;
      return;
    }

    // A fresh edit re-arms the retry budget: a brand-new attempt, not a
    // continuation of an exhausted failure.
    retryCount.current = 0;
    let cancelled = false;
    const timers: number[] = [];

    function runAttempt() {
      inFlight.current = inFlight.current
        .catch(() => undefined)
        // Build the payload AFTER the previous request settles so each save
        // carries the freshest editor state.
        .then(() =>
          autosaveCaseStudyDraft(
            buildCaseStudyAutosaveFormData(inputRef.current),
          ),
        )
        .then((result) => {
          if (cancelled) return;
          if (result.status === "error") {
            scheduleRetryOrRest();
            return;
          }
          retryCount.current = 0;
          // "skipped" (half-typed fields) is non-destructive: keep the last
          // indicator rather than flashing an error for an in-progress edit.
          if (result.status === "saved") setAutosave(result);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("case study autosave failed", error);
          scheduleRetryOrRest();
        });
    }

    function scheduleRetryOrRest() {
      const used = retryCount.current;
      const delay = nextAutosaveRetryDelayMs(used);
      // Surface the honest failure state immediately (never claims "saved").
      setAutosave({
        status: "error",
        message: autosaveFailureMessage(autosaveFailureMode(used)),
      });
      if (delay === null) return; // cap reached — rest until next edit/manual save
      retryCount.current = used + 1;
      const retryTimer = window.setTimeout(() => {
        if (cancelled) return;
        runAttempt();
      }, delay);
      timers.push(retryTimer);
    }

    const debounceTimer = window.setTimeout(runAttempt, AUTOSAVE_DEBOUNCE_MS);
    timers.push(debounceTimer);

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [
    caseStudyId,
    status,
    title,
    slug,
    memberName,
    memberRole,
    excerpt,
    body,
    coverUrl,
    coverAlt,
    youtubeVideoId,
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
  ]);

  return { autosave, clearAutosave };
}
