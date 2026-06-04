import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SeoPageValidationError,
  adminPublishSeoPage,
} from "@/lib/services/seo-pages";
import {
  SCHEDULED_PUBLISH_MAX_ATTEMPTS,
  adminClaimDueScheduledSeoPage,
  adminListDueScheduledSeoPages,
  adminRunScheduledSeoPagePublishing,
} from "@/lib/services/seo-page-scheduler";
import type { Database, Tables } from "@/types/database";

const mocks = vi.hoisted(() => ({
  adminPublishSeoPage: vi.fn(),
}));

vi.mock("@/lib/services/seo-pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/seo-pages")
  >("@/lib/services/seo-pages");
  return {
    ...actual,
    adminPublishSeoPage: mocks.adminPublishSeoPage,
  };
});

type SeoClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

const now = () => new Date("2026-06-03T16:30:00.000Z");

function scheduledPage(
  overrides: Partial<Tables<"seo_pages">> = {},
): Tables<"seo_pages"> {
  return {
    id: overrides.id ?? "page_1",
    slug: overrides.slug ?? "scheduled-page",
    route_path: overrides.route_path ?? "/resources/scheduled-page",
    status: overrides.status ?? "draft",
    scheduled_publish_at:
      overrides.scheduled_publish_at ?? "2026-06-03T16:00:00.000Z",
    scheduled_publish_status: overrides.scheduled_publish_status ?? "scheduled",
    scheduled_publish_error: overrides.scheduled_publish_error ?? null,
    scheduled_publish_attempts: overrides.scheduled_publish_attempts ?? 0,
    scheduled_publish_last_attempt_at:
      overrides.scheduled_publish_last_attempt_at ?? null,
    scheduled_publish_locked_at: overrides.scheduled_publish_locked_at ?? null,
    updated_at: overrides.updated_at ?? "2026-06-03T15:00:00.000Z",
  } as Tables<"seo_pages">;
}

function dueQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error });
  return { table: chain, mocks: chain };
}

function claimQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return { table: chain, mocks: chain };
}

function updateResult(data: unknown, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  return { table: chain, mocks: chain };
}

function buildClient(...tables: Array<Record<string, unknown>>) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
    rpc: vi.fn(),
  } as unknown as SeoClient & { from: ReturnType<typeof vi.fn> };
}

