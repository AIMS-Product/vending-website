"use client";

import { useEffect } from "react";
import { reportMarkedBookedCall } from "@/lib/tracking/booked-call";

/** Mounted on /pre-call-resources: reports the booking that sent the visitor here. */
export function BookedCallConversion() {
  useEffect(() => {
    reportMarkedBookedCall(
      process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO,
    );
  }, []);
  return null;
}
