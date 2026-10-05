"use client";

import { useEffect } from "react";
import { CHECKOUT_COMPLETE_MESSAGE } from "@/lib/content/playbook";
import { trackPlaybookPurchase } from "@/lib/tracking/funnel-events";

/**
 * GHL redirects inside the checkout iframe, so this page first lands framed.
 * Framed: tell the checkout page (it navigates itself here) and also try to
 * take over the tab directly, which works when both are on the same host.
 * The purchase is recorded on the top-level load only.
 */
export function PlaybookThankYouBreakout() {
  useEffect(() => {
    if (window.top && window.top !== window.self) {
      window.parent.postMessage({ type: CHECKOUT_COMPLETE_MESSAGE }, "*");
      try {
        window.top.location.href = window.location.href;
      } catch (error) {
        // Cross-host parent: the message above makes it navigate instead.
        console.warn("playbook thank-you: top navigation blocked", error);
      }
      return;
    }
    // ?preview=1 is the team-review link: look without counting a sale.
    if (new URLSearchParams(window.location.search).has("preview")) return;
    trackPlaybookPurchase();
  }, []);
  return null;
}
