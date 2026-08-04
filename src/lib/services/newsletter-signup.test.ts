import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NEWSLETTER_FORM_ID,
  NEWSLETTER_QUESTION_IDS,
} from "@/lib/content/newsletter";
import { QualificationSessionValidationError } from "./qualification-sessions";
import {
  finishNewsletterSubscription,
  startNewsletterSubscription,
} from "./newsletter-signup";

const mocks = vi.hoisted(() => ({
  createIntake: vi.fn(),
  loadSession: vi.fn(),
  saveAnswer: vi.fn(),
  updatePhone: vi.fn(),
  markSubscription: vi.fn(),
  completeNewsletterSession: vi.fn(),
}));

vi.mock("./qualification-intake", async () => {
  const actual = await vi.importActual<typeof import("./qualification-intake")>(
    "./qualification-intake",
  );
  return {
    ...actual,
    createQualificationIntakeSession: mocks.createIntake,
  };
});

vi.mock("./qualification-sessions", async () => {
  const actual = await vi.importActual<
    typeof import("./qualification-sessions")
  >("./qualification-sessions");
  return {
    ...actual,
    loadQualificationSessionForToken: mocks.loadSession,
    saveQualificationAnswer: mocks.saveAnswer,
    updateQualificationLeadPhone: mocks.updatePhone,
  };
});

vi.mock("./newsletter-session-lifecycle", () => ({
  markNewsletterSubscription: mocks.markSubscription,
  completeNewsletterSignupSession: mocks.completeNewsletterSession,
}));

function startInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "newsletter-key",
    fullName: "Jordan Reyes",
    email: "jordan@example.com",
    phone: "",
    sourcePath: "/newsletter",
    landingPath: "/newsletter",
    newsletterEmailConsent: true,
    programUpdatesConsent: false,
    ...overrides,
  };
}

function finishInput(overrides: Record<string, unknown> = {}) {
  return {
    sessionToken: "newsletter-token",
    phone: "",
    smsUpdatesConsent: false,
    pullToLaunch: [],
    learnMost: [],
    userAgent: "vitest",
    ...overrides,
  };
}

