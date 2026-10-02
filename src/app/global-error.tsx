"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// No layout renders here, so this stays self-contained: the public system's
// look (ink border, hard shadow, brand-700 fill, uppercase H1) as literals.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#eaf6ff] px-6 py-24 text-center font-sans antialiased">
        <title>Something went wrong</title>
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          Error
        </p>
        <h1 className="text-3xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          Something went wrong
        </h1>
        <p className="max-w-md text-lg font-semibold text-slate-700">
          A critical error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-sm text-slate-600">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#1f72a5] px-6 py-3 text-sm font-black text-white uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
