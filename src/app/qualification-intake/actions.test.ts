import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialLeadActionState } from "@/app/lead-action-state";
import { QualificationIntakeValidationError } from "@/lib/services/qualification-intake";
import { QualificationSessionValidationError } from "@/lib/services/qualification-sessions";
import { submitInlineQualification, submitQualificationLead } from "./actions";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  createQualificationIntakeSession: vi.fn(),
  submitInlineQualification: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/services/qualification-intake", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/qualification-intake")
  >("@/lib/services/qualification-intake");
  return {
    ...actual,
    createQualificationIntakeSession: mocks.createQualificationIntakeSession,
  };
});

vi.mock("@/lib/services/qualification-inline", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/qualification-inline")
  >("@/lib/services/qualification-inline");
  return {
    ...actual,
    submitInlineQualification: mocks.submitInlineQualification,
  };
});

function qualificationFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("idempotency_key", "qualification-key");
  formData.set("full_name", "Jane Buyer");
  formData.set("email", "jane@example.com");
  formData.set("phone", "555-0123");
  formData.set("qualification_form_id", "11111111-1111-4111-8111-111111111111");
  formData.set("qualification_completion_redirect_path", "/book-call");
  formData.set("qualification_experiment_key", "post_submit");
  formData.set("qualification_variant_key", "a");
  formData.set("vp_session_id", "vp-session-1");
  formData.set("source_path", "/resources/start-vending?utm_source=google");
  formData.set("landing_path", "/resources/start-vending");
  formData.set(
    "first_landing_url",
    "https://vendingpreneurs.com/resources/start-vending?campaign_id=camp-123",
  );
  formData.set("first_landing_path", "/resources/start-vending");
  formData.set("first_referrer", "https://www.google.com/");
  formData.set("first_touch_at", "2026-06-17T08:55:00.000Z");
  formData.set("latest_landing_url", "https://vendingpreneurs.com/apply");
  formData.set("latest_landing_path", "/apply");
  formData.set(
    "latest_referrer",
    "https://vendingpreneurs.com/resources/start-vending",
  );
  formData.set("latest_touch_at", "2026-06-17T08:59:00.000Z");
  formData.set("source_page_id", "page_1");
  formData.set("source_page_slug", "start-vending");
  formData.set("target_keyword", "start vending business");
  formData.set("source_block_id", "block_form");
  formData.set("source_cta_tracking_name", "resource_lead_form");
  formData.set("clicked_href", "/apply");
  formData.set("utm_source", "google");
  formData.set("utm_medium", "cpc");
  formData.set("utm_campaign", "launch");
  formData.set("gclid", "gclid-123");
  formData.set("campaign_id", "camp-123");
  formData.set("ad_group_id", "group-123");
  formData.set("ad_id", "ad-123");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

