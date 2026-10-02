"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AdminShell, adminSectionForPath } from "@/components/admin/AdminShell";
import {
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";

// Signed-out screens have no Studio chrome (same list as loading.tsx).
const AUTH_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
];

/**
 * One error state for every Studio route. Without it a loader failure bubbled
 * to the public root error page: sky-blue, no sidebar, no way back to another
 * tab. Here the shell and sidebar stay put and the failure is a quiet panel.
 */
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname() ?? "/admin";

  useEffect(() => {
    console.error("[admin] page failed to load", {
      pathname,
      digest: error.digest,
      message: error.message,
    });
  }, [error, pathname]);

  const body = (
    <div className={`${adminPanelClass} px-6 py-10 text-center`} role="alert">
      <h2 className="text-ui-text text-base font-semibold">
        This page could not load
      </h2>
      <p className="text-ui-text-muted mx-auto mt-2 max-w-md text-sm">
        The data source did not answer. Try again in a moment; if it keeps
        happening, send us the reference below.
      </p>
      {error.digest ? (
        <p className="text-ui-text-subtle mt-2 text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={adminPrimaryButtonClass}
        >
          Try again
        </button>
        <Link href="/admin" className={adminSecondaryButtonClass}>
          Back to Overview
        </Link>
      </div>
    </div>
  );

  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return (
      <div data-admin-ui className="bg-ui-canvas min-h-screen p-6">
        {body}
      </div>
    );
  }

  return (
    <AdminShell
      activeSection={adminSectionForPath(pathname)}
      title="Something went wrong"
    >
      {body}
    </AdminShell>
  );
}
