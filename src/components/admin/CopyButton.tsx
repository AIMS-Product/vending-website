"use client";

import { useEffect, useRef, useState } from "react";
import { adminSmallButtonClass } from "@/components/admin/AdminUi";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className={adminSmallButtonClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        } catch (error) {
          // Clipboard can be blocked by the browser; the link text is
          // selectable beside the button, so this is not worth an alert.
          console.warn("copy to clipboard blocked", error);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
