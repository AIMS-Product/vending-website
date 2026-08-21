"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChatbotActionState } from "@/app/admin/chatbot/actions";
import {
  answerUnknownQuestion,
  applyKnowledgeSuggestion,
  dismissFollowUpTask,
  dismissKnowledgeSuggestion,
  dismissLearningCase,
  dismissSiteRecommendation,
  dismissUnknownQuestion,
  markFollowUpTaskSent,
  markLearningCaseReviewed,
  markSiteRecommendationPlanned,
} from "@/lib/services/chatbot-insights";
import { ChatbotAdminError } from "@/lib/services/chatbot-admin";
import { requireAdmin } from "@/lib/supabase/auth";

const INSIGHTS_PATH = "/admin/chatbot/insights";

const idSchema = z.object({ id: z.uuid("Invalid id.") });

function parseId(formData: FormData) {
  return idSchema.safeParse({ id: formData.get("id") });
}

function actionError(error: unknown, fallback: string): ChatbotActionState {
  if (error instanceof ChatbotAdminError) {
    return { status: "error", message: error.message };
  }
  console.error("chatbot insights action failed", error);
  return { status: "error", message: fallback };
}

export async function markFollowUpTaskSentAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success) return { status: "error", message: "Invalid task." };

  try {
    await markFollowUpTaskSent(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not mark this task sent.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Marked sent." };
}

export async function dismissFollowUpTaskAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success) return { status: "error", message: "Invalid task." };

  try {
    await dismissFollowUpTask(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not dismiss this task.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Dismissed." };
}

export async function markLearningCaseReviewedAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success) return { status: "error", message: "Invalid case." };

  try {
    await markLearningCaseReviewed(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not mark this case reviewed.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Marked reviewed." };
}

export async function dismissLearningCaseAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success) return { status: "error", message: "Invalid case." };

  try {
    await dismissLearningCase(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not dismiss this case.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Dismissed." };
}

export async function applyKnowledgeSuggestionAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success)
    return { status: "error", message: "Invalid knowledge fix." };

  try {
    await applyKnowledgeSuggestion(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not apply this knowledge fix.");
  }
  revalidatePath(INSIGHTS_PATH);
  revalidatePath("/admin/chatbot");
  return { status: "saved", message: "Applied to the knowledge base." };
}

export async function dismissKnowledgeSuggestionAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success)
    return { status: "error", message: "Invalid knowledge fix." };

  try {
    await dismissKnowledgeSuggestion(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not dismiss this knowledge fix.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Dismissed." };
}

export async function markSiteRecommendationPlannedAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success)
    return { status: "error", message: "Invalid recommendation." };

  try {
    await markSiteRecommendationPlanned(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not mark this recommendation planned.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Marked planned." };
}

export async function dismissSiteRecommendationAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success)
    return { status: "error", message: "Invalid recommendation." };

  try {
    await dismissSiteRecommendation(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not dismiss this recommendation.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Dismissed." };
}

const answerSchema = z.object({
  id: z.uuid("Invalid question."),
  answer: z
    .string()
    .trim()
    .min(3, "Write an answer before adding it.")
    .max(2000, "Keep the answer under 2000 characters."),
});

/**
 * Closes the learning loop: the admin's answer goes straight into the
 * knowledge base the live system prompt reads, so the next visitor asking the
 * same thing gets a real answer.
 */
export async function answerUnknownQuestionAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = answerSchema.safeParse({
    id: formData.get("id"),
    answer: formData.get("answer"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid answer.",
    };
  }

  try {
    await answerUnknownQuestion(parsed.data.id, parsed.data.answer);
  } catch (error) {
    return actionError(error, "Could not add this answer.");
  }
  revalidatePath(INSIGHTS_PATH);
  revalidatePath("/admin/chatbot");
  return { status: "saved", message: "Added to the knowledge base." };
}

export async function dismissUnknownQuestionAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = parseId(formData);
  if (!parsed.success) return { status: "error", message: "Invalid question." };

  try {
    await dismissUnknownQuestion(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not dismiss this question.");
  }
  revalidatePath(INSIGHTS_PATH);
  return { status: "saved", message: "Dismissed." };
}
