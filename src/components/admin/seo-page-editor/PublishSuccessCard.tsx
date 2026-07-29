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
      className="rounded-ui-lg border-ui-ok/25 bg-ui-ok-fill border p-4"
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
          className="text-ui-ok"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
        <h3 className="text-ui-ok-ink text-sm font-semibold">Published</h3>
      </div>
      <p className="text-ui-ok-ink mt-1.5 text-sm leading-5">
        This page is now the live public version.
      </p>
      <div className="mt-3">
        {phase === "live" ? (
          <a
            href={livePageUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-ui-lg border-ui-ok/25 bg-ui-surface text-ui-ok-ink shadow-ui hover:bg-ui-ok-fill focus-visible:ring-ui-ok/25 inline-flex min-h-9 items-center justify-center border px-3 text-xs font-semibold transition focus-visible:ring-4 focus-visible:outline-none"
          >
            Open live page
          </a>
        ) : (
          <p className="text-ui-ok-ink inline-flex items-center gap-2 text-xs font-medium">
            <span
              className="border-ui-ok/25 border-t-ui-ok size-3 animate-spin rounded-full border-2"
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
