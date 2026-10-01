import { describe, expect, it } from "vitest";
import { GA4_MEASUREMENT_ID, ga4Command } from "./ga4-forward";

describe("ga4Command", () => {
  it("forwards a funnel event with allowed params only", () => {
    expect(
      ga4Command({
        event: "vp_lead_submit",
        intent: "masterclass",
        form_step: 1,
        utm_source: "fb",
        lead_email: "a@b.co",
        lead_phone: "+15415550100",
        idempotency_key: "k",
      }),
    ).toEqual([
      "event",
      "vp_lead_submit",
      {
        send_to: GA4_MEASUREMENT_ID,
        intent: "masterclass",
        form_step: 1,
        utm_source: "fb",
      },
    ]);
  });

  it("joins error keys and ignores unknown events", () => {
    expect(
      ga4Command({
        event: "vp_lead_submit_error",
        error_keys: ["email", "phone"],
      }),
    ).toEqual([
      "event",
      "vp_lead_submit_error",
      { send_to: GA4_MEASUREMENT_ID, error_keys: "email,phone" },
    ]);
    expect(ga4Command({ event: "gtm.js" })).toBeNull();
    expect(ga4Command({ event: "toString" })).toBeNull();
  });
});
