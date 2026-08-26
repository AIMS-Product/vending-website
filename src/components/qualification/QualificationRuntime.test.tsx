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
    // The saved answer is pre-checked on the native input, and the row + dot
    // are painted from that :checked state rather than from a React prop — so
    // clicking an option repaints immediately instead of waiting for the next
    // server round-trip (which read as an unclickable row on the consent step).
    expect(html).toContain('checked=""');
    expect(html).toContain("has-[:checked]:bg-[#eaf6ff]");
    expect(html).toContain("peer-checked:bg-[#0b63f6]");
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

  // Form V2 (Kody, 2026-08-14): forms carrying the operator gate reveal only
  // the visitor's path. Forms without the gate (everything above) are
  // untouched by the filter.
  describe("operator-gate branching", () => {
    const gateQuestions: QualificationRuntimeSession["questions"] = [
      {
        id: "operator",
        type: "single_choice",
        label: "Do you already operate vending machines?",
        required: false,
        options: [
          { id: "yes", label: "Yes", value: "yes" },
          { id: "no", label: "No", value: "no" },
        ],
      },
      {
        id: "persona",
        type: "single_choice",
        label: "Which of these sounds most like you right now?",
        required: false,
        options: [{ id: "escape", label: "Escape", value: "escape" }],
      },
      {
        id: "bottleneck",
        type: "single_choice",
        label: "What's holding your business back right now?",
        required: false,
        options: [{ id: "locations", label: "Locations", value: "locations" }],
      },
      {
        id: "timeline",
        type: "single_choice",
        label: "When do you want your first machine earning income?",
        required: false,
        options: [{ id: "asap", label: "ASAP", value: "asap" }],
      },
      {
        id: "invest",
        type: "single_choice",
        label: "How much capital are you ready to invest?",
        required: true,
        options: [{ id: "15k_plus", label: "$15,000+", value: "15k_plus" }],
      },
    ];

    it("hides both branches until the gate is answered", () => {
      const html = renderRuntime(
        makeSession({
          questions: gateQuestions,
          currentQuestionId: "operator",
          answers: {},
        }),
      );

      // Visible: gate + invest only.
      expect(html).toContain("Question 1 of 2");
      expect(html).toContain("Do you already operate vending machines?");
      expect(html).not.toContain("Which of these sounds most like you");
      expect(html).not.toContain("What&#x27;s holding your business back");
    });

    it("walks the standard path (no bottleneck) after a No", () => {
      const html = renderRuntime(
        makeSession({
          questions: gateQuestions,
          currentQuestionId: "invest",
          answers: { operator: "no" },
        }),
      );

      // Gate answered "no" → gate, persona, timeline, invest (4 questions),
      // resuming on the first unanswered (persona).
      expect(html).toContain("Question 2 of 4");
      expect(html).toContain("Which of these sounds most like you right now?");
    });

    it("walks the leaner operator path after a Yes", () => {
      const html = renderRuntime(
        makeSession({
          questions: gateQuestions,
          currentQuestionId: "invest",
          answers: { operator: "yes" },
        }),
      );

      // Gate answered "yes" → gate, bottleneck, invest (3 questions),
      // resuming on the first unanswered (bottleneck).
      expect(html).toContain("Question 2 of 3");
      expect(html).toContain(
        "What&#x27;s holding your business back right now?",
      );
      expect(html).not.toContain("Which of these sounds most like you");
    });
  });
});
