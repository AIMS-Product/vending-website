import { afterEach, describe, expect, it, vi } from "vitest";

const captureEvent = vi.fn();
vi.mock("@/lib/tracking/posthog", () => ({
  captureEvent: (...args: unknown[]) => captureEvent(...args),
  SEND_NOW: { send_instantly: true, transport: "sendBeacon" },
}));

import {
  abandonmentProperties,
  formIdentity,
  isFormResolved,
  markFieldCompleted,
  markStarted,
  markSubmitAttempted,
  newProgress,
  resetResolvedForms,
  trackFormResult,
} from "./form-tracking";

afterEach(() => {
  captureEvent.mockReset();
  resetResolvedForms();
});

describe("formIdentity", () => {
  it("reads the step from data-form-step or the id suffix", () => {
    expect(formIdentity({ id: "lead-form-contact-step-1", step: "1" })).toEqual(
      {
        form_id: "lead-form-contact-step-1",
        form_name: "lead-form-contact",
        form_step: 1,
      },
    );
    expect(formIdentity({ id: "newsletter-signup-step-2" })).toEqual({
      form_id: "newsletter-signup-step-2",
      form_name: "newsletter-signup",
      form_step: 2,
    });
  });

  it("rejects forms with no usable step", () => {
    expect(formIdentity({ id: "search" })).toBeNull();
    expect(formIdentity({ id: "", step: "1" })).toBeNull();
  });
});

describe("abandonment", () => {
  const identity = formIdentity({ id: "lead-form-contact-step-1" })!;

  it("is nothing until the visitor started", () => {
    expect(
      abandonmentProperties(newProgress(identity), 1_000, false),
    ).toBeNull();
  });

  it("reports which field they got to and how long they spent", () => {
    let progress = markStarted(newProgress(identity), "full_name", 10_000);
    progress = markFieldCompleted(progress, "full_name");
    progress = markFieldCompleted(progress, "email");
    progress = markFieldCompleted(progress, "email");
    progress = markSubmitAttempted(progress);
    expect(abandonmentProperties(progress, 25_400, false)).toEqual({
      form_id: "lead-form-contact-step-1",
      form_name: "lead-form-contact",
      form_step: 1,
      first_field: "full_name",
      last_field: "email",
      fields_completed: 2,
      submit_attempted: true,
      seconds_on_form: 15,
    });
  });

  it("does not fire for a form that submitted successfully", () => {
    const progress = markStarted(newProgress(identity), "email", 0);
    expect(abandonmentProperties(progress, 5_000, true)).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const initial = newProgress(identity);
    const started = markStarted(initial, "email", 5);
    expect(initial.startedAt).toBeNull();
    expect(started.startedAt).toBe(5);
    expect(markStarted(started, "phone", 9)).toBe(started);
  });
});

describe("trackFormResult", () => {
  it("resolves the form on success and sends it instantly", () => {
    trackFormResult({
      formId: "lead-form-contact-step-1",
      ok: true,
      properties: {
        qualification_state: "perfect_fit",
        qualification_score: 90,
        blank: "",
      },
    });
    expect(isFormResolved("lead-form-contact-step-1")).toBe(true);
    expect(captureEvent).toHaveBeenCalledWith(
      "form_submitted",
      {
        form_id: "lead-form-contact-step-1",
        form_name: "lead-form-contact",
        form_step: 1,
        qualification_state: "perfect_fit",
        qualification_score: 90,
      },
      { send_instantly: true, transport: "sendBeacon" },
    );
  });

  it("leaves a failed form unresolved and carries the error keys", () => {
    trackFormResult({
      formId: "newsletter-signup-step-1",
      ok: false,
      errorKeys: ["email"],
    });
    expect(isFormResolved("newsletter-signup-step-1")).toBe(false);
    expect(captureEvent).toHaveBeenCalledWith(
      "form_submit_failed",
      {
        form_id: "newsletter-signup-step-1",
        form_name: "newsletter-signup",
        form_step: 1,
        error_keys: ["email"],
      },
      undefined,
    );
  });
});
