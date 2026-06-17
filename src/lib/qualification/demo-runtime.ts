import type { Json } from "@/types/database";
import type {
  QualificationQuestionSnapshot,
  QualificationQuestionType,
} from "./forms";

export const DEMO_QUALIFICATION_RUNTIME_TOKEN = "demo-qualification-runtime";

const demoStartedAt = "2026-06-17T09:00:00.000Z";
const demoQuestions: QualificationQuestionSnapshot[] = [
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
      { id: "nsw", label: "New South Wales", value: "NSW" },
    ],
  },
  {
    id: "budget",
    type: "budget_range",
    label: "How much capital can you access to start?",
    helpText: "This helps us tailor the next step without slowing you down.",
    required: true,
    normalizedRole: "available_capital",
    options: [
      { id: "10-25", label: "$10k-$25k", value: "10000-25000" },
      { id: "25-50", label: "$25k-$50k", value: "25000-50000" },
      { id: "50-plus", label: "$50k+", value: "50000+" },
      { id: "deciding", label: "Still deciding", value: "still-deciding" },
    ],
  },
  {
    id: "constraint",
    type: "long_text",
    label: "What is your biggest question right now?",
    helpText: "A short note is enough. You can leave this blank.",
    required: false,
    normalizedRole: "goal",
  },
  {
    id: "timeline",
    type: "timeframe",
    label: "When would you like to make progress?",
    required: true,
    normalizedRole: "timeline",
    options: [
      { id: "30", label: "Next 30 days", value: "30-days" },
      { id: "90", label: "Next 90 days", value: "90-days" },
      { id: "later", label: "Still deciding", value: "still-deciding" },
    ],
  },
  {
    id: "consent",
    type: "consent",
    label: "I agree to be contacted about my vending enquiry.",
    helpText: "We use your answers only to follow up on this enquiry.",
    required: true,
    normalizedRole: "consent",
  },
];

type DemoState = {
  answers: Record<string, Json>;
  completedAt: string | null;
};

const demoStates = new Map<string, DemoState>();

export type DemoQualificationRuntimeSession = {
  status: "active" | "completed";
  formVersionNumber: number;
  questions: QualificationQuestionSnapshot[];
  currentQuestionId: string | null;
  answers: Record<string, Json>;
  completedAt: string | null;
  redirectPath: string;
};

export function isDemoQualificationRuntimeToken(token: string) {
  return (
    process.env.NODE_ENV !== "production" &&
    token === DEMO_QUALIFICATION_RUNTIME_TOKEN
  );
}

export function getDemoQualificationRuntimeSession(
  token: string,
): DemoQualificationRuntimeSession | null {
  if (!isDemoQualificationRuntimeToken(token)) return null;
  const state = stateForToken(token);
  return {
    status: state.completedAt ? "completed" : "active",
    formVersionNumber: 1,
    questions: demoQuestions,
    currentQuestionId: state.completedAt
      ? null
      : firstUnansweredRequiredQuestion(state.answers),
    answers: state.answers,
    completedAt: state.completedAt,
    redirectPath: "/thanks",
  };
}

export function saveDemoQualificationRuntimeAnswer({
  sessionToken,
  questionId,
  answerValue,
}: {
  sessionToken: string;
  questionId: string;
  answerValue: unknown;
}) {
  if (!isDemoQualificationRuntimeToken(sessionToken)) return null;
  const question = demoQuestions.find((item) => item.id === questionId);
  if (!question) {
    return {
      status: "error" as const,
      message: "Check the highlighted answer and try again.",
      fieldErrors: { [questionId]: ["Question was not found."] },
    };
  }
  const state = stateForToken(sessionToken);
  state.answers = {
    ...state.answers,
    [questionId]: normalizeDemoAnswer(question.type, answerValue),
  };
  const currentQuestionId = firstUnansweredRequiredQuestion(state.answers);
  return {
    status: "saved" as const,
    currentQuestionId,
    answerCount: Object.keys(state.answers).length,
  };
}

export function completeDemoQualificationRuntimeSession(sessionToken: string) {
  if (!isDemoQualificationRuntimeToken(sessionToken)) return null;
  const state = stateForToken(sessionToken);
  const fieldErrors = requiredDemoFieldErrors(state.answers);
  if (Object.keys(fieldErrors).length) {
    return {
      status: "error" as const,
      message: "Check the highlighted answer and try again.",
      fieldErrors,
    };
  }
  state.completedAt = new Date().toISOString();
  return {
    status: "completed" as const,
    redirectPath: "/thanks",
  };
}

function stateForToken(token: string): DemoState {
  const existing = demoStates.get(token);
  if (existing) return existing;
  const initial: DemoState = {
    answers: { state: "SA" },
    completedAt: null,
  };
  demoStates.set(token, initial);
  return initial;
}

function firstUnansweredRequiredQuestion(answers: Record<string, Json>) {
  return (
    demoQuestions.find(
      (question) =>
        question.required && !demoAnswerHasValue(answers[question.id]),
    )?.id ?? null
  );
}

function requiredDemoFieldErrors(answers: Record<string, Json>) {
  const fieldErrors: Record<string, string[]> = {};
  for (const question of demoQuestions) {
    if (!question.required) continue;
    if (!demoAnswerHasValue(answers[question.id])) {
      fieldErrors[question.id] = [`${question.label} is required.`];
    }
    if (question.type === "consent" && answers[question.id] !== true) {
      fieldErrors[question.id] = ["Consent is required."];
    }
  }
  return fieldErrors;
}

function normalizeDemoAnswer(
  type: QualificationQuestionType,
  value: unknown,
): Json {
  if (type === "multiple_choice") {
    return Array.isArray(value)
      ? value.map((item) => String(item))
      : value
        ? [String(value)]
        : [];
  }
  if (type === "yes_no" || type === "consent") {
    return value === true;
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map((item) => String(item));
  return String(value);
}

function demoAnswerHasValue(value: Json | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

export function resetDemoQualificationRuntime() {
  demoStates.delete(DEMO_QUALIFICATION_RUNTIME_TOKEN);
  demoStates.set(DEMO_QUALIFICATION_RUNTIME_TOKEN, {
    answers: { state: "SA" },
    completedAt: null,
  });
  return demoStartedAt;
}
