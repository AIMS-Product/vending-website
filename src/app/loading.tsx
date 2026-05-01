export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex flex-1 items-center justify-center px-6 py-24"
    >
      <div className="flex items-center gap-3 text-slate-500">
        <span
          className="size-3 animate-pulse rounded-full bg-sky-400"
          aria-hidden
        />
        <span className="text-sm">Loading…</span>
      </div>
    </main>
  );
}
