"use client";

import type { ComponentProps, MouseEvent } from "react";
import {
  emitAttributionEvent,
  refreshStoredSession,
} from "@/lib/attribution-client";

/** Booking clicks use the root tracker. This records the other hub paths once,
 * including external exits, without delaying or preventing navigation. */
export function MikeBioLink({
  linkId,
  videoId,
  ...props
}: ComponentProps<"a"> & { linkId: string; videoId?: string }) {
  function track(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const session = refreshStoredSession();
    if (!session) return;
    const url = new URL(event.currentTarget.href);
    emitAttributionEvent("cta_clicked", session, {
      page_path: "/mike",
      source_path: "/mike",
      source_page_slug: "mike-ig-bio",
      source_cta_tracking_name: linkId,
      button_id: linkId,
      video_id: videoId,
      clicked_href: url.href,
      destination_href: url.href,
      destination_content: url.searchParams.get("utm_content") ?? undefined,
      destination_term: url.searchParams.get("utm_term") ?? undefined,
    });
  }
  return (
    <a
      {...props}
      onClick={track}
      onAuxClick={(event) => {
        if (event.button === 1) track(event);
      }}
    />
  );
}
