import { describe, expect, it } from "vitest";
import {
  bookingClickEvent,
  formStartEvent,
  leadQualifiedEvent,
  leadSubmitErrorEvent,
  leadSubmitEvent,
  pushDataLayerEvent,
} from "./lead-events";
import { emptyLeadAttribution } from "@/lib/lead-attribution";

const attribution = {
  ...emptyLeadAttribution("/contact"),
  vp_session_id: "sess_1",
  gclid: "gclid_1",
  gbraid: "",
  wbraid: "",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "spring",
  utm_term: "",
  utm_content: "",
};

describe("lead tracking events", () => {
  it("formStartEvent carries the step and attribution but no lead PII", () => {
    const event = formStartEvent(attribution, "qualification", 1);
    expect(event).toMatchObject({
      event: "vp_form_start",
      form_step: 1,
      intent: "qualification",
      vp_session_id: "sess_1",
      gclid: "gclid_1",
      utm_source: "google",
    });
    expect(event).not.toHaveProperty("lead_email");
  });

  it("leadSubmitEvent includes contact fields and idempotency key", () => {
    const event = leadSubmitEvent(attribution, "contact", 1, {
      leadEmail: "a@b.com",
      leadPhone: "555",
      idempotencyKey: "idem-1",
    });
    expect(event).toMatchObject({
      event: "vp_lead_submit",
      lead_email: "a@b.com",
      lead_phone: "555",
      idempotency_key: "idem-1",
      gclid: "gclid_1",
    });
  });

  it("leadQualifiedEvent includes the fit result", () => {
    const event = leadQualifiedEvent(attribution, "qualification", 2, {
      leadEmail: "a@b.com",
      leadPhone: "555",
      idempotencyKey: "idem-1",
      qualificationState: "strong_fit",
      qualificationScore: 72,
    });
    expect(event).toMatchObject({
      event: "vp_lead_qualified",
      qualification_state: "strong_fit",
      qualification_score: 72,
      form_step: 2,
    });
  });

  it("leadSubmitErrorEvent carries the failed field keys", () => {
    const event = leadSubmitErrorEvent(attribution, "apply", 1, [
      "email",
      "phone",
    ]);
    expect(event).toMatchObject({
      event: "vp_lead_submit_error",
      error_keys: ["email", "phone"],
    });
  });

  it("bookingClickEvent carries the resolved href and qualification state", () => {
    const event = bookingClickEvent(attribution, "qualification", {
      bookingHref: "https://calendly.com/d/abc?email=a%40b.com",
      qualificationState: "perfect_fit",
    });
    expect(event).toMatchObject({
      event: "vp_booking_click",
      booking_href: "https://calendly.com/d/abc?email=a%40b.com",
      qualification_state: "perfect_fit",
    });
  });

  it("pushDataLayerEvent is a no-op outside the browser", () => {
    expect(() => pushDataLayerEvent({ event: "vp_form_start" })).not.toThrow();
  });
});
