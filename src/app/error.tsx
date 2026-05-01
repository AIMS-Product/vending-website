"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
        Something went wrong
      </h1>
      <p className="max-w-md text-slate-600">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-2 inline-flex items-center rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-sky-600"
      >
        Try again
      </button>
    </div>
  );
}
