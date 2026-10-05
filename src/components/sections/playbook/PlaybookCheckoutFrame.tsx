"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PLAYBOOK_THANK_YOU_PATH,
  checkoutFrameHeight,
  isCheckoutComplete,
} from "@/lib/content/playbook";

/** Tall enough for step 1 of the order form before the first height message. */
const INITIAL_HEIGHT = 560;

/**
 * GHL's order form in an iframe. The GHL step posts its height so the frame
 * grows with step 2 instead of scrolling inside itself; after payment the
 * framed thank-you page posts "complete" and this page moves to it, keeping
 * its own query (UTMs) for the purchase event. `payment` allows wallet pay.
 */
export function PlaybookCheckoutFrame({ src }: { src: string }) {
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const router = useRouter();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        isCheckoutComplete(event.origin, window.location.origin, event.data)
      ) {
        router.push(`${PLAYBOOK_THANK_YOU_PATH}${window.location.search}`);
        return;
      }
      const next = checkoutFrameHeight(event.origin, event.data);
      if (next !== null) setHeight(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <iframe
      src={src}
      title="Secure checkout"
      allow="payment"
      className="block w-full border-0 bg-white"
      style={{ height }}
    />
  );
}
