import { describe, expect, it } from "vitest";
import {
  APPLY_THANK_YOU_PATH,
  resolveLeadSuccessTransition,
  type PublicLeadActionState,
} from "./lead-action-state";

const success: PublicLeadActionState = {
  status: "success",
  message: "Thanks.",
  leadId: "lead-1",
};

describe("resolveLeadSuccessTransition", () => {
  it("redirects apply leads to the thank-you page on success", () => {
    expect(
      resolveLeadSuccessTransition(success, "apply", "person@example.com"),
    ).toEqual({ kind: "redirect", href: APPLY_THANK_YOU_PATH });
  });

  it("uses an action-supplied redirect when qualification intake succeeds", () => {
    expect(
      resolveLeadSuccessTransition(
        { ...success, redirectHref: "/qualify/raw_token" },
        "qualification",
        "person@example.com",
      ),
    ).toEqual({ kind: "redirect", href: "/qualify/raw_token" });
  });

  it("returns a qualification-result transition when the inline funnel scores a fit", () => {
    expect(
      resolveLeadSuccessTransition(
        {
          ...success,
          qualification: { thankYouState: "perfect_fit", score: 100 },
        },
        "qualification",
        "person@example.com",
      ),
    ).toEqual({
      kind: "qualification-result",
      state: "perfect_fit",
      score: 100,
    });
  });

  it("returns null for qualification success without a redirect or a qualification result", () => {
    expect(
      resolveLeadSuccessTransition(
        success,
        "qualification",
        "person@example.com",
      ),
    ).toBeNull();
  });

  it("shows an in-place panel echoing the email for contact leads", () => {
    expect(
      resolveLeadSuccessTransition(success, "contact", " Person@Example.com "),
    ).toEqual({ kind: "panel", email: "Person@Example.com" });
  });

  it("returns null while idle", () => {
    expect(
      resolveLeadSuccessTransition(
        { status: "idle" },
        "apply",
        "person@example.com",
      ),
    ).toBeNull();
  });

  it("returns null on error so the inline error contract is preserved", () => {
    expect(
      resolveLeadSuccessTransition(
        {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: { email: ["Enter a valid email."] },
        },
        "contact",
        "person@example.com",
      ),
    ).toBeNull();
  });
});
