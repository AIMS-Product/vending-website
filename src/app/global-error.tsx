"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 py-24 text-center font-sans antialiased">
        <title>Something went wrong</title>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Something went wrong
        </h1>
        <p className="max-w-md text-slate-600">
          A critical error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-2 inline-flex items-center rounded-full bg-sky-700 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-sky-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