describe("newsletter signup service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createIntake.mockResolvedValue({
      leadId: "lead_1",
      sessionToken: "newsletter-token",
    });
    mocks.loadSession.mockResolvedValue({
      status: "active",
      formId: NEWSLETTER_FORM_ID,
    });
    mocks.saveAnswer.mockResolvedValue({ status: "saved" });
    mocks.updatePhone.mockResolvedValue({
      status: "updated",
      leadId: "lead_1",
    });
    mocks.markSubscription.mockResolvedValue({
      status: "subscribed",
      leadSubmissionId: "lead_1",
    });
    mocks.completeNewsletterSession.mockResolvedValue({
      status: "completed",
      leadSubmissionId: "lead_1",
      thankYouState: null,
      score: null,
    });
  });

  it("refuses missing newsletter consent before creating a lead", async () => {
    await expect(
      startNewsletterSubscription(
        startInput({ newsletterEmailConsent: false }),
      ),
    ).rejects.toMatchObject({
      fieldErrors: {
        [NEWSLETTER_QUESTION_IDS.emailConsent]: ["Consent is required."],
      },
    });
    expect(mocks.createIntake).not.toHaveBeenCalled();
  });

  it("creates the dedicated session and records optional consent truthfully", async () => {
    const result = await startNewsletterSubscription(startInput());

    expect(result).toEqual({
      status: "started",
      leadId: "lead_1",
      sessionToken: "newsletter-token",
    });
    expect(mocks.createIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        qualificationFormId: NEWSLETTER_FORM_ID,
        phone: "",
      }),
      {},
    );
    expect(mocks.saveAnswer).toHaveBeenNthCalledWith(
      1,
      {
        sessionToken: "newsletter-token",
        questionId: NEWSLETTER_QUESTION_IDS.emailConsent,
        answerValue: true,
      },
      {},
    );
    expect(mocks.markSubscription).toHaveBeenCalledWith(
      {
        sessionToken: "newsletter-token",
        newsletterFormId: NEWSLETTER_FORM_ID,
        requiredConsentQuestionId: NEWSLETTER_QUESTION_IDS.emailConsent,
      },
      {},
    );
    expect(mocks.saveAnswer.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.markSubscription.mock.invocationCallOrder[0]!,
    );
    expect(mocks.saveAnswer).toHaveBeenNthCalledWith(
      2,
      {
        sessionToken: "newsletter-token",
        questionId: NEWSLETTER_QUESTION_IDS.programUpdatesConsent,
        answerValue: false,
      },
      {},
    );
  });

  it("allows an entirely optional stage 2 and completes without scoring", async () => {
    const result = await finishNewsletterSubscription(finishInput());

    expect(result).toEqual({ status: "completed", leadId: "lead_1" });
    expect(mocks.updatePhone).not.toHaveBeenCalled();
    expect(mocks.completeNewsletterSession).toHaveBeenCalledWith(
      {
        sessionToken: "newsletter-token",
        newsletterFormId: NEWSLETTER_FORM_ID,
        requiredConsentQuestionId: NEWSLETTER_QUESTION_IDS.emailConsent,
        userAgent: "vitest",
      },
      {},
    );
  });

  it("updates the token-owned lead and preserves every selected option", async () => {
    await finishNewsletterSubscription(
      finishInput({
        phone: "(555) 019-4477",
        smsUpdatesConsent: true,
        pullToLaunch: ["replace_job", "diversify_income"],
        learnMost: ["locations", "financing"],
      }),
    );

    expect(mocks.updatePhone).toHaveBeenCalledWith(
      { sessionToken: "newsletter-token", phone: "+15550194477" },
      {},
    );
    expect(mocks.saveAnswer).toHaveBeenCalledWith(
      {
        sessionToken: "newsletter-token",
        questionId: NEWSLETTER_QUESTION_IDS.pullToLaunch,
        answerValue: ["replace_job", "diversify_income"],
      },
      {},
    );
    expect(mocks.saveAnswer).toHaveBeenCalledWith(
      {
        sessionToken: "newsletter-token",
        questionId: NEWSLETTER_QUESTION_IDS.learnMost,
        answerValue: ["locations", "financing"],
      },
      {},
    );
  });

  it("rejects SMS consent without a phone before writing stage 2", async () => {
    await expect(
      finishNewsletterSubscription(finishInput({ smsUpdatesConsent: true })),
    ).rejects.toMatchObject({ fieldErrors: { phone: [expect.any(String)] } });
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
    expect(mocks.completeNewsletterSession).not.toHaveBeenCalled();
  });

  it("rejects unknown option values before persisting them", async () => {
    await expect(
      finishNewsletterSubscription(finishInput({ pullToLaunch: ["injected"] })),
    ).rejects.toMatchObject({
      fieldErrors: {
        [NEWSLETTER_QUESTION_IDS.pullToLaunch]: [expect.any(String)],
      },
    });
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });

  it("normalizes a valid phone before storing it", async () => {
    await finishNewsletterSubscription(
      finishInput({ phone: "(555) 019-4477", smsUpdatesConsent: true }),
    );

    expect(mocks.updatePhone).toHaveBeenCalledWith(
      { sessionToken: "newsletter-token", phone: "+15550194477" },
      {},
    );
  });

  it("rejects an unusable phone before storing SMS consent", async () => {
    await expect(
      finishNewsletterSubscription(
        finishInput({ phone: "555-0199", smsUpdatesConsent: true }),
      ),
    ).rejects.toMatchObject({ fieldErrors: { phone: [expect.any(String)] } });
    expect(mocks.updatePhone).not.toHaveBeenCalled();
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses replaying a completed session before overwriting answers", async () => {
    mocks.loadSession.mockResolvedValue({
      status: "completed",
      formId: NEWSLETTER_FORM_ID,
    });

    await expect(
      finishNewsletterSubscription(finishInput()),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);
    expect(mocks.updatePhone).not.toHaveBeenCalled();
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses a token for another form before updating its lead", async () => {
    mocks.loadSession.mockResolvedValue({ status: "active", formId: "other" });

    await expect(
      finishNewsletterSubscription(finishInput({ phone: "(555) 019-4477" })),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);
    expect(mocks.updatePhone).not.toHaveBeenCalled();
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });
});
