export default function Loading() {
  // Reserve a full viewport of height while content streams. The root
  // `loading.tsx` fallback paints first inside the streamed shell; if it is
  // short, the footer paints high on the page and then jumps down when the real
  // (taller) content arrives — a deterministic cold-load layout shift measured
  // at CLS 0.29. Holding ~100svh here keeps the footer below the fold from the
  // first paint, so swapping in real content doesn't move it.
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[100svh] flex-1 items-center justify-center px-6 py-24"
    >
      <div className="flex items-center gap-3 text-slate-500">
        <span
          className="size-3 animate-pulse rounded-full bg-sky-400"
          aria-hidden
        />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}
