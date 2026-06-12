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
        className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
          toast.tone === "error"
            ? "border-red-200 bg-red-50/95 text-red-800"
            : toast.tone === "pending"
              ? "border-sky-200 bg-white/95 text-slate-800"
              : "border-emerald-200 bg-emerald-50/95 text-emerald-800"
        }`}
      >
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${
            toast.tone === "error"
              ? "bg-red-500"
              : toast.tone === "pending"
                ? "bg-sky-500"
                : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
