"use client";

import { AdminStatusBadge } from "@/components/admin/AdminUi";
import {
  DEFINITIONS_ID,
  type UnverifiedFlag,
} from "@/lib/analytics/data-trust-bar";

/**
 * Opens the glossary (a closed <details> on the analytics tabs) and lets the
 * anchor scroll to it.
 */
export function DefinitionsLink() {
  return (
    <a
      href={`#${DEFINITIONS_ID}`}
      onClick={() => {
        const target = document.getElementById(DEFINITIONS_ID);
        if (target instanceof HTMLDetailsElement) target.open = true;
      }}
      className="text-ui-accent text-xs font-medium underline-offset-2 hover:underline"
    >
      Definitions
    </a>
  );
}

/**
 * Sits next to a number whose check did not pass last night. The reason is on
 * hover here and in visible text in the trust bar, which is what a phone sees.
 */
export function UnverifiedMark({ flag }: { flag: UnverifiedFlag | undefined }) {
  if (!flag) return null;
  return (
    <span title={flag.reason} className="ml-1.5 align-middle">
      <AdminStatusBadge status="unverified" tone="warn" label="Unverified" />
    </span>
  );
}
