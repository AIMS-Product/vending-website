"use client";

import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

type ManualSubmitToast = NonNullable<
  SeoPageEditorController["manualSubmitToast"]
>;

export function SeoEditorManualSubmitToast({
  toast,
}: {
  toast: ManualSubmitToast | null;
}) {
  if (!toast) return null;

  return (
    // One toast container, keyed by message+tone, so a single save announces
    // exactly once: re-renders with the same message reuse the same node (no
    // duplicate "Draft saved" toast), and a genuinely new message remounts to
    // re-announce. Only one manual save/publish toast can be shown at a time.
    <div className="pointer-events-none fixed top-5 right-4 z-[90] flex w-[calc(100vw-2rem)] justify-end sm:right-6">
      <div
        key={`${toast.tone}:${toast.message}`}
        role={toast.tone === "error" ? "alert" : "status"}
        aria-live={toast.tone === "error" ? "assertive" : "polite"}
        className={`rounded-ui-lg shadow-ui-raised pointer-events-auto flex max-w-sm items-start gap-3 border px-4 py-3 text-sm font-semibold backdrop-blur ${
          toast.tone === "error"
            ? "border-ui-bad/25 bg-ui-bad-fill/95 text-ui-bad-ink"
            : toast.tone === "pending"
              ? "text-ui-text border-ui-accent/25 bg-ui-surface/95"
              : "border-ui-ok/25 bg-ui-ok-fill/95 text-ui-ok-ink"
        }`}
      >
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${
            toast.tone === "error"
              ? "bg-ui-bad"
              : toast.tone === "pending"
                ? "bg-ui-accent"
                : "bg-ui-ok"
          }`}
          aria-hidden="true"
        />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
