"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";
import { computeWalkthroughCardPlacement } from "@/components/admin/seo-page-editor/walkthrough-card-position";
import {
  nextWalkthroughStep,
  panelToRevealForStep,
  type WalkthroughStepId,
} from "@/components/admin/seo-page-editor/walkthrough-steps";

const walkthroughSteps = {
  1: {
    title: "Page structure",
    body: "This is where the structure of the page is.",
    target: "blocks",
    cta: "Next",
  },
  2: {
    title: "SEO settings",
    body: "This is where all the SEO stuff lives.",
    target: "seo",
    cta: "Next",
  },
  3: {
    title: "AI assistant",
    body: "This is your AI helper who can help create the full page for you.",
    target: "ai",
    cta: "Got it",
  },
} as const;

type WalkthroughStep = WalkthroughStepId;

// N15 / issue I17: the Quick Tour is opt-in and fully self-driven. The
// controller's legacy auto-start (builderWalkthroughStep) has been removed, so
// opening the editor never pops the tour. This component drives visibility
// from its OWN local step state; a persistent "Quick tour" launch button
// starts it on demand, and finishing or skipping persists the seen-flag so
// the user can re-launch any time. The positioning logic
// (computeWalkthroughCardPlacement + useWalkthroughTarget +
// data-builder-walkthrough targeting) is unchanged, so the prior
// tour-positioning fix is preserved.
const walkthroughSeenStorageKey = "page-builder-editor-walkthrough-seen";