describe("seo page scheduler service", () => {
  beforeEach(() => {
    mocks.adminPublishSeoPage.mockReset();
  });

  it("lists only due scheduled pages with attempt and lock guards", async () => {
    const due = dueQuery([scheduledPage()]);
    const client = buildClient(due.table);

    const result = await adminListDueScheduledSeoPages(
      { now, limit: 10 },
      { client },
    );

    expect(result).toHaveLength(1);
    expect(due.mocks.eq).toHaveBeenCalledWith(
      "scheduled_publish_status",
      "scheduled",
    );
    expect(due.mocks.lte).toHaveBeenCalledWith(
      "scheduled_publish_at",
      "2026-06-03T16:30:00.000Z",
    );
    expect(due.mocks.lt).toHaveBeenCalledWith(
      "scheduled_publish_attempts",
      SCHEDULED_PUBLISH_MAX_ATTEMPTS,
    );
    expect(due.mocks.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^scheduled_publish_locked_at\.is\.null,scheduled_publish_locked_at\.lt\./,
      ),
    );
    expect(due.mocks.limit).toHaveBeenCalledWith(10);
  });

  it("claims a due page by recording lock, last attempt, and incremented attempts", async () => {
    const claimed = scheduledPage({
      scheduled_publish_attempts: 2,
      scheduled_publish_locked_at: "2026-06-03T16:30:00.000Z",
    });
    const claim = claimQuery(claimed);
    const client = buildClient(claim.table);

    const result = await adminClaimDueScheduledSeoPage(
      scheduledPage({ scheduled_publish_attempts: 1 }),
      { now },
      { client },
    );

    expect(result).toBe(claimed);
    expect(claim.mocks.update).toHaveBeenCalledWith({
      scheduled_publish_attempts: 2,
      scheduled_publish_error: null,
      scheduled_publish_last_attempt_at: "2026-06-03T16:30:00.000Z",
      scheduled_publish_locked_at: "2026-06-03T16:30:00.000Z",
    });
    expect(claim.mocks.eq).toHaveBeenCalledWith("id", "page_1");
    expect(claim.mocks.eq).toHaveBeenCalledWith(
      "scheduled_publish_status",
      "scheduled",
    );
    expect(claim.mocks.lte).toHaveBeenCalledWith(
      "scheduled_publish_at",
      "2026-06-03T16:30:00.000Z",
    );
    expect(claim.mocks.lt).toHaveBeenCalledWith(
      "scheduled_publish_attempts",
      SCHEDULED_PUBLISH_MAX_ATTEMPTS,
    );
    expect(claim.mocks.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^scheduled_publish_locked_at\.is\.null,scheduled_publish_locked_at\.lt\./,
      ),
    );
  });

  it("does not publish when another runner already claimed the page", async () => {
    const due = dueQuery([scheduledPage()]);
    const claim = claimQuery(null);
    const client = buildClient(due.table, claim.table);

    const result = await adminRunScheduledSeoPagePublishing(
      { now },
      { client },
    );

    expect(result).toMatchObject({ scanned: 1, claimed: 0, skipped: 1 });
    expect(adminPublishSeoPage).not.toHaveBeenCalled();
  });

  it("publishes claimed pages through the existing publish service and marks success", async () => {
    mocks.adminPublishSeoPage.mockResolvedValue({
      page: scheduledPage({ status: "published" }),
      revision: { id: "rev_1" },
    });
    const claimed = scheduledPage({ scheduled_publish_attempts: 1 });
    const due = dueQuery([scheduledPage()]);
    const claim = claimQuery(claimed);
    const success = updateResult(
      scheduledPage({ scheduled_publish_status: "published" }),
    );
    const client = buildClient(due.table, claim.table, success.table);

    const result = await adminRunScheduledSeoPagePublishing(
      { now, actorId: "scheduler" },
      { client },
    );

    expect(result).toMatchObject({ scanned: 1, claimed: 1, published: 1 });
    expect(mocks.adminPublishSeoPage).toHaveBeenCalledWith("page_1", {
      actorId: "scheduler",
      client,
      now,
      publishNote: "Scheduled publish",
    });
    expect(success.mocks.update).toHaveBeenCalledWith({
      scheduled_publish_at: null,
      scheduled_publish_error: null,
      scheduled_publish_attempts: 0,
      scheduled_publish_last_attempt_at: null,
      scheduled_publish_locked_at: null,
      scheduled_publish_status: "published",
    });
  });

  it("does not misclassify published pages when success recording fails", async () => {
    mocks.adminPublishSeoPage.mockResolvedValue({
      page: scheduledPage({ status: "published" }),
      revision: { id: "rev_1" },
    });
    const due = dueQuery([scheduledPage()]);
    const claim = claimQuery(scheduledPage({ scheduled_publish_attempts: 1 }));
    const success = updateResult(null, { message: "write failed" });
    const client = buildClient(due.table, claim.table, success.table);

    const result = await adminRunScheduledSeoPagePublishing(
      { now },
      { client },
    );

    expect(result).toMatchObject({
      scanned: 1,
      claimed: 1,
      published: 1,
      failed: 0,
      retried: 0,
    });
    expect(result.errors).toEqual([
      {
        pageId: "page_1",
        attempts: 1,
        message: "Could not record scheduled publish success.",
        retryable: false,
      },
    ]);
    expect(client.from).toHaveBeenCalledTimes(3);
  });

  it("marks publish-gate failures failed without retrying indefinitely", async () => {
    mocks.adminPublishSeoPage.mockRejectedValue(
      new SeoPageValidationError([
        { code: "missing", path: "seoTitle", message: "Add SEO title." },
      ]),
    );
    const due = dueQuery([scheduledPage()]);
    const claim = claimQuery(scheduledPage({ scheduled_publish_attempts: 1 }));
    const failure = updateResult(
      scheduledPage({ scheduled_publish_status: "failed" }),
    );
    const client = buildClient(due.table, claim.table, failure.table);

    const result = await adminRunScheduledSeoPagePublishing(
      { now },
      { client },
    );

    expect(result).toMatchObject({ failed: 1, retried: 0 });
    expect(failure.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_publish_status: "failed",
        scheduled_publish_locked_at: null,
      }),
    );
  });

  it("keeps processing pages when failure recording fails", async () => {
    mocks.adminPublishSeoPage
      .mockRejectedValueOnce(new Error("Database timeout"))
      .mockResolvedValueOnce({
        page: scheduledPage({ id: "page_2", status: "published" }),
        revision: { id: "rev_2" },
      });
    const due = dueQuery([
      scheduledPage({ id: "page_1" }),
      scheduledPage({ id: "page_2" }),
    ]);
    const claimOne = claimQuery(
      scheduledPage({ id: "page_1", scheduled_publish_attempts: 2 }),
    );
    const failure = updateResult(null, { message: "write failed" });
    const claimTwo = claimQuery(
      scheduledPage({ id: "page_2", scheduled_publish_attempts: 1 }),
    );
    const success = updateResult(
      scheduledPage({ id: "page_2", scheduled_publish_status: "published" }),
    );
    const client = buildClient(
      due.table,
      claimOne.table,
      failure.table,
      claimTwo.table,
      success.table,
    );

    const result = await adminRunScheduledSeoPagePublishing(
      { now },
      { client },
    );

    expect(result).toMatchObject({
      scanned: 2,
      claimed: 2,
      published: 1,
      failed: 0,
      retried: 1,
    });
    expect(result.errors).toEqual([
      {
        pageId: "page_1",
        attempts: 2,
        message: "Could not record scheduled publish failure.",
        retryable: false,
      },
      {
        pageId: "page_1",
        attempts: 2,
        message: "Database timeout",
        retryable: true,
      },
    ]);
    expect(mocks.adminPublishSeoPage).toHaveBeenCalledTimes(2);
  });

  it("retries transient failures until the attempt cap is reached", async () => {
    mocks.adminPublishSeoPage.mockRejectedValue(new Error("Database timeout"));
    const due = dueQuery([scheduledPage()]);
    const claim = claimQuery(scheduledPage({ scheduled_publish_attempts: 2 }));
    const retry = updateResult(
      scheduledPage({ scheduled_publish_status: "scheduled" }),
    );
    const client = buildClient(due.table, claim.table, retry.table);

    const result = await adminRunScheduledSeoPagePublishing(
      { now },
      { client },
    );

    expect(result).toMatchObject({ failed: 0, retried: 1 });
    expect(retry.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_publish_status: "scheduled",
        scheduled_publish_locked_at: null,
      }),
    );
  });
});
