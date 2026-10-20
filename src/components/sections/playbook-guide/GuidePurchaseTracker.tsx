"use client";

import { useEffect } from "react";
import { captureEvent, SEND_NOW } from "@/lib/tracking/posthog";
import { pushDataLayerEvent } from "@/lib/tracking/lead-events";

interface GuidePurchaseTrackerProps {
  sessionId: string;
  value: number;
  currency: string;
}

type Fbq = (...args: unknown[]) => void;

/**
 * Browser purchase events for the $5 playbook, once per order (keyed on the
 * Stripe session, so a reload or a second visit does not re-count). Meta's
 * eventID matches the server-side Conversions API event, so Meta dedupes.
 * Rendered only for live-mode payments.
 */
export function GuidePurchaseTracker({
  sessionId,
  value,
  currency,
}: GuidePurchaseTrackerProps) {
  useEffect(() => {
    const key = `vp_guide_purchase_${sessionId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch (error) {
      console.warn("guide purchase: storage unavailable", error);
    }
    const item = {
      item_id: "first-location-playbook",
      item_name: "The First Location Playbook",
      price: value,
      quantity: 1,
    };
    pushDataLayerEvent({ ecommerce: null });
    pushDataLayerEvent({
      event: "purchase",
      ecommerce: { transaction_id: sessionId, value, currency, items: [item] },
    });
    pushDataLayerEvent({
      event: "vp_playbook_guide_purchase",
      value,
      currency,
      transaction_id: sessionId,
    });
    captureEvent(
      "playbook_guide_purchased",
      { value, currency, transaction_id: sessionId },
      SEND_NOW,
    );
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    fbq?.(
      "track",
      "Purchase",
      {
        value,
        currency,
        content_name: item.item_name,
        content_ids: [item.item_id],
        content_type: "product",
      },
      { eventID: sessionId },
    );
  }, [sessionId, value, currency]);
  return null;
}