export function BuilderEditorWalkthrough({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [activeStep, setActiveStep] = useState<WalkthroughStep | null>(null);

  // I1: revealing a panel toggles state OWNED BY the controller
  // (SeoPageEditorForm). That must never run during THIS component's render.
  // The old `advance` called this from inside a `setActiveStep` updater, which
  // runs in the render phase — the resulting controller setState produced the
  // "Cannot update a component (SeoPageEditorForm) while rendering a different
  // component (BuilderEditorWalkthrough)" warning. `revealPanelForStep` is only
  // ever invoked from click handlers (startTour / advance) below, where a
  // controller state update is safe. Steps: 1 = blocks, 2 = SEO, 3 = AI
  // assistant (always mounted).
  const revealPanelForStep = useCallback(
    (step: WalkthroughStep) => {
      const panel = panelToRevealForStep(step);
      if (panel === "blocks" && editor.isBlockSidebarCollapsed) {
        editor.toggleBlockSidebar();
      } else if (panel === "seo" && editor.isSeoSidebarCollapsed) {
        editor.toggleSeoSidebar();
      }
    },
    [editor],
  );

  const startTour = useCallback(() => {
    revealPanelForStep(1);
    setActiveStep(1);
  }, [revealPanelForStep]);

  const persistSeen = useCallback(() => {
    try {
      window.localStorage.setItem(walkthroughSeenStorageKey, "1");
    } catch {
      // Ignore private-browsing storage failures.
    }
  }, []);

  const endTour = useCallback(() => {
    persistSeen();
    setActiveStep(null);
  }, [persistSeen]);

  const advance = useCallback(() => {
    if (activeStep === null) return;
    const next = nextWalkthroughStep(activeStep);
    if (next === null) return;
    revealPanelForStep(next);
    setActiveStep(next);
  }, [activeStep, revealPanelForStep]);

  if (!activeStep) {
    return <QuickTourLauncher onStart={startTour} />;
  }

  const copy = walkthroughSteps[activeStep];

  return (
    <WalkthroughOverlay
      step={activeStep}
      targetKey={copy.target}
      title={copy.title}
      body={copy.body}
      cta={copy.cta}
      retryKey={`${activeStep}:${editor.isBlockSidebarCollapsed}:${editor.isSeoSidebarCollapsed}`}
      onContinue={activeStep === 3 ? endTour : advance}
      onSkip={endTour}
    />
  );
}

function QuickTourLauncher({ onStart }: { onStart: () => void }) {
  return (
    // I4: like the AI FAB, this bottom-left launcher would sit under the fixed
    // MobileEditorActionBar (z-60, full-width) below xl. Raise it above the bar
    // on narrow widths and restore the desktop placement at xl, where the bar
    // is hidden. z-index is unchanged so the launcher stays usable.
    <button
      type="button"
      aria-label="Start the quick tour"
      title="Take a quick tour of the builder"
      className="border-ui-line text-ui-text-muted hover:border-ui-line-strong hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 fixed bottom-28 left-4 z-[70] inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold shadow-lg transition focus-visible:ring-4 focus-visible:outline-none xl:bottom-4"
      onClick={onStart}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-ui-accent size-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
        <path d="M12 17h.01" />
      </svg>
      Quick tour
    </button>
  );
}

function WalkthroughOverlay({
  step,
  targetKey,
  title,
  body,
  cta,
  retryKey,
  onContinue,
  onSkip,
}: {
  step: WalkthroughStep;
  targetKey: string;
  title: string;
  body: string;
  cta: string;
  retryKey: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const targetRect = useWalkthroughTarget(targetKey, retryKey);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Skip walkthrough"
        className="absolute inset-0 bg-slate-950/55"
        onClick={onSkip}
      />

      {targetRect ? (
        <>
          <div
            aria-hidden="true"
            className="ring-ui-accent pointer-events-none fixed z-[81] rounded-2xl ring-4 ring-offset-2 ring-offset-transparent"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
          <WalkthroughCard
            step={step}
            title={title}
            body={body}
            cta={cta}
            targetRect={targetRect}
            onContinue={onContinue}
            onSkip={onSkip}
          />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[82] grid place-items-center px-4">
          <div className="border-ui-line pointer-events-auto w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl">
            <p className="text-ui-accent text-xs font-semibold tracking-wider uppercase">
              Quick tour · Step {step} of 3
            </p>
            <h3 className="text-ui-text mt-2 text-lg font-semibold">{title}</h3>
            <p className="text-ui-text-muted mt-2 text-sm leading-6">{body}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-ui-text-subtle hover:text-ui-text-muted text-sm font-semibold transition"
                onClick={onSkip}
              >
                Skip tour
              </button>
              <button
                type="button"
                className="border-ui-accent bg-ui-accent focus-visible:ring-ui-accent/20 min-h-10 rounded-lg border px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:outline-none"
                onClick={onContinue}
              >
                {cta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalkthroughCard({
  step,
  title,
  body,
  cta,
  targetRect,
  onContinue,
  onSkip,
}: {
  step: WalkthroughStep;
  title: string;
  body: string;
  cta: string;
  targetRect: DOMRect;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { top, left } = computeWalkthroughCardPlacement(targetRect, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  return (
    <div
      className="pointer-events-none fixed z-[82] w-[min(20rem,calc(100vw-2rem))]"
      style={{ top, left }}
    >
      <div className="border-ui-line pointer-events-auto rounded-2xl border bg-white p-5 shadow-2xl">
        <p className="text-ui-accent text-xs font-semibold tracking-wider uppercase">
          Quick tour · Step {step} of 3
        </p>
        <h3 className="text-ui-text mt-2 text-lg font-semibold">{title}</h3>
        <p className="text-ui-text-muted mt-2 text-sm leading-6">{body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-ui-text-subtle hover:text-ui-text-muted text-sm font-semibold transition"
            onClick={onSkip}
          >
            Skip tour
          </button>
          <button
            type="button"
            className="border-ui-accent bg-ui-accent focus-visible:ring-ui-accent/20 min-h-10 rounded-lg border px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:outline-none"
            onClick={onContinue}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function useWalkthroughTarget(targetKey: string, retryKey: string) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    function updateTargetRect() {
      const element = document.querySelector(
        `[data-builder-walkthrough="${targetKey}"]`,
      );
      setTargetRect(element?.getBoundingClientRect() ?? null);
    }

    updateTargetRect();
    const retryTimer = window.setTimeout(updateTargetRect, 180);
    const secondRetryTimer = window.setTimeout(updateTargetRect, 360);
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(secondRetryTimer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [retryKey, targetKey]);

  return targetRect;
}
