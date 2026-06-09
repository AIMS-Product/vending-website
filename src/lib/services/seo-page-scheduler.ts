import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SCHEDULED_PUBLISH_MAX_ATTEMPTS,
  SCHEDULED_PUBLISH_STALE_LOCK_MINUTES,
} from "@/lib/page-builder/scheduled-publishing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import { SeoPageValidationError, adminPublishSeoPage } from "./seo-pages";

type SeoPage = Tables<"seo_pages">;
type SchedulerClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

type SchedulerDeps = {
  client?: SchedulerClient;
};

type ClockOptions = {
  now?: () => Date;
};

type SchedulerOptions = ClockOptions & {
  actorId?: string | null;
  limit?: number;
  maxAttempts?: number;
};

type FailureOutcome = "failed" | "retried";

export type ScheduledPublishErrorSummary = {
  pageId: string;
  message: string;
  retryable: boolean;
  attempts: number;
};

export type ScheduledPublishRunResult = {
  scanned: number;
  claimed: number;
  published: number;
  failed: number;
  retried: number;
  skipped: number;
  errors: ScheduledPublishErrorSummary[];
};

export { SCHEDULED_PUBLISH_MAX_ATTEMPTS };

const SCHEDULED_SEO_PAGE_FIELDS =
  "id, slug, route_path, status, scheduled_publish_at, scheduled_publish_status, scheduled_publish_error, scheduled_publish_attempts, scheduled_publish_last_attempt_at, scheduled_publish_locked_at, updated_at" as const;

