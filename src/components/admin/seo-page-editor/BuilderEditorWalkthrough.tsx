"use client";

import { useLayoutEffect, useState } from "react";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

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

export function BuilderEditorWalkthrough({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const step = editor.builderWalkthroughStep;
  if (!step) return null;

  const copy = walkthroughSteps[step as WalkthroughStep];

  return (
    <WalkthroughOverlay
      step={step as WalkthroughStep}
      targetKey={copy.target}
      title={copy.title}
      body={copy.body}
      cta={copy.cta}
      retryKey={`${step}:${editor.isBlockSidebarCollapsed}:${editor.isSeoSidebarCollapsed}`}
      onContinue={
        step === 3
          ? editor.finishBuilderWalkthrough
          : editor.advanceBuilderWalkthrough
      }
      onSkip={editor.dismissBuilderWalkthrough}
    />
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
  const cardWidth = 320;
  const viewportPadding = 16;
  const preferredTop = targetRect.bottom + 16;
  const fitsBelow = preferredTop + 180 <= window.innerHeight - viewportPadding;
  const top = fitsBelow
    ? preferredTop
    : Math.max(viewportPadding, targetRect.top - 180);
  const left = Math.min(
    Math.max(viewportPadding, targetRect.left),
    window.innerWidth - cardWidth - viewportPadding,
  );

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
