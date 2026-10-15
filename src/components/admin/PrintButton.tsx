"use client";

import { adminLinkClass } from "@/components/admin/AdminUi";

/** Opens the browser's print dialog; the page's `print:` styles do the rest. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${adminLinkClass} text-xs print:hidden`}
    >
      Print
    </button>
  );
}