export async function adminListDueScheduledSeoPages(
  options: ClockOptions & { limit?: number; maxAttempts?: number } = {},
  deps: SchedulerDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const nowIso = now().toISOString();
  const staleLockIso = staleLockBefore(now()).toISOString();
  const maxAttempts = options.maxAttempts ?? SCHEDULED_PUBLISH_MAX_ATTEMPTS;
  const limit = options.limit ?? 25;

  const { data, error } = await client
    .from("seo_pages")
    .select(SCHEDULED_SEO_PAGE_FIELDS)
    .eq("scheduled_publish_status", "scheduled")
    // Archive cancels schedules, but stay defensive: the runner must never
    // resurrect an archived page even if stale schedule state slips through.
    .neq("status", "archived")
    .lte("scheduled_publish_at", nowIso)
    .lt("scheduled_publish_attempts", maxAttempts)
    .or(
      `scheduled_publish_locked_at.is.null,scheduled_publish_locked_at.lt.${staleLockIso}`,
    )
    .order("scheduled_publish_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error("Could not list due scheduled SEO pages.");
  return (data ?? []) as SeoPage[];
}

export async function adminClaimDueScheduledSeoPage(
  page: SeoPage,
  options: ClockOptions & { maxAttempts?: number } = {},
  deps: SchedulerDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const claimedAt = now();
  const claimedAtIso = claimedAt.toISOString();
  const maxAttempts = options.maxAttempts ?? SCHEDULED_PUBLISH_MAX_ATTEMPTS;
  const attempts = page.scheduled_publish_attempts ?? 0;

  if (
    page.scheduled_publish_status !== "scheduled" ||
    !page.scheduled_publish_at ||
    new Date(page.scheduled_publish_at).getTime() > claimedAt.getTime() ||
    attempts >= maxAttempts
  ) {
    return null;
  }

  const { data, error } = await client
    .from("seo_pages")
    .update({
      scheduled_publish_attempts: attempts + 1,
      scheduled_publish_error: null,
      scheduled_publish_last_attempt_at: claimedAtIso,
      scheduled_publish_locked_at: claimedAtIso,
    })
    .eq("id", page.id)
    .eq("scheduled_publish_status", "scheduled")
    .neq("status", "archived")
    .lte("scheduled_publish_at", claimedAtIso)
    .lt("scheduled_publish_attempts", maxAttempts)
    .or(
      `scheduled_publish_locked_at.is.null,scheduled_publish_locked_at.lt.${staleLockBefore(
        claimedAt,
      ).toISOString()}`,
    )
    .select(SCHEDULED_SEO_PAGE_FIELDS)
    .maybeSingle();

  if (error) throw new Error("Could not claim scheduled SEO page.");
  return (data as SeoPage | null) ?? null;
}

export async function adminRunScheduledSeoPagePublishing(
  options: SchedulerOptions = {},
  deps: SchedulerDeps = {},
): Promise<ScheduledPublishRunResult> {
  const client = deps.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const maxAttempts = options.maxAttempts ?? SCHEDULED_PUBLISH_MAX_ATTEMPTS;
  const duePages = await adminListDueScheduledSeoPages(
    { limit: options.limit, maxAttempts, now },
    { client },
  );
  const result: ScheduledPublishRunResult = {
    scanned: duePages.length,
    claimed: 0,
    published: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    errors: [],
  };

  for (const duePage of duePages) {
    const claimedPage = await adminClaimDueScheduledSeoPage(
      duePage,
      { maxAttempts, now },
      { client },
    );
    if (!claimedPage) {
      result.skipped += 1;
      continue;
    }

    result.claimed += 1;
    let publishError: unknown;
    let didPublish = false;
    try {
      await adminPublishSeoPage(claimedPage.id, {
        actorId: options.actorId ?? null,
        client,
        now,
        publishNote: "Scheduled publish",
      });
      didPublish = true;
    } catch (error) {
      publishError = error;
    }

    if (didPublish) {
      try {
        await recordScheduledPublishSuccess(claimedPage, { client });
      } catch (error) {
        pushScheduledPublishError(result, claimedPage, error, false);
      }
      result.published += 1;
      continue;
    }

    const retryable = isRetryableScheduledPublishError(publishError);
    const outcome = scheduledPublishFailureOutcome(claimedPage, {
      maxAttempts,
      retryable,
    });
    try {
      await recordScheduledPublishFailure(
        claimedPage,
        publishError,
        { maxAttempts, retryable },
        { client },
      );
    } catch (error) {
      pushScheduledPublishError(result, claimedPage, error, false);
    }

    if (outcome === "retried") result.retried += 1;
    if (outcome === "failed") result.failed += 1;
    pushScheduledPublishError(result, claimedPage, publishError, retryable);
  }

  return result;
}

async function recordScheduledPublishSuccess(
  page: SeoPage,
  deps: Required<SchedulerDeps>,
) {
  const { data, error } = await deps.client
    .from("seo_pages")
    .update({
      scheduled_publish_at: null,
      scheduled_publish_error: null,
      scheduled_publish_attempts: 0,
      scheduled_publish_last_attempt_at: null,
      scheduled_publish_locked_at: null,
      scheduled_publish_status: "published",
    })
    .eq("id", page.id)
    .select(SCHEDULED_SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not record scheduled publish success.");
  return data as SeoPage;
}

async function recordScheduledPublishFailure(
  page: SeoPage,
  error: unknown,
  options: { maxAttempts: number; retryable: boolean },
  deps: Required<SchedulerDeps>,
): Promise<FailureOutcome> {
  const outcome = scheduledPublishFailureOutcome(page, options);
  const status = outcome === "retried" ? "scheduled" : "failed";
  const { error: updateError } = await deps.client
    .from("seo_pages")
    .update({
      scheduled_publish_error: scheduledPublishErrorMessage(error),
      scheduled_publish_locked_at: null,
      scheduled_publish_status: status,
    })
    .eq("id", page.id)
    .select(SCHEDULED_SEO_PAGE_FIELDS)
    .single();

  if (updateError)
    throw new Error("Could not record scheduled publish failure.");
  return outcome;
}

function isRetryableScheduledPublishError(error: unknown) {
  return !(error instanceof SeoPageValidationError);
}

function scheduledPublishFailureOutcome(
  page: SeoPage,
  options: { maxAttempts: number; retryable: boolean },
): FailureOutcome {
  const attempts = page.scheduled_publish_attempts ?? 0;
  return options.retryable && attempts < options.maxAttempts
    ? "retried"
    : "failed";
}

function pushScheduledPublishError(
  result: ScheduledPublishRunResult,
  page: SeoPage,
  error: unknown,
  retryable: boolean,
) {
  result.errors.push({
    pageId: page.id,
    attempts: page.scheduled_publish_attempts ?? 0,
    message: scheduledPublishErrorMessage(error),
    retryable,
  });
}

function scheduledPublishErrorMessage(error: unknown) {
  if (error instanceof SeoPageValidationError) {
    return (
      error.issues[0]?.message ??
      "Scheduled publish failed the page readiness checks."
    );
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }
  return "Scheduled publish failed.";
}

function staleLockBefore(now: Date) {
  return new Date(
    now.getTime() - SCHEDULED_PUBLISH_STALE_LOCK_MINUTES * 60 * 1000,
  );
}
