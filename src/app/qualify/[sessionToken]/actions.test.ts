import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeQualificationSessionAction,
  saveQualificationAnswerAction,
} from "./actions";
import { QualificationSessionValidationError } from "@/lib/services/qualification-sessions";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  saveQualificationAnswer: vi.fn(),
  completeQualificationSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/services/qualification-sessions", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/qualification-sessions")
  >("@/lib/services/qualification-sessions");
  return {
    ...actual,
    saveQualificationAnswer: mocks.saveQualificationAnswer,
    completeQualificationSession: mocks.completeQualificationSession,
  };
});

describe("qualification session actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "vitest" }));
    mocks.saveQualificationAnswer.mockResolvedValue({
      status: "saved",
      sessionId: "session_1",
      questionId: "state",
      currentQuestionId: "budget",
      answerCount: 1,
    });
    mocks.completeQualificationSession.mockResolvedValue({
      status: "completed",
      sessionId: "session_1",
      redirectPath: "/thanks",
    });
  });

  it("saves an answer using the token and form payload", async () => {
    const formData = new FormData();
    formData.set("question_id", "state");
    formData.set("answer_value", "SA");

    const result = await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(result).toEqual({
      status: "saved",
      currentQuestionId: "budget",
      answerCount: 1,
    });
    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "state",
      answerValue: "SA",
    });
  });

  it("returns validation errors without leaking thrown details", async () => {
    mocks.saveQualificationAnswer.mockRejectedValue(
      new QualificationSessionValidationError({
        consent: ["Consent is required."],
      }),
    );
    const formData = new FormData();
    formData.set("question_id", "consent");
    formData.set("answer_value", "false");

    const result = await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(result).toEqual({
      status: "error",
      message: "Check the highlighted answer and try again.",
      fieldErrors: { consent: ["Consent is required."] },
    });
  });

  it("completes with the request user agent", async () => {
    const result = await completeQualificationSessionAction("raw_token");

    expect(result).toEqual({
      status: "completed",
      redirectPath: "/thanks",
    });
    expect(mocks.completeQualificationSession).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      userAgent: "vitest",
    });
  });
});
