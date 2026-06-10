"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";
import { computeWalkthroughCardPlacement } from "@/components/admin/seo-page-editor/walkthrough-card-position";

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

type WalkthroughStep = keyof typeof walkthroughSteps;

// N15 / issue I17: the Quick Tour is now opt-in. Previously the controller
// auto-started it (set builderWalkthroughStep = 1) the first time the editor
// opened, which the review found intrusive. This component now drives tour
// visibility from its OWN local step state and ignores the controller's
// auto-start, so opening the editor never pops the tour. A persistent "Quick
// tour" launch button starts it on demand; finishing or skipping persists the
// seen-flag (which also stops the controller's legacy auto-start) and the user
// can re-launch any time. The positioning logic (computeWalkthroughCardPlacement
// + useWalkthroughTarget + data-builder-walkthrough targeting) is unchanged, so
// the prior tour-positioning fix is preserved.
const walkthroughSeenStorageKey = "page-builder-editor-walkthrough-seen";

export function BuilderEditorWalkthrough({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [activeStep, setActiveStep] = useState<WalkthroughStep | null>(null);

  // Ensure the panel a step points at is expanded so the highlight anchors to a
  // real on-screen target (steps: 1 = blocks, 2 = SEO, 3 = AI assistant which is
  // always mounted). Uses the controller's exposed toggles only.
  const revealPanelForStep = useCallback(
    (step: WalkthroughStep) => {
      if (step === 1 && editor.isBlockSidebarCollapsed) {
        editor.toggleBlockSidebar();
      } else if (step === 2 && editor.isSeoSidebarCollapsed) {
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
    setActiveStep((current) => {
      if (current === 1) {
        revealPanelForStep(2);
        return 2;
      }
      if (current === 2) {
        revealPanelForStep(3);
        return 3;
      }
      return current;
    });
  }, [revealPanelForStep]);

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
    <button
      type="button"
      aria-label="Start the quick tour"
      title="Take a quick tour of the builder"
      className="fixed bottom-4 left-4 z-[70] inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
      onClick={onStart}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 text-[#0b63f6]"
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
            className="pointer-events-none fixed z-[81] rounded-2xl ring-4 ring-[#0b63f6] ring-offset-2 ring-offset-transparent"
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
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
              Quick tour · Step {step} of 3
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                onClick={onSkip}
              >
                Skip tour
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
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
      <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
          Quick tour · Step {step} of 3
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            onClick={onSkip}
          >
            Skip tour
          </button>
          <button
            type="button"
            className="min-h-10 rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
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
