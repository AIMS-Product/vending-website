"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNeverSavedSeoPageDraft } from "@/app/admin/pages/actions";
import {
  discardableDraftId,
  isAutoCreatedNeverSavedDraft,
} from "@/components/admin/seo-page-editor/unsaved-exit-guard-state";
import type { UnsavedExitChoice } from "@/components/admin/seo-page-editor/UnsavedExitDialog";

type UseUnsavedExitGuardInput = {
  // `editor.page?.id` — present only for a row loaded from server props, i.e.
  // explicitly saved / published / opened.
  loadedPageId: string | null | undefined;
  // `editor.effectivePageId` — `page?.id ?? createdDraftId`.
  effectivePageId: string | null | undefined;
  // True once the user explicitly saved/published this session (derived in the
  // form from `editor.state.status === "saved"` and `editor.savedFromRedirect`).
  // Needed because an explicit Save on an already auto-created row does not
  // remount, so `loadedPageId` stays undefined.
  explicitlySavedThisSession: boolean;
  // Triggers the editor form's own "Save draft" submit. After it persists, the
  // guard disarms (via `explicitlySavedThisSession`), and on brand-new pages
  // the action also redirects and remounts with a real `page`.
  onSaveDraft: () => void;
};

export type UnsavedExitGuard = {
  isOpen: boolean;
  isDiscarding: boolean;
  errorMessage: string | null;
  resolve: (choice: UnsavedExitChoice) => void;
};

// Detects whether a click is a plain primary-button navigation we should
// intercept, versus one the browser will handle specially (new tab, download,
// modified click) and which must be left alone.
export function isPlainNavigationClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

// Resolves the anchor a click landed on, when it is a same-origin internal
// link that would navigate away (not a new tab, not a download, not a hash on
// the current page).
export function internalNavTargetFromClick(event: MouseEvent): string | null {
  const path = event.composedPath?.() ?? [];
  const anchor = (path.find(
    (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement,
  ) ??
    (event.target instanceof Element
      ? event.target.closest("a")
      : null)) as HTMLAnchorElement | null;

  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const href = anchor.getAttribute("href");
  if (!href) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same path + only a hash change is not a real "leave the editor" navigation.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  ) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function useUnsavedExitGuard({
  loadedPageId,
  effectivePageId,
  explicitlySavedThisSession,
  onSaveDraft,
}: UseUnsavedExitGuardInput): UnsavedExitGuard {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingHrefRef = useRef<string | null>(null);

  const guardInput = {
    loadedPageId,
    effectivePageId,
    explicitlySavedThisSession,
  };
  const armed = isAutoCreatedNeverSavedDraft(guardInput);
  const draftId = discardableDraftId(guardInput);
  // Keep the armed flag and discardable id in refs so the long-lived document
  // listener and async discard handler always read current values without
  // re-subscribing each render. Refs are synced in an effect, never in render.
  const armedRef = useRef(armed);
  const draftIdRef = useRef<string | null>(draftId);
  useEffect(() => {
    armedRef.current = armed;
    draftIdRef.current = draftId;
  }, [armed, draftId]);

  useEffect(() => {
    if (!armed) return;

    function handleClickCapture(event: MouseEvent) {
      if (!armedRef.current) return;
      if (!isPlainNavigationClick(event)) return;
      const href = internalNavTargetFromClick(event);
      if (!href) return;

      // Intercept before next/link's own click handler runs so the SPA
      // navigation never starts until the user resolves the dialog.
      event.preventDefault();
      event.stopPropagation();
      pendingHrefRef.current = href;
      setErrorMessage(null);
      setIsOpen(true);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!armedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", handleClickCapture, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [armed]);

  const resolve = useCallback(
    (choice: UnsavedExitChoice) => {
      if (choice === "stay") {
        pendingHrefRef.current = null;
        setErrorMessage(null);
        setIsOpen(false);
        return;
      }

      if (choice === "save") {
        // Persist via the editor's own Save draft submit, then continue to the
        // pending destination once it has navigated/remounted. Closing the
        // dialog and following the link keeps the in-app flow intact.
        const href = pendingHrefRef.current;
        setIsOpen(false);
        onSaveDraft();
        if (href) router.push(href);
        pendingHrefRef.current = null;
        return;
      }

      // choice === "discard"
      const draftId = draftIdRef.current;
      if (!draftId) {
        const href = pendingHrefRef.current;
        pendingHrefRef.current = null;
        setIsOpen(false);
        if (href) router.push(href);
        return;
      }

      setIsDiscarding(true);
      setErrorMessage(null);
      void deleteNeverSavedSeoPageDraft(draftId)
        .then((result) => {
          if (result.status === "deleted") {
            const href = pendingHrefRef.current ?? "/admin/pages";
            pendingHrefRef.current = null;
            setIsOpen(false);
            // Disarm the beforeunload guard for the upcoming navigation.
            armedRef.current = false;
            router.push(href);
            return;
          }
          setErrorMessage(result.message);
        })
        .catch(() => {
          setErrorMessage(
            "Could not discard the draft. Use Save draft to keep it.",
          );
        })
        .finally(() => {
          setIsDiscarding(false);
        });
    },
    [onSaveDraft, router],
  );

  return { isOpen, isDiscarding, errorMessage, resolve };
}
