"use client";

import { useEffect, useState } from "react";
import { pollUntilLive } from "@/components/admin/seo-page-editor/live-page-poll";

// Shown after a publish completes. The "Open live page" link is withheld until
// the route actually responds — right after publish there is a brief window
// where it still 404s, and a dead link there would be a worse outcome than a
// short "may take a moment" wait.
export function PublishSuccessCard({ livePageUrl }: { livePageUrl: string }) {
  const [phase, setPhase] = useState<"checking" | "live" | "slow">("checking");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    pollUntilLive(livePageUrl, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setPhase(result === "live" ? "live" : "slow");
      })
      .catch(() => {
        if (!cancelled) setPhase("slow");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [livePageUrl]);

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
        <h3 className="text-sm font-semibold text-emerald-900">Published</h3>
      </div>
      <p className="mt-1.5 text-sm leading-5 text-emerald-800">
        This page is now the live public version.
      </p>
      <div className="mt-3">
        {phase === "live" ? (
          <a
            href={livePageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 focus-visible:ring-4 focus-visible:ring-emerald-200 focus-visible:outline-none"
          >
            Open live page
          </a>
        ) : (
          <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
            <span
              className="size-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600"
              aria-hidden="true"
            />
            {phase === "slow"
              ? "Live page may take a moment to appear — try refreshing shortly."
              : "Checking that the live page is reachable…"}
          </p>
        )}
      </div>
    </section>
  );
}
