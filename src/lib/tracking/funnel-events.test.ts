import { describe, expect, it } from "vitest";
import { MASTERCLASS_BUSY_MESSAGE } from "@/lib/content/masterclass";
import {
  checkoutClickEvents,
  masterclassFormErrorEvent,
  masterclassFormStartEvent,
  scrollCtaEvents,
  trackedClickEvents,
  claimOnce,
  pickUtms,
  registeredEvents,
  registrationFailure,
} from "./funnel-events";

const PII = /@|\+1|555|jane|doe/i;

describe("registrationFailure", () => {
  it("reports field names and a validation reason, never messages or values", () => {
    const out = registrationFailure({
      email: "Enter a valid email",
      phone: "bad",
    });
    expect(out).toEqual({
      reason: "validation",
      errorKeys: ["email", "phone"],
    });
  });

  it("separates the limiter from a server failure", () => {
    expect(registrationFailure({ form: MASTERCLASS_BUSY_MESSAGE }).reason).toBe(
      "busy",
    );
    expect(
      registrationFailure({ form: "We could not save your seat" }),
    ).toEqual({
      reason: "failed",
      errorKeys: ["form"],
    });
  });
});

describe("registeredEvents", () => {
  it("carries utms and no contact fields", () => {
    const utms = pickUtms(
      "?utm_source=hc&utm_campaign=hc&utm_content=ad1&email=jane@doe.com&first=Jane",
    );
    expect(utms).toEqual({
      utm_source: "hc",
      utm_campaign: "hc",
      utm_content: "ad1",
    });
    const events = registeredEvents(utms);
    expect(events.dataLayer.map((e) => e.event)).toEqual([
      "masterclass_registered",
      "vp_lead_submit",
    ]);
    expect(JSON.stringify(events)).not.toMatch(PII);
    expect(JSON.stringify(events)).not.toMatch(/lead_email|lead_phone/);
  });
});

describe("claimOnce", () => {
  it("is true once per session key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(claimOnce(storage, "k")).toBe(true);
    expect(claimOnce(storage, "k")).toBe(false);
    expect(claimOnce(null, "k")).toBe(true);
  });

  it("still fires when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(claimOnce(broken, "k")).toBe(true);
  });
});

describe("checkoutClickEvents", () => {
  it("has the placement and drops the query string", () => {
    const events = checkoutClickEvents(
      "hero",
      "https://webinar.vendingpreneurs.com/checkout?email=a@b.co&first=Jane",
    );
    expect(events.posthog).toEqual({
      placement: "hero",
      destination: "webinar.vendingpreneurs.com/checkout",
    });
    expect(events.dataLayer).toMatchObject({
      event: "vp_checkout_click",
      placement: "hero",
    });
    expect(JSON.stringify(events)).not.toMatch(PII);
  });
});

describe("scrollCtaEvents", () => {
  it("names the location only, under its own event name", () => {
    expect(scrollCtaEvents("sticky")).toEqual({
      posthog: {
        name: "scroll_cta_clicked",
        properties: { location: "sticky" },
      },
      dataLayer: { event: "vp_cta_click", location: "sticky" },
    });
  });
});

describe("trackedClickEvents", () => {
  it("maps a known click to PostHog and the dataLayer, detail only", () => {
    expect(trackedClickEvents("calendar_added", "google")).toEqual({
      posthog: { name: "calendar_added", properties: { detail: "google" } },
      dataLayer: { event: "vp_calendar_add", detail: "google" },
    });
    expect(trackedClickEvents("playbook_clicked", undefined)).toEqual({
      posthog: { name: "playbook_clicked", properties: {} },
      dataLayer: { event: "vp_playbook_click" },
    });
  });
  it("ignores unknown names", () => {
    expect(trackedClickEvents("anything_else", "x")).toBeNull();
    expect(trackedClickEvents("toString", undefined)).toBeNull();
    expect(trackedClickEvents("constructor", undefined)).toBeNull();
  });
});

describe("masterclass GA4 form events", () => {
  it("carry names, reasons and field keys only", () => {
    expect(masterclassFormStartEvent()).toEqual({
      event: "vp_form_start",
      intent: "masterclass",
      form_step: 1,
    });
    expect(masterclassFormErrorEvent("validation", ["email"])).toEqual({
      event: "vp_lead_submit_error",
      intent: "masterclass",
      form_step: 1,
      reason: "validation",
      error_keys: ["email"],
    });
  });
});
