import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeDemoQualificationRuntimeSession,
  DEMO_QUALIFICATION_RUNTIME_TOKEN,
  getDemoQualificationRuntimeSession,
  isDemoQualificationRuntimeToken,
  resetDemoQualificationRuntime,
  saveDemoQualificationRuntimeAnswer,
} from "./demo-runtime";

describe("demo qualification runtime", () => {
  beforeEach(() => {
    resetDemoQualificationRuntime();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only enables the local demo token outside production", () => {
    expect(
      isDemoQualificationRuntimeToken(DEMO_QUALIFICATION_RUNTIME_TOKEN),
    ).toBe(true);
    expect(isDemoQualificationRuntimeToken("raw_token")).toBe(false);
    expect(getDemoQualificationRuntimeSession("raw_token")).toBeNull();
    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: "raw_token",
        questionId: "state",
        answerValue: "SA",
      }),
    ).toBeNull();
    expect(completeDemoQualificationRuntimeSession("raw_token")).toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    expect(
      isDemoQualificationRuntimeToken(DEMO_QUALIFICATION_RUNTIME_TOKEN),
    ).toBe(false);
  });

  it("loads the initial demo session with state prefilled", () => {
    const session = getDemoQualificationRuntimeSession(
      DEMO_QUALIFICATION_RUNTIME_TOKEN,
    );

    expect(session).toMatchObject({
      status: "active",
      formVersionNumber: 1,
      currentQuestionId: "budget",
      answers: { state: "SA" },
      completedAt: null,
      redirectPath: "/thanks",
    });
    expect(session?.questions.map((question) => question.id)).toEqual([
      "state",
      "budget",
      "constraint",
      "timeline",
      "consent",
    ]);
  });

  it("validates question ids and normalizes saved demo answers", () => {
    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
        questionId: "missing",
        answerValue: "SA",
      }),
    ).toEqual({
      status: "error",
      message: "Check the highlighted answer and try again.",
      fieldErrors: { missing: ["Question was not found."] },
    });

    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
        questionId: "budget",
        answerValue: "25-50",
      }),
    ).toEqual({
      status: "saved",
      currentQuestionId: "timeline",
      answerCount: 2,
    });
    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
        questionId: "constraint",
        answerValue: ["equipment", 90],
      }),
    ).toEqual({
      status: "saved",
      currentQuestionId: "timeline",
      answerCount: 3,
    });
    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
        questionId: "timeline",
        answerValue: 30,
      }),
    ).toEqual({
      status: "saved",
      currentQuestionId: "consent",
      answerCount: 4,
    });
    expect(
      saveDemoQualificationRuntimeAnswer({
        sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
        questionId: "consent",
        answerValue: true,
      }),
    ).toEqual({
      status: "saved",
      currentQuestionId: null,
      answerCount: 5,
    });

    expect(
      getDemoQualificationRuntimeSession(DEMO_QUALIFICATION_RUNTIME_TOKEN)
        ?.answers,
    ).toEqual({
      state: "SA",
      budget: "25-50",
      constraint: ["equipment", "90"],
      timeline: 30,
      consent: true,
    });
  });

  it("blocks incomplete demo completion and then completes once required answers exist", () => {
    expect(
      completeDemoQualificationRuntimeSession(DEMO_QUALIFICATION_RUNTIME_TOKEN),
    ).toEqual({
      status: "error",
      message: "Check the highlighted answer and try again.",
      fieldErrors: {
        budget: ["How much capital can you access to start? is required."],
        timeline: ["When would you like to make progress? is required."],
        consent: ["Consent is required."],
      },
    });

    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "budget",
      answerValue: "25-50",
    });
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "timeline",
      answerValue: "30",
    });
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "consent",
      answerValue: true,
    });

    const completed = completeDemoQualificationRuntimeSession(
      DEMO_QUALIFICATION_RUNTIME_TOKEN,
    );
    const session = getDemoQualificationRuntimeSession(
      DEMO_QUALIFICATION_RUNTIME_TOKEN,
    );

    expect(completed).toEqual({
      status: "completed",
      redirectPath: "/thanks",
    });
    expect(session).toMatchObject({
      status: "completed",
      currentQuestionId: null,
      redirectPath: "/thanks",
    });
    expect(session?.completedAt).toEqual(expect.any(String));
  });

  it("normalizes blank required demo answers as incomplete", () => {
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "budget",
      answerValue: null,
    });
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "timeline",
      answerValue: "   ",
    });
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "consent",
      answerValue: "true",
    });

    expect(
      getDemoQualificationRuntimeSession(DEMO_QUALIFICATION_RUNTIME_TOKEN)
        ?.answers,
    ).toMatchObject({
      budget: "",
      timeline: "   ",
      consent: false,
    });
    expect(
      completeDemoQualificationRuntimeSession(DEMO_QUALIFICATION_RUNTIME_TOKEN),
    ).toMatchObject({
      status: "error",
      fieldErrors: {
        budget: ["How much capital can you access to start? is required."],
        timeline: ["When would you like to make progress? is required."],
        consent: ["Consent is required."],
      },
    });
  });

  it("resets demo state to the deterministic starting snapshot", () => {
    saveDemoQualificationRuntimeAnswer({
      sessionToken: DEMO_QUALIFICATION_RUNTIME_TOKEN,
      questionId: "budget",
      answerValue: "25-50",
    });

    expect(resetDemoQualificationRuntime()).toBe("2026-06-17T09:00:00.000Z");
    expect(
      getDemoQualificationRuntimeSession(DEMO_QUALIFICATION_RUNTIME_TOKEN),
    ).toMatchObject({
      status: "active",
      currentQuestionId: "budget",
      answers: { state: "SA" },
      completedAt: null,
    });
  });
});
