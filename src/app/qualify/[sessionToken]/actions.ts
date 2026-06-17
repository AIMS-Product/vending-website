"use server";

import { headers } from "next/headers";
import {
  completeQualificationSession,
  QualificationSessionValidationError,
  saveQualificationAnswer,
} from "@/lib/services/qualification-sessions";

export type QualificationAnswerActionState =
  | { status: "idle" }
  | {
      status: "saved";
      currentQuestionId: string | null;
      answerCount: number;
    }
  | {
      status: "completed";
      redirectPath: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function saveQualificationAnswerAction(
  sessionToken: string,
  _state: QualificationAnswerActionState,
  formData: FormData,
): Promise<QualificationAnswerActionState> {
  try {
    const result = await saveQualificationAnswer({
      sessionToken,
      questionId: field(formData, "question_id"),
      answerValue: answerValue(formData),
    });

    return {
      status: "saved",
      currentQuestionId: result.currentQuestionId,
      answerCount: result.answerCount,
    };
  } catch (error) {
    if (error instanceof QualificationSessionValidationError) {
      return {
        status: "error",
        message: "Check the highlighted answer and try again.",
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("qualification answer action failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      message: "We couldn't save that answer. Try again in a moment.",
    };
  }
}

export async function completeQualificationSessionAction(
  sessionToken: string,
): Promise<QualificationAnswerActionState> {
  const h = await headers();

  try {
    const result = await completeQualificationSession({
      sessionToken,
      userAgent: h.get("user-agent"),
    });
    return {
      status: "completed",
      redirectPath: result.redirectPath,
    };
  } catch (error) {
    if (error instanceof QualificationSessionValidationError) {
      return {
        status: "error",
        message: "Check the highlighted answer and try again.",
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("qualification completion action failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      message: "We couldn't complete the qualification. Try again in a moment.",
    };
  }
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function answerValue(formData: FormData) {
  const jsonValue = field(formData, "answer_value_json");
  if (jsonValue) {
    try {
      return JSON.parse(jsonValue) as unknown;
    } catch {
      return jsonValue;
    }
  }

  const values: Array<string | boolean> = [];
  for (const value of formData.getAll("answer_value")) {
    if (typeof value !== "string") continue;
    if (value === "true") {
      values.push(true);
    } else if (value === "false") {
      values.push(false);
    } else {
      values.push(value);
    }
  }
  return values.length > 1 ? values : (values[0] ?? "");
}
