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
  saveDemoQualificationRuntimeAnswer: vi.fn(),
  completeDemoQualificationRuntimeSession: vi.fn(),
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

vi.mock("@/lib/qualification/demo-runtime", () => ({
  saveDemoQualificationRuntimeAnswer: mocks.saveDemoQualificationRuntimeAnswer,
  completeDemoQualificationRuntimeSession:
    mocks.completeDemoQualificationRuntimeSession,
}));

describe("qualification session actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "vitest" }));
    mocks.saveDemoQualificationRuntimeAnswer.mockReturnValue(null);
    mocks.completeDemoQualificationRuntimeSession.mockReturnValue(null);
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

  it("saves a structured JSON answer payload", async () => {
    const formData = new FormData();
    formData.set("question_id", "capital");
    formData.set(
      "answer_value_json",
      JSON.stringify({ min: 25000, max: 50000 }),
    );

    await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "capital",
      answerValue: { min: 25000, max: 50000 },
    });
  });

  it("falls back to the raw JSON field when it cannot be parsed", async () => {
    const formData = new FormData();
    formData.set("question_id", "capital");
    formData.set("answer_value_json", "{not-json");

    await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "capital",
      answerValue: "{not-json",
    });
  });

  it("coerces repeated boolean answer values into an array", async () => {
    const formData = new FormData();
    formData.set("question_id", "checks");
    formData.append("answer_value", "true");
    formData.append("answer_value", "false");
    formData.append("answer_value", "other");

    await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "checks",
      answerValue: [true, false, "other"],
    });
  });

  it("treats non-string fields and empty answer lists as empty strings", async () => {
    const formData = new FormData();
    formData.set(
      "question_id",
      new Blob(["state"], { type: "text/plain" }),
      "question.txt",
    );

    await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "",
      answerValue: "",
    });
  });

  it("ignores non-string repeated answer values", async () => {
    const formData = new FormData();
    formData.set("question_id", "checks");
    formData.append(
      "answer_value",
      new Blob(["ignored"], { type: "text/plain" }),
      "ignored.txt",
    );
    formData.append("answer_value", "true");

    await saveQualificationAnswerAction(
      "raw_token",
      { status: "idle" },
      formData,
    );

    expect(mocks.saveQualificationAnswer).toHaveBeenCalledWith({
      sessionToken: "raw_token",
      questionId: "checks",
      answerValue: true,
    });
  });

  it("returns demo answer results without touching persisted sessions", async () => {
    mocks.saveDemoQualificationRuntimeAnswer.mockReturnValue({
      status: "saved",
      currentQuestionId: "demo_next",
      answerCount: 2,
    });
    const formData = new FormData();
    formData.set("question_id", "demo_question");
    formData.set("answer_value", "yes");

    const result = await saveQualificationAnswerAction(
      "demo_token",
      { status: "idle" },
      formData,
    );

    expect(result).toEqual({
      status: "saved",
      currentQuestionId: "demo_next",
      answerCount: 2,
    });
    expect(mocks.saveDemoQualificationRuntimeAnswer).toHaveBeenCalledWith({
      sessionToken: "demo_token",
      questionId: "demo_question",
      answerValue: "yes",
    });
    expect(mocks.saveQualificationAnswer).not.toHaveBeenCalled();
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

  it("returns a generic answer failure without leaking unexpected errors", async () => {
    mocks.saveQualificationAnswer.mockRejectedValue(
      new Error("service role key leaked"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const formData = new FormData();
    formData.set("question_id", "state");
    formData.set("answer_value", "SA");

    try {
      const result = await saveQualificationAnswerAction(
        "raw_token",
        { status: "idle" },
        formData,
      );

      expect(result).toEqual({
        status: "error",
        message: "We couldn't save that answer. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification answer action failed",
        { name: "Error" },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("logs a generic answer error name for non-Error failures", async () => {
    mocks.saveQualificationAnswer.mockRejectedValue("service role key leaked");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const formData = new FormData();
    formData.set("question_id", "state");
    formData.set("answer_value", "SA");

    try {
      const result = await saveQualificationAnswerAction(
        "raw_token",
        { status: "idle" },
        formData,
      );

      expect(result).toEqual({
        status: "error",
        message: "We couldn't save that answer. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification answer action failed",
        { name: "UnknownError" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "service role key leaked",
      );
    } finally {
      consoleError.mockRestore();
    }
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

  it("returns demo completion results without touching persisted sessions", async () => {
    mocks.completeDemoQualificationRuntimeSession.mockReturnValue({
      status: "completed",
      redirectPath: "/demo-thanks",
    });

    const result = await completeQualificationSessionAction("demo_token");

    expect(result).toEqual({
      status: "completed",
      redirectPath: "/demo-thanks",
    });
    expect(mocks.completeDemoQualificationRuntimeSession).toHaveBeenCalledWith(
      "demo_token",
    );
    expect(mocks.headers).not.toHaveBeenCalled();
    expect(mocks.completeQualificationSession).not.toHaveBeenCalled();
  });

  it("returns completion validation errors", async () => {
    mocks.completeQualificationSession.mockRejectedValue(
      new QualificationSessionValidationError({
        answers: ["Answer every required question."],
      }),
    );

    const result = await completeQualificationSessionAction("raw_token");

    expect(result).toEqual({
      status: "error",
      message: "Check the highlighted answer and try again.",
      fieldErrors: { answers: ["Answer every required question."] },
    });
  });

  it("returns a generic completion failure without leaking unexpected errors", async () => {
    mocks.completeQualificationSession.mockRejectedValue(
      new Error("service role key leaked"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await completeQualificationSessionAction("raw_token");

      expect(result).toEqual({
        status: "error",
        message:
          "We couldn't complete the qualification. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification completion action failed",
        { name: "Error" },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("logs a generic completion error name for non-Error failures", async () => {
    mocks.completeQualificationSession.mockRejectedValue(
      "service role key leaked",
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await completeQualificationSessionAction("raw_token");

      expect(result).toEqual({
        status: "error",
        message:
          "We couldn't complete the qualification. Try again in a moment.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification completion action failed",
        { name: "UnknownError" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "service role key leaked",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
