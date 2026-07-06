"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  autosaveNewsDraft,
  type NewsAutosaveResult,
} from "@/app/admin/news/actions";
import {
  autosaveFailureMessage,
  autosaveFailureMode,
  nextAutosaveRetryDelayMs,
} from "@/components/admin/seo-page-editor/autosave-retry-policy";

// I5: news-editor autosave, mirroring the proven SEO page-editor orchestration
// (debounce → serialized request → retry-with-backoff-then-rest) but scoped to
// news drafts. It reuses the SEO autosave-retry-policy so the "retry storm"
// guard and the honest, never-"saved" failure copy stay identical across
// editors. See autosaveNewsDraft in the news actions for the draft-only
// server invariants this hook depends on.

const AUTOSAVE_DEBOUNCE_MS = 1200;

// The editor content this hook watches. Autosave only runs once a persisted row
// exists (`postId`), matching the server action's id-required invariant — a
// brand-new, never-saved post is protected by manual "Save draft", not autosave.
export type NewsAutosaveInput = {
  postId: string | null;
  status: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  coverAlt: string;
};

export type NewsAutosaveState = NewsAutosaveResult | null;

// Whether autosave may run for this post. Exported + pure so the invariants are
// unit-testable without driving React effects in a DOM. Two gates:
// - id-required: autosave only ever updates an existing row, never creates one.
// - draft-only: news is single-source — a published post's body/slug ARE the
//   live content, so a background save would silently edit the public site.
//   Published (and archived) posts save only through the explicit buttons.
export function newsAutosaveEnabled(
  input: Pick<NewsAutosaveInput, "postId" | "status">,
): boolean {
  return Boolean(input.postId) && input.status === "draft";
}

// Pure payload builder shared by the hook and its test. Mirrors the SEO
// editor's editor-autosave-payload module: it carries content fields ONLY (no
// intent, no status), so the server action it feeds cannot change publication
// state.
export function buildNewsAutosaveFormData(input: NewsAutosaveInput): FormData {
  const formData = new FormData();
  formData.set("id", input.postId ?? "");
  formData.set("title", input.title);
  formData.set("slug", input.slug);
  formData.set("excerpt", input.excerpt);
  formData.set("body", input.body);
  formData.set("cover_url", input.coverUrl);
  formData.set("cover_alt", input.coverAlt);
  return formData;
}

export function useNewsAutosave(input: NewsAutosaveInput): {
  autosave: NewsAutosaveState;
  clearAutosave: () => void;
} {
  const [autosave, setAutosave] = useState<NewsAutosaveState>(null);

  // Skip the very first render for a given post so simply opening the editor
  // never triggers a save; only real edits after mount do.
  const armed = useRef(false);
  // Serialize requests: the draft update is a blind full-content write, so two
  // overlapping autosaves could commit out of order and regress the draft.
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  // Retries used by the CURRENT failure run; reset to 0 on a fresh edit or a
  // successful save so a new attempt is never treated as a continuation of an
  // exhausted failure.
  const retryCount = useRef(0);

  // Mirror the latest input into a ref so a serialized/replayed save reads the
  // freshest editor state, not the value captured when the request was queued.
  // Written in an effect (never during render) per the repo's react-hooks rules.
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  });

  const clearAutosave = useCallback(() => {
    // A manual save persists the whole row and supersedes any pending autosave
    // failure — clear the stale indicator and re-arm the retry budget.
    retryCount.current = 0;
    setAutosave(null);
  }, []);

  const { postId, status, title, slug, excerpt, body, coverUrl, coverAlt } =
    input;

  useEffect(() => {
    if (!newsAutosaveEnabled({ postId, status })) return;
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
          autosaveNewsDraft(buildNewsAutosaveFormData(inputRef.current)),
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
          console.error("news autosave failed", error);
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
  }, [postId, status, title, slug, excerpt, body, coverUrl, coverAlt]);

  return { autosave, clearAutosave };
}