describe("submitQualificationLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({
        referer: "https://vendingpreneurs.com/resources/start-vending",
        "user-agent": "vitest",
      }),
    );
    mocks.createQualificationIntakeSession.mockResolvedValue({
      status: "accepted",
      leadId: "lead_1",
      sessionId: "session_1",
      formId: "form_1",
      formVersionId: "version_1",
      qualificationUrl: "/qualify/raw_token",
      staleAt: "2026-06-24T00:00:00.000Z",
      expiresAt: "2026-07-17T00:00:00.000Z",
    });
  });

  it("stores qualification intake with attribution and returns a redirect target", async () => {
    const result = await submitQualificationLead(
      initialLeadActionState,
      qualificationFormData(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Continue to qualification.",
      leadId: "lead_1",
      redirectHref: "/qualify/raw_token",
    });
    expect(mocks.createQualificationIntakeSession).toHaveBeenCalledWith({
      idempotencyKey: "qualification-key",
      fullName: "Jane Buyer",
      email: "jane@example.com",
      phone: "555-0123",
      qualificationFormId: "11111111-1111-4111-8111-111111111111",
      completionRedirectPath: "/book-call",
      vpSessionId: "vp-session-1",
      sourcePath: "/resources/start-vending?utm_source=google",
      landingPath: "/resources/start-vending",
      referrer: "https://vendingpreneurs.com/resources/start-vending",
      firstLandingUrl:
        "https://vendingpreneurs.com/resources/start-vending?campaign_id=camp-123",
      firstLandingPath: "/resources/start-vending",
      firstReferrer: "https://www.google.com/",
      firstTouchAt: "2026-06-17T08:55:00.000Z",
      latestLandingUrl: "https://vendingpreneurs.com/apply",
      latestLandingPath: "/apply",
      latestReferrer: "https://vendingpreneurs.com/resources/start-vending",
      latestTouchAt: "2026-06-17T08:59:00.000Z",
      userAgent: "vitest",
      sourcePageId: "page_1",
      sourcePageSlug: "start-vending",
      targetKeyword: "start vending business",
      sourceBlockId: "block_form",
      sourceCtaTrackingName: "resource_lead_form",
      clickedHref: "/apply",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "launch",
      utmTerm: "",
      utmContent: "",
      gclid: "gclid-123",
      fbclid: "",
      gbraid: "",
      wbraid: "",
      paidPlatform: "",
      paidSourceKey: "",
      campaignId: "camp-123",
      campaignName: "",
      adsetId: "",
      adsetName: "",
      adGroupId: "group-123",
      adGroupName: "",
      groupId: "",
      groupName: "",
      adId: "ad-123",
      adName: "",
      experimentKey: "post_submit",
      variantKey: "a",
    });
  });

  it("prefers submitted referrer and forwards optional UTM terms", async () => {
    await submitQualificationLead(
      initialLeadActionState,
      qualificationFormData({
        referrer: "https://partner.example/referral",
        utm_term: "vending course",
        utm_content: "hero_cta",
      }),
    );

    expect(mocks.createQualificationIntakeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        referrer: "https://partner.example/referral",
        utmTerm: "vending course",
        utmContent: "hero_cta",
      }),
    );
  });

  it("returns field errors without creating a redirect target", async () => {
    mocks.createQualificationIntakeSession.mockRejectedValue(
      new QualificationIntakeValidationError({
        fullName: ["Name is required."],
        phone: ["Phone is required."],
      }),
    );

    const result = await submitQualificationLead(
      initialLeadActionState,
      qualificationFormData({ full_name: "", phone: "" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        fullName: ["Name is required."],
        phone: ["Phone is required."],
      },
    });
  });

  it("returns a generic failure without leaking unexpected errors", async () => {
    mocks.createQualificationIntakeSession.mockRejectedValue(
      new Error("service role key leaked"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await submitQualificationLead(
        initialLeadActionState,
        qualificationFormData(),
      );

      expect(result).toEqual({
        status: "error",
        message: "We couldn't submit the form. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification intake action failed",
        { error: "service role key leaked" },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("logs unknown for non-Error intake failures", async () => {
    mocks.createQualificationIntakeSession.mockRejectedValue(
      "service role key leaked",
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await submitQualificationLead(
        initialLeadActionState,
        qualificationFormData(),
      );

      expect(result).toEqual({
        status: "error",
        message: "We couldn't submit the form. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification intake action failed",
        { error: "unknown error" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "service role key leaked",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

function inlineQualificationFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("idempotency_key", "inline-key");
  formData.set("full_name", "Jane Buyer");
  formData.set("email", "jane@example.com");
  formData.set("phone", "555-0123");
  formData.set("qualification_form_id", "a1b2c3d4-0000-4000-8000-000000000001");
  formData.set("source_path", "/contact");
  formData.set("landing_path", "/contact");
  formData.set("consent_updates", "true");
  formData.set("consent_contact", "true");
  formData.set("timeline", "asap");
  formData.set("invest", "15k_plus");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

describe("submitInlineQualification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({
        referer: "https://vendingpreneurs.com/contact",
        "user-agent": "vitest",
      }),
    );
    mocks.submitInlineQualification.mockResolvedValue({
      status: "completed",
      leadId: "lead_1",
      thankYouState: "perfect_fit",
      score: 100,
    });
  });

  it("submits the four qualification answers as booleans/strings and returns the fit result", async () => {
    const result = await submitInlineQualification(
      initialLeadActionState,
      inlineQualificationFormData(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Thanks — here's your fit.",
      leadId: "lead_1",
      qualification: { thankYouState: "perfect_fit", score: 100 },
    });
    expect(mocks.submitInlineQualification).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Jane Buyer",
        email: "jane@example.com",
        phone: "555-0123",
        qualificationFormId: "a1b2c3d4-0000-4000-8000-000000000001",
        consentUpdates: true,
        consentContact: true,
        timeline: "asap",
        invest: "15k_plus",
      }),
    );
  });

  it("does not leak a leadId, qualification result, or redirectHref field on the returned action state beyond the documented contract", async () => {
    const result = await submitInlineQualification(
      initialLeadActionState,
      inlineQualificationFormData(),
    );

    expect(Object.keys(result).sort()).toEqual([
      "leadId",
      "message",
      "qualification",
      "status",
    ]);
  });

  it("coerces an unchecked consent checkbox (absent from FormData) to false", async () => {
    const formData = inlineQualificationFormData();
    formData.delete("consent_contact");

    await submitInlineQualification(initialLeadActionState, formData);

    expect(mocks.submitInlineQualification).toHaveBeenCalledWith(
      expect.objectContaining({ consentContact: false }),
    );
  });

  it("returns field errors from intake validation without creating a fit result", async () => {
    mocks.submitInlineQualification.mockRejectedValue(
      new QualificationIntakeValidationError({
        email: ["Enter a valid email."],
      }),
    );

    const result = await submitInlineQualification(
      initialLeadActionState,
      inlineQualificationFormData({ email: "not-an-email" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { email: ["Enter a valid email."] },
    });
  });

  it("returns field errors from session validation (missing consent) without creating a fit result", async () => {
    mocks.submitInlineQualification.mockRejectedValue(
      new QualificationSessionValidationError({
        consent_contact: ["Consent is required."],
      }),
    );

    const formData = inlineQualificationFormData();
    formData.delete("consent_contact");

    const result = await submitInlineQualification(
      initialLeadActionState,
      formData,
    );

    expect(result).toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { consent_contact: ["Consent is required."] },
    });
  });

  it("returns a generic failure without leaking unexpected errors", async () => {
    mocks.submitInlineQualification.mockRejectedValue(
      new Error("service role key leaked"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await submitInlineQualification(
        initialLeadActionState,
        inlineQualificationFormData(),
      );

      expect(result).toEqual({
        status: "error",
        message: "We couldn't submit the form. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "inline qualification action failed",
        { error: "service role key leaked" },
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
