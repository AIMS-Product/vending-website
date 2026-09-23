"use client";

import { usePathname } from "next/navigation";
import { AdminShell, adminSectionForPath } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";

// Signed-out screens have no Studio chrome.
const AUTH_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
];

// The page editor (/admin/pages/new, /admin/pages/<id>) renders immersive,
// without the sidebar; its sibling list screens do not.
function isImmersivePath(pathname: string) {
  const match = /^\/admin\/pages\/([^/]+)$/.exec(pathname);
  return Boolean(
    match && match[1] !== "redirects" && match[1] !== "block-preview-audit",
  );
}

/**
 * One loading state for every Studio route. Without it, navigating between
 * admin screens left the previous page on screen until the server finished,
 * because the only boundary was the public root loading.tsx, which does not
 * re-suspend for a change below /admin. The Studio shell and sidebar stay
 * put and the content area shows skeleton rows.
 */
export default function AdminLoading() {
  const pathname = usePathname() ?? "/admin";

  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return (
      <div
        aria-busy="true"
        data-admin-ui
        className="bg-ui-canvas min-h-screen"
      />
    );
  }

  return (
    <AdminShell
      activeSection={adminSectionForPath(pathname)}
      title="Loading"
      immersive={isImmersivePath(pathname)}
    >
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        <div className={adminPanelClass}>
          <div className="border-ui-line bg-ui-canvas h-10 border-b" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
            <div
              key={row}
              className="border-ui-line flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="bg-ui-canvas rounded-ui h-3.5 w-1/3 animate-pulse" />
              <div className="bg-ui-canvas rounded-ui h-3.5 w-1/5 animate-pulse" />
              <div className="bg-ui-canvas rounded-ui ml-auto h-3.5 w-16 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
