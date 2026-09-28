"use server";

import { revalidatePath } from "next/cache";
import {
  getSeoKeywords,
  getSeoOverview,
} from "@/lib/services/seo-command-center";
import {
  createTask,
  newTaskInput,
  pieceStatusInput,
  reviewInput,
  saveReview,
  setPieceStatus,
  setTaskStatus,
  taskStatusInput,
} from "@/lib/services/seo-task-writes";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Json } from "@/types/database";

const PATH = "/admin/seo";

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
};

export async function updateTaskStatus(form: FormData): Promise<void> {
  await requireAdmin();
  await setTaskStatus(
    taskStatusInput.parse({
      id: field(form, "id"),
      status: field(form, "status"),
    }),
  );
  revalidatePath(PATH);
}

export async function addTask(form: FormData): Promise<void> {
  await requireAdmin();
  await createTask(
    newTaskInput.parse({
      title: field(form, "title"),
      type: field(form, "type"),
      priority: field(form, "priority"),
      url: field(form, "url"),
      owner: field(form, "owner"),
      detail: field(form, "detail"),
      due_date: field(form, "due_date"),
    }),
  );
  revalidatePath(PATH);
}

export async function updatePieceStatus(form: FormData): Promise<void> {
  await requireAdmin();
  await setPieceStatus(
    pieceStatusInput.parse({
      id: field(form, "id"),
      status: field(form, "status"),
    }),
  );
  revalidatePath(PATH);
}

/** Saves the monthly review with the numbers it was filled against. */
export async function saveMonthlyReview(form: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const answers: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("q_") && typeof value === "string")
      answers[key.slice(2)] = value;
  }
  const input = reviewInput.parse({ month: field(form, "month"), answers });
  const [overview, keywords] = await Promise.all([
    getSeoOverview(),
    getSeoKeywords(),
  ]);
  const snapshot = {
    search: overview.missing
      ? null
      : {
          asOf: overview.asOf,
          current: overview.current,
          prior: overview.prior,
        },
    aeo: keywords.missing ? null : keywords.aeo,
    top3: keywords.missing
      ? null
      : keywords.keywords.filter((k) => k.rank !== null && k.rank <= 3).length,
    top10: keywords.missing
      ? null
      : keywords.keywords.filter((k) => k.rank !== null && k.rank <= 10).length,
  } as unknown as Json;
  await saveReview(input, snapshot, user.email ?? null);
  revalidatePath(PATH);
}
