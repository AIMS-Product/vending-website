"use client";

import dynamic from "next/dynamic";
import type { Popup } from "@/lib/content/popups";

// SitePopup renders null until a trigger fires, so skipping SSR changes no
// markup; it only keeps the popup code out of the initial JS.
const SitePopup = dynamic(
  () => import("./SitePopup").then((m) => m.SitePopup),
  { ssr: false },
);

export function SitePopupLoader({ popups }: { popups: Popup[] }) {
  return <SitePopup popups={popups} />;
}
