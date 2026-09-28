import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addDays } from "@/lib/seo/triggers";
import { absolute, pageMetrics } from "@/lib/services/seo-trigger-job";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

/** Writes behind /admin/seo's forms. Every input is parsed here, not trusted. */

type Client = Pick<SupabaseClient<Database>, "from">;

export class SeoWriteError extends Error {}

const TASK_STATUS = ["open", "in_progress", "done", "dismissed"] as const;
const TASK_TYPES = [
  "publish",
  "refresh",
  "optimize_ctr",
  "add_links",
  "aeo_pairing",
  "verify_facts",
  "technical",
  "outreach",
  "roadmap",
  "optimize",
] as const;
const PIECE_STATUS = [
  "planned",
  "drafting",
  "in_review",
  "verify_needed",
  "scheduled",
  "published",
  "refreshing",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

export const taskStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(TASK_STATUS),
});

export const newTaskInput = z.object({
  title: z.string().trim().min(3).max(300),
  type: z.enum(TASK_TYPES),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  url: optionalText(500),
  owner: optionalText(120),
  detail: optionalText(4000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export const pieceStatusInput = z.object({
  id: z.string().min(1).max(20),
  status: z.enum(PIECE_STATUS),
});

export const reviewInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  answers: z
    .record(z.string().max(40), z.string().max(4000))
    .refine((o) => Object.keys(o).length <= 30, "Too many answers."),
});

export async function setTaskStatus(
  input: z.infer<typeof taskStatusInput>,
  deps: { client?: Client; now?: Date } = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = (deps.now ?? new Date()).toISOString();
  const patch: Database["public"]["Tables"]["seo_tasks"]["Update"] = {
    status: input.status,
    updated_at: now,
    done_at: input.status === "done" ? now : null,
    // A new "done" starts a new before/after log; old +14/+28 would mislead.
    ...(input.status === "done"
      ? { metrics_after_14: null, metrics_after_28: null }
      : null),
  };
  if (input.status === "done") {
    const task = await client
      .from("seo_tasks")
      .select("url")
      .eq("id", input.id)
      .single();
    if (task.error) throw write("read the task", task.error);
    if (task.data?.url)
      patch.metrics_at_done = await metricsFor(client, task.data.url);
  }
  const { error } = await client
    .from("seo_tasks")
    .update(patch)
    .eq("id", input.id);
  if (error) throw write("update the task", error);
}

/** The page's last 28 days of Search Console, stored as the "before" numbers. */
async function metricsFor(client: Client, url: string): Promise<Json> {
  const page = absolute(url);
  const latest = await client
    .from("seo_gsc_page_daily")
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  if (latest.error)
    throw write("read the latest Search Console day", latest.error);
  const asOf = latest.data?.[0]?.day;
  if (!asOf) return null;
  const rows = await client
    .from("seo_gsc_page_daily")
    .select("day, page, clicks, impressions, position")
    .eq("page", page)
    .gte("day", addDays(asOf, -27));
  if (rows.error) throw write("read the page's numbers", rows.error);
  return pageMetrics(
    (rows.data ?? []).map((r) => ({
      ...r,
      position: r.position === null ? null : Number(r.position),
    })),
    page,
    asOf,
  );
}

export async function createTask(
  input: z.infer<typeof newTaskInput>,
  createdBy: string | null,
  deps: { client?: Client } = {},
) {
  const client = deps.client ?? createAdminClient();
  const { error } = await client.from("seo_tasks").insert({
    title: input.title,
    type: input.type,
    priority: input.priority,
    url: input.url ?? null,
    owner: input.owner ?? createdBy,
    detail: input.detail ?? null,
    due_date: input.due_date ?? null,
    created_by: "user",
  });
  if (error) throw write("create the task", error);
}

export async function setPieceStatus(
  input: z.infer<typeof pieceStatusInput>,
  deps: { client?: Client; now?: Date } = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = (deps.now ?? new Date()).toISOString();
  const { error } = await client
    .from("seo_content_pieces")
    .update({
      status: input.status,
      updated_at: now,
      ...(input.status === "refreshing" ? { last_refreshed_at: now } : null),
    })
    .eq("id", input.id);
  if (error) throw write("update the piece", error);
}

export async function saveReview(
  input: z.infer<typeof reviewInput>,
  snapshot: Json,
  reviewedBy: string | null,
  deps: { client?: Client; now?: Date } = {},
) {
  const client = deps.client ?? createAdminClient();
  const { error } = await client.from("seo_monthly_reviews").upsert(
    {
      month: `${input.month}-01`,
      answers: input.answers,
      snapshot,
      reviewed_by: reviewedBy,
      updated_at: (deps.now ?? new Date()).toISOString(),
    },
    { onConflict: "month" },
  );
  if (error) throw write("save the review", error);
}

function write(what: string, error: { message: string }): SeoWriteError {
  console.error(`seo write failed: ${what}`, { message: error.message });
  return new SeoWriteError(`Could not ${what}.`);
}
