import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QualificationRuntime } from "./QualificationRuntime";
import type { QualificationRuntimeSession } from "./QualificationRuntime";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const saveAction = async () =>
  ({
    status: "saved",
    currentQuestionId: "budget",
    answerCount: 1,
  }) as const;

const completeAction = async () =>
  ({
    status: "completed",
    redirectPath: "/thanks",
  }) as const;

function makeSession(
  overrides: Partial<QualificationRuntimeSession> = {},
): QualificationRuntimeSession {
  return {
    status: "active",
    formVersionNumber: 1,
    questions: [
      {
        id: "state",
        type: "state_region",
        label: "Which state are you focused on?",
        helpText: "Choose the market you want to start with.",
        required: true,
        normalizedRole: "state_market",
        options: [
          { id: "sa", label: "South Australia", value: "SA" },
          { id: "vic", label: "Victoria", value: "VIC" },
        ],
      },
      {
        id: "budget",
        type: "budget_range",
        label: "How much capital can you access?",
        required: true,
        normalizedRole: "available_capital",
        options: [
          { id: "25-50", label: "$25k-$50k", value: "25000-50000" },
          { id: "50-plus", label: "$50k+", value: "50000+" },
        ],
      },
      {
        id: "notes",
        type: "long_text",
        label: "Any other goals or constraints?",
        required: false,
      },
      {
        id: "consent",
        type: "consent",
        label: "I agree to be contacted about my vending enquiry.",
        required: true,
        normalizedRole: "consent",
      },
    ],
    currentQuestionId: "budget",
    answers: { state: "SA", budget: "25000-50000" },
    completedAt: null,
    redirectPath: "/thanks",
    ...overrides,
  };
}

function renderRuntime(session: QualificationRuntimeSession) {
  return renderToStaticMarkup(
    <QualificationRuntime
      session={session}
      sessionToken="test-token"
      saveAction={saveAction}
      completeAction={completeAction}
    />,
  );
}

describe("QualificationRuntime", () => {
  it("renders the active question with progress, saved answer state, and accessible controls", () => {
    const html = renderRuntime(makeSession());

    expect(html).toContain("Vendingpreneurs");
    expect(html).toContain("Question 2 of 4");
    expect(html).toContain("How much capital can you access?");
    expect(html).toContain("Saved as you continue");
    expect(html).toContain("Back");
    expect(html).toContain("Continue");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('value="25000-50000"');
    expect(html).toContain('name="question_id"');
    expect(html).toContain('data-motion-scope="qualification-runtime"');
  });

  it("renders polished controls for every v1 question type", () => {
    const questionTypes: QualificationRuntimeSession["questions"][number][] = [
      { id: "short", type: "short_text", label: "Short text", required: true },
      { id: "long", type: "long_text", label: "Long text", required: true },
      { id: "email", type: "email", label: "Email", required: true },
      { id: "phone", type: "phone", label: "Phone", required: true },
      {
        id: "single",
        type: "single_choice",
        label: "Single choice",
        required: true,
        options: [{ id: "a", label: "Option A", value: "A" }],
      },
      {
        id: "multi",
        type: "multiple_choice",
        label: "Multiple choice",
        required: false,
        options: [{ id: "a", label: "Option A", value: "A" }],
      },
      { id: "yesno", type: "yes_no", label: "Yes or no", required: true },
      { id: "number", type: "number", label: "Number", required: true },
      { id: "currency", type: "currency", label: "Currency", required: true },
      {
        id: "budget",
        type: "budget_range",
        label: "Budget",
        required: true,
        options: [{ id: "25", label: "$25k", value: "25000" }],
      },
      {
        id: "state",
        type: "state_region",
        label: "State",
        required: true,
        options: [{ id: "sa", label: "South Australia", value: "SA" }],
      },
      { id: "date", type: "date", label: "Date", required: true },
      {
        id: "timeframe",
        type: "timeframe",
        label: "Timeframe",
        required: true,
        options: [{ id: "soon", label: "Next 30 days", value: "30" }],
      },
      { id: "consent", type: "consent", label: "Consent", required: true },
    ];

    for (const question of questionTypes) {
      const html = renderRuntime(
        makeSession({
          questions: [question],
          currentQuestionId: question.id,
          answers: {},
        }),
      );

      expect(html).toContain(question.label);
      expect(html).toContain('name="answer_value');
      expect(html).toContain("Complete");
    }
  });

  it("renders validation errors near the affected question", () => {
    const html = renderRuntime(
      makeSession({
        initialActionState: {
          status: "error",
          message: "Check the highlighted answer and try again.",
          fieldErrors: {
            budget: ["How much capital can you access? is required."],
          },
        },
      }),
    );

    expect(html).toContain("Check the highlighted answer and try again.");
    expect(html).toContain("How much capital can you access? is required.");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("renders a completed session with a safe next-step link", () => {
    const html = renderRuntime(
      makeSession({
        status: "completed",
        currentQuestionId: null,
        completedAt: "2026-06-17T11:00:00.000Z",
      }),
    );

    expect(html).toContain("Qualification complete");
    expect(html).toContain("Continue to next step");
    expect(html).toContain('href="/thanks"');
    expect(html).not.toContain("<form");
  });
});
